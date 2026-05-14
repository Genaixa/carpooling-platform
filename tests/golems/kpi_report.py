"""
ChapaRide KPI report generator
Supports: weekly, monthly, quarterly, semester, annual
Each report fetches funnel data, analyses conversion, compares with the
previous equivalent period, checks if prior recommendations were acted on,
and sends a Telegram message + saves to kpi_reports table.

Usage:
    python3 kpi_report.py --type weekly
    python3 kpi_report.py --type monthly
    python3 kpi_report.py --type quarterly
    python3 kpi_report.py --type semester
    python3 kpi_report.py --type annual
"""

import os
import sys
import json
import argparse
from urllib.parse import quote
from datetime import datetime, timedelta, timezone, date
from collections import defaultdict
import requests

SUPABASE_URL      = os.environ["VITE_SUPABASE_URL"]
SERVICE_ROLE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TELEGRAM_BOT_TOKEN= os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID  = os.environ["TELEGRAM_CHAT_ID"]

SUPA = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

# ── Date helpers ──────────────────────────────────────────────────────────────

PERIOD_DAYS = {
    "weekly":    7,
    "monthly":   30,
    "quarterly": 91,
    "semester":  182,
    "annual":    365,
}

PERIOD_LABELS = {
    "weekly":    lambda: f"w/e {datetime.now(timezone.utc).strftime('%d %b %Y')}",
    "monthly":   lambda: datetime.now(timezone.utc).strftime("%B %Y"),
    "quarterly": lambda: f"Q{((datetime.now(timezone.utc).month - 1) // 3) + 1} {datetime.now(timezone.utc).year}",
    "semester":  lambda: f"H{1 if datetime.now(timezone.utc).month <= 6 else 2} {datetime.now(timezone.utc).year}",
    "annual":    lambda: str(datetime.now(timezone.utc).year - 1),  # annual runs Jan 1, covers prior year
}

PERIOD_TITLES = {
    "weekly":    "Weekly KPI Report",
    "monthly":   "Monthly KPI Recap",
    "quarterly": "Quarterly KPI Recap",
    "semester":  "Half-Year KPI Recap",
    "annual":    "Annual KPI Review",
}

# ── Supabase helpers ──────────────────────────────────────────────────────────

def fetch_events(since_iso: str, until_iso: str = None) -> list:
    since = quote(since_iso)
    url = (f"{SUPABASE_URL}/rest/v1/ride_events"
           f"?select=event_type,departure_location,arrival_location,created_at"
           f"&created_at=gte.{since}&limit=10000")
    if until_iso:
        url += f"&created_at=lt.{quote(until_iso)}"
    r = requests.get(url, headers=SUPA)
    r.raise_for_status()
    return r.json()

def fetch_rides() -> list:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/rides?select=id,status,created_at&limit=10000",
        headers=SUPA)
    r.raise_for_status()
    return r.json()

def fetch_bookings() -> list:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/bookings?select=id,status,created_at&limit=10000",
        headers=SUPA)
    r.raise_for_status()
    return r.json()

def fetch_previous_report(report_type: str) -> dict | None:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/kpi_reports"
        f"?report_type=eq.{report_type}&select=metrics_json,period_label,created_at"
        f"&order=created_at.desc&limit=1",
        headers=SUPA)
    if r.ok:
        rows = r.json()
        if rows and rows[0].get("metrics_json"):
            return rows[0]
    return None

# ── Analysis ──────────────────────────────────────────────────────────────────

def analyse(events: list) -> dict:
    views       = [e for e in events if e["event_type"] == "ride_view"]
    opens       = [e for e in events if e["event_type"] == "payment_open"]
    completions = [e for e in events if e["event_type"] == "booking_complete"]
    v, o, c = len(views), len(opens), len(completions)

    route_map = defaultdict(lambda: {"views": 0, "opens": 0, "completions": 0})
    for e in events:
        dep = e.get("departure_location") or "?"
        arr = e.get("arrival_location") or "?"
        key = f"{dep} → {arr}"
        if e["event_type"] == "ride_view":        route_map[key]["views"] += 1
        if e["event_type"] == "payment_open":     route_map[key]["opens"] += 1
        if e["event_type"] == "booking_complete": route_map[key]["completions"] += 1

    cold_routes = [r for r, d in route_map.items() if d["views"] >= 3 and d["completions"] == 0]
    top_routes  = sorted(route_map.items(), key=lambda x: x[1]["views"], reverse=True)[:5]

    return {
        "views": v, "opens": o, "completions": c,
        "view_to_open":     round(o / v * 100) if v else 0,
        "open_to_complete": round(c / o * 100) if o else 0,
        "view_to_complete": round(c / v * 100) if v else 0,
        "top_routes":  top_routes,
        "cold_routes": cold_routes[:3],
    }

