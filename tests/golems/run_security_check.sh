#!/bin/bash
# ChapaRide weekly security goilem — runs all 105 tests and sends Telegram report

set -euo pipefail

cd /root/carpooling-platform

# Load credentials from .env (strip Windows CR if present)
set -a
source <(sed 's/\r//' .env)
set +a

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Run the goilem, capture output
OUTPUT=$(python3 tests/golems/hacker.py --quiet 2>&1) || true

# Parse result line
SUMMARY=$(echo "$OUTPUT" | grep -E "^  HackerGoilem —" | tail -1 | xargs || true)
FAILURES=$(echo "$OUTPUT" | grep "✗" | sed 's/^[[:space:]]*//' | head -20 || true)

if echo "$SUMMARY" | grep -q "checks passed" && [ -z "$FAILURES" ]; then
    TOTAL=$(echo "$SUMMARY" | grep -oP '\d+(?=/\d+ checks passed)' || echo "?")
    STATUS="✅ All clear"
    BODY="*ChapaRide Security Check*
${STATUS} — ${TIMESTAMP}

All ${TOTAL} security tests passed.
API layer, admin controls, IDOR, RLS, rate limiting — everything green.

_Next check: in 7 days_"
else
    FAIL_COUNT=$(echo "$FAILURES" | grep -c "✗" || echo "?")
    STATUS="🚨 FAILURES DETECTED"
    BODY="*ChapaRide Security Check*
${STATUS} — ${TIMESTAMP}

${SUMMARY}

Failed tests:
\`\`\`
${FAILURES}
\`\`\`

_Action required — review and fix before next deployment_"
fi

# Send Telegram message
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"text\": $(echo "$BODY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"parse_mode\": \"Markdown\"}" \
    > /dev/null

echo "[$(date)] Security check complete: ${SUMMARY}"
