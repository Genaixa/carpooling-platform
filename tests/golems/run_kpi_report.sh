#!/bin/bash
# ChapaRide KPI report — pass --type weekly|monthly|quarterly|semester|annual
# Default: weekly

set -euo pipefail
cd /root/carpooling-platform

set -a
source <(sed 's/\r//' .env)
set +a

TYPE=${1:-weekly}
python3 tests/golems/kpi_report.py --type "$TYPE"
echo "[$(date)] KPI report complete (type=$TYPE)."
