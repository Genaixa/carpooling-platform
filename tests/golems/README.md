# ChapaRide Golems

Automated testing agents ("goilems") for the ChapaRide platform.

## hacker.py — Ethical Security Tester

Probes the ChapaRide backend for common vulnerabilities. **Authorised use only.**

### Setup

```bash
cd /root/carpooling-platform/tests/golems

pip install requests

export VITE_SUPABASE_URL="https://xxxx.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJ..."
export GOLEM_PASSWORD="GoilemTest_2024!"   # password used for test accounts
```

### Run all tests

```bash
python hacker.py
```

### Run a specific category

```bash
python hacker.py --category auth        # unauthenticated access
python hacker.py --category jwt         # invalid/tampered JWT
python hacker.py --category idor        # IDOR / cross-user access
python hacker.py --category admin       # admin privilege escalation
python hacker.py --category input       # XSS / SQLi / boundary inputs
python hacker.py --category logic       # business logic flaws
python hacker.py --category hmac        # email-link HMAC forgery
python hacker.py --category ratelimit   # rate limiting checks
python hacker.py --category disclosure  # information leak checks
python hacker.py --category rls         # Supabase RLS bypass attempts
```

### Options

| Flag | Effect |
|---|---|
| `--no-create-users` | Skip signup, assume test accounts already exist |
| `--quiet` | Only show failures and final summary |

### What it tests

| Category | What's checked |
|---|---|
| **auth** | All protected endpoints return 401 with no token |
| **jwt** | Garbage, forged, and alg=none tokens are rejected |
| **idor** | User A cannot act as User B (bookings, rides, bank details, reviews) |
| **admin** | Regular user token cannot reach any `/api/admin/*` endpoint |
| **input** | XSS, SQL injection, oversized strings, path traversal don't cause 500 |
| **logic** | Out-of-range ratings, missing fields, invalid review types are rejected |
| **hmac** | Forged / expired email link signatures are rejected |
| **ratelimit** | Payment (10/min) and contact (5/15min) endpoints throttle |
| **disclosure** | Error responses don't leak stack traces, env vars, or secrets |
| **rls** | Supabase REST API hit directly (bypassing Express) — RLS policies block cross-user reads, writes, deletes, and privilege escalation |