# ── Recommendation engine ─────────────────────────────────────────────────────

def recommend(current: dict, prev_metrics: dict | None, period: str) -> list[dict]:
    v   = current["views"]
    o   = current["opens"]
    vto = current["view_to_open"]
    otc = current["open_to_complete"]
    recs = []

    def was_flagged(key):
        return prev_metrics and key in prev_metrics.get("flags", [])

    def improved(metric, threshold=5):
        if not prev_metrics:
            return False
        return current.get(metric, 0) - prev_metrics.get(metric, 0) >= threshold

    # ── Check if previous recommendations were followed ───────────────────────
    if prev_metrics:
        prev_vto = prev_metrics.get("view_to_open", 0)
        prev_otc = prev_metrics.get("open_to_complete", 0)
        prev_v   = prev_metrics.get("views", 0)

        if was_flagged("low_traffic"):
            if v > prev_v + 5:
                recs.append({"icon": "✅", "text": f"Traffic improved — views up from {prev_v} to {v}. Previous recommendation to promote rides is working.", "colour": "#F0FDF4"})
            else:
                recs.append({"icon": "⚠️", "text": f"Traffic still low ({v} views vs {prev_v} last {period}). Ride sharing on WhatsApp/social media has not yet moved the needle — try a more targeted push.", "colour": "#FEF2F2"})

        if was_flagged("low_view_to_open"):
            if vto > prev_vto + 8:
                recs.append({"icon": "✅", "text": f"View-to-click rate improved from {prev_vto}% to {vto}% — listing improvements are working.", "colour": "#F0FDF4"})
            else:
                recs.append({"icon": "⚠️", "text": f"View-to-click still low at {vto}% (was {prev_vto}% last {period}). Consider adding driver photos, ratings, and exact pickup spot to listings.", "colour": "#FEF3C7"})

        if was_flagged("low_payment_conv"):
            if otc > prev_otc + 10:
                recs.append({"icon": "✅", "text": f"Payment conversion improved from {prev_otc}% to {otc}% — checkout friction is reducing.", "colour": "#F0FDF4"})
            else:
                recs.append({"icon": "⚠️", "text": f"Payment completion still at {otc}% (was {prev_otc}% last {period}). Consider adding 'You won't be charged until the driver confirms' before the card form.", "colour": "#FEF2F2"})

    # ── Current period flags ──────────────────────────────────────────────────
    flags = []

    if v == 0:
        flags.append("low_traffic")
        recs.append({"icon": "⚠️", "text": "No ride views this period — the site is not getting traffic. Share active rides directly with community groups.", "colour": "#FEF2F2"})
    elif v < 10:
        flags.append("low_traffic")
        recs.append({"icon": "⚠️", "text": f"Only {v} ride views — traffic is very low. Encourage drivers to share their listings on WhatsApp and social media.", "colour": "#FEF2F2"})

    if v >= 5 and vto < 15:
        flags.append("low_view_to_open")
        recs.append({"icon": "🔍", "text": f"Only {vto}% of viewers clicked Book — listings are not converting browsers to intent. Check that driver profile, car make/model, and pickup spot are clearly shown.", "colour": "#FEF3C7"})
    elif v >= 5 and vto < 35:
        flags.append("low_view_to_open")
        recs.append({"icon": "📌", "text": f"{vto}% view-to-click — room to improve. Drivers with photos and 5-star ratings convert at 40%+.", "colour": "#FEF3C7"})

    if o >= 3 and otc < 40:
        flags.append("low_payment_conv")
        recs.append({"icon": "💳", "text": f"Only {otc}% of Book clicks completed payment — high drop-off at checkout. Add a trust message before the card form.", "colour": "#FEF2F2"})
    elif o >= 3 and otc < 70:
        flags.append("low_payment_conv")
        recs.append({"icon": "💳", "text": f"{otc}% payment completion — below the 70% target. Monitor trend weekly.", "colour": "#FEF3C7"})

    if current["cold_routes"]:
        flags.append("cold_routes")
        names = " and ".join(current["cold_routes"][:2])
        recs.append({"icon": "❄️", "text": f"Routes with views but zero bookings: {names}. Review pricing vs alternatives and ensure driver profiles are complete.", "colour": "#EFF6FF"})

    if not recs:
        recs.append({"icon": "✅", "text": "All metrics look healthy. Focus on growing traffic to top-of-funnel.", "colour": "#F0FDF4"})

    return recs, flags

