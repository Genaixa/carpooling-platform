#!/bin/bash
# Monitor PM2 error log for critical issues and alert via Telegram

TELEGRAM_BOT_TOKEN="8645116179:AAF9nwZI6CluAhHCUR4A38LA6ilAPMDXCss"
TELEGRAM_CHAT_ID="6749360113"
LOG_FILE="/root/.pm2/logs/payment-server-error.log"
STATE_FILE="/tmp/chaparide-monitor-lastsize"

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d parse_mode="Markdown" \
    -d text="$1" > /dev/null
}

# Get current file size
CURRENT_SIZE=$(wc -c < "$LOG_FILE")
LAST_SIZE=$(cat "$STATE_FILE" 2>/dev/null || echo "0")

# Save current size for next run
echo "$CURRENT_SIZE" > "$STATE_FILE"

# If file hasn't grown, nothing to check
if [ "$CURRENT_SIZE" -le "$LAST_SIZE" ]; then
  exit 0
fi

# Get new content since last check
NEW_CONTENT=$(tail -c +"$((LAST_SIZE + 1))" "$LOG_FILE")

# Check for rate limit errors
if echo "$NEW_CONTENT" | grep -q "rate_limit_exceeded"; then
  send_telegram "⚠️ *ChapaRide Alert*: Resend email rate limit exceeded. Users may be failing to receive emails (registrations, bookings, etc)."
fi

# Check for server restarts
RESTART_COUNT=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; procs=json.load(sys.stdin); p=[x for x in procs if x['name']=='payment-server']; print(p[0]['pm2_env']['restart_time'] if p else 0)" 2>/dev/null)
LAST_RESTART=$(cat /tmp/chaparide-last-restart 2>/dev/null || echo "0")
echo "$RESTART_COUNT" > /tmp/chaparide-last-restart

if [ -n "$RESTART_COUNT" ] && [ "$RESTART_COUNT" -gt "$LAST_RESTART" ] && [ "$LAST_RESTART" != "0" ]; then
  send_telegram "🔴 *ChapaRide Alert*: payment-server restarted unexpectedly (restart #${RESTART_COUNT}). Users may have seen 'Failed to fetch' errors."
fi
