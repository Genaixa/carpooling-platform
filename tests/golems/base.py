"""BaseGolem — authenticated HTTP client for ChapaRide."""
import os
import requests
from datetime import datetime
from typing import Optional

API_URL = os.environ.get("CHAPARIDE_API_URL", "http://srv1291941.hstgr.cloud:3001")
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

GOLEM_PASSWORD = os.environ.get("GOLEM_PASSWORD", "GoilemTest_2024!")


class GolemError(Exception):
    pass


class BaseGolem:
    name: str
    email: str

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.log: list[dict] = []
        self._failures: list[str] = []
        self._passes: list[str] = []

    # ── Supabase auth ─────────────────────────────────────────────────────────

    def signup(self, email: str = None, password: str = None) -> "BaseGolem":
        email = email or self.email
        password = password or GOLEM_PASSWORD
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise GolemError("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars required")
        resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            json={"email": email, "password": password},
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )
        if resp.status_code not in (200, 201):
            raise GolemError(f"{self.name} signup failed: {resp.status_code} {resp.text[:300]}")
        data = resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return self

    def login(self, email: str = None, password: str = None) -> "BaseGolem":
        email = email or self.email
        password = password or GOLEM_PASSWORD
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise GolemError("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars required")
        resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            json={"email": email, "password": password},
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            raise GolemError(f"{self.name} login failed: {resp.status_code} {resp.text[:300]}")
        data = resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return self

    def login_or_signup(self, email: str = None, password: str = None) -> "BaseGolem":
        try:
            return self.login(email, password)
        except GolemError:
            return self.signup(email, password)

    def set_token(self, token: Optional[str]) -> "BaseGolem":
        self.token = token
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            self.session.headers.pop("Authorization", None)
        return self

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def get(self, path: str, token_override: str = None, **kwargs) -> requests.Response:
        return self._req("GET", path, token_override=token_override, **kwargs)

    def post(self, path: str, json_body=None, token_override: str = None, **kwargs) -> requests.Response:
        return self._req("POST", path, json=json_body, token_override=token_override, **kwargs)

    def put(self, path: str, json_body=None, token_override: str = None, **kwargs) -> requests.Response:
        return self._req("PUT", path, json=json_body, token_override=token_override, **kwargs)

    def delete(self, path: str, token_override: str = None, **kwargs) -> requests.Response:
        return self._req("DELETE", path, token_override=token_override, **kwargs)

    def _req(self, method: str, path: str, token_override=None, **kwargs) -> requests.Response:
        url = f"{API_URL}{path}"
        headers = dict(self.session.headers)
        if token_override is not None:
            if token_override:
                headers["Authorization"] = f"Bearer {token_override}"
            else:
                headers.pop("Authorization", None)
        resp = requests.request(method, url, headers=headers, **kwargs)
        self._record(method, path, resp.status_code, ok=resp.status_code < 400)
        return resp

    # ── Assertions ────────────────────────────────────────────────────────────

    def check(self, description: str, condition: bool, detail: str = ""):
        status = "PASS" if condition else "FAIL"
        msg = f"[{self.name}] {status}: {description}"
        if not condition and detail:
            msg += f" | {detail}"
        if condition:
            self._passes.append(msg)
        else:
            self._failures.append(msg)
        if self.verbose or not condition:
            icon = "✓" if condition else "✗"
            print(f"  {icon} {msg}")
        self._record("CHECK", description, status, ok=condition)
        return condition

    def expect_status(self, resp: requests.Response, code: int, label: str) -> bool:
        ok = resp.status_code == code
        detail = f"expected {code}, got {resp.status_code}: {resp.text[:200]}"
        return self.check(label, ok, detail if not ok else "")

    # ── Logging ───────────────────────────────────────────────────────────────

    def _record(self, action: str, target: str, status, ok: bool):
        self.log.append({
            "ts": datetime.utcnow().isoformat(),
            "golem": self.name,
            "action": action,
            "target": target,
            "status": status,
            "ok": ok,
        })

    def summary(self) -> dict:
        checks = [e for e in self.log if e["action"] == "CHECK"]
        passed = sum(1 for e in checks if e["ok"])
        return {
            "golem": self.name,
            "checks": len(checks),
            "passed": passed,
            "failed": len(checks) - passed,
            "failures": self._failures,
        }

    def print_summary(self):
        s = self.summary()
        print(f"\n{'='*60}")
        print(f"  {self.name} — {s['passed']}/{s['checks']} checks passed")
        if s["failures"]:
            print(f"\n  FAILURES:")
            for f in s["failures"]:
                print(f"    ✗ {f}")
        print(f"{'='*60}\n")