# ── Formatting ────────────────────────────────────────────────────────────────

def pct_bar(pct: int, width: int = 10) -> str:
    filled = round(min(pct, 100) / 100 * width)
    return "█" * filled + "░" * (width - filled)

def format_report(report_type: str, period_label: str, current: dict,
                  prev_report: dict | None, recs: list[dict],
                  rides: list, bookings: list) -> str:
    v, o, c = current["views"], current["opens"], current["completions"]
    vto = current["view_to_open"]
    otc = current["open_to_complete"]
    vtc = current["view_to_complete"]
    prev_metrics = prev_report["metrics_json"] if prev_report else None
    prev_label   = prev_report["period_label"] if prev_report else None

    title = PERIOD_TITLES[report_type]
    upcoming = sum(1 for r in rides if r["status"] == "upcoming")
    completed_bookings = sum(1 for b in bookings if b["status"] == "completed")

    lines = [
        f"*🎯 ChapaRide {title}*",
        f"_{period_label}_",
        "",
        "*── Funnel ──*",
        f"👁 Ride views:    *{v}*" + (f"  (was {prev_metrics['views']} last {report_type})" if prev_metrics else ""),
        f"🖱 Book clicked:  *{o}*  ({vto}%)" + (f"  (was {prev_metrics['view_to_open']}%)" if prev_metrics else ""),
        f"✅ Bookings done: *{c}*  ({otc}% of clicks)" + (f"  (was {prev_metrics['open_to_complete']}%)" if prev_metrics else ""),
        "",
        f"*Conversion*",
        f"Views      {pct_bar(100)}  {v}",
        f"Book click {pct_bar(vto)}  {o}  ({vto}%)",
        f"Completed  {pct_bar(vtc)}  {c}  ({vtc}%)",
    ]

    if current["top_routes"]:
        lines += ["", f"*── Top routes ──*"]
        for route, data in current["top_routes"]:
            conv = round(data["completions"] / data["views"] * 100) if data["views"] else 0
            lines.append(f"• {route}")
            lines.append(f"  {data['views']} views · {data['opens']} clicks · {data['completions']} booked ({conv}%)")

    lines += [
        "",
        f"*── Platform ──*",
        f"🚗 Upcoming rides: {upcoming}",
        f"🎫 Total completed bookings (all time): {completed_bookings}",
        "",
        f"*── {'Progress & ' if prev_metrics else ''}Recommendations ──*",
    ]
    for rec in recs:
        lines.append(f"{rec['icon']} {rec['text']}")

    if report_type in ("monthly", "quarterly", "semester", "annual") and prev_label:
        lines += ["", f"_Compared to {prev_label}_"]

    return "\n".join(lines)

# ── Save & send ───────────────────────────────────────────────────────────────

def send_telegram(message: str):
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"},
    )

def save_report(message: str, report_type: str, period_label: str, metrics: dict, flags: list):
    metrics_to_save = {**metrics, "flags": flags}
    metrics_to_save.pop("top_routes", None)
    metrics_to_save["cold_routes"] = metrics.get("cold_routes", [])
    requests.post(
        f"{SUPABASE_URL}/rest/v1/kpi_reports",
        json={
            "report_text":   message,
            "report_type":   report_type,
            "period_label":  period_label,
            "metrics_json":  metrics_to_save,
        },
        headers={**SUPA, "Prefer": "return=minimal"},
    )

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", choices=["weekly","monthly","quarterly","semester","annual"],
                        default="weekly")
    args = parser.parse_args()
    report_type = args.type

    now = datetime.now(timezone.utc)
    days = PERIOD_DAYS[report_type]
    period_label = PERIOD_LABELS[report_type]()

    since = (now - timedelta(days=days)).isoformat()
    prev_since = (now - timedelta(days=days * 2)).isoformat()
    prev_until = since

    current_events = fetch_events(since)
    prev_events    = fetch_events(prev_since, prev_until)
    rides          = fetch_rides()
    bookings       = fetch_bookings()
    prev_report    = fetch_previous_report(report_type)

    current  = analyse(current_events)
    prev_period = analyse(prev_events)
    prev_metrics = prev_report["metrics_json"] if prev_report else None

    recs, flags = recommend(current, prev_metrics, report_type)
    message = format_report(report_type, period_label, current, prev_report, recs, rides, bookings)

    send_telegram(message)
    save_report(message, report_type, period_label, current, flags)
    print(f"[{now}] {report_type.capitalize()} KPI report sent and saved ({period_label}).")

if __name__ == "__main__":
    main()
