#!/usr/bin/env bash
# Restart ML service when GPU VRAM exceeds threshold (cron every 5 min).
set -euo pipefail

THRESHOLD="${GPU_VRAM_RESTART_PCT:-85}"
SERVICE="${GPU_MONITOR_PM2_SERVICE:-ml-services}"
LOG="${GPU_MONITOR_LOG:-/var/log/tekeye-gpu-monitor.log}"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  exit 0
fi

read -r USED TOTAL <<<"$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | head -1 | tr -d ' MiB')"
if [[ -z "${USED:-}" || -z "${TOTAL:-}" || "$TOTAL" -eq 0 ]]; then
  exit 0
fi

PCT=$((USED * 100 / TOTAL))
TS="$(date -Is)"
echo "$TS GPU VRAM ${USED}MiB / ${TOTAL}MiB (${PCT}%)" >>"$LOG"

if (( PCT >= THRESHOLD )); then
  echo "$TS VRAM ${PCT}% >= ${THRESHOLD}% — restarting ${SERVICE}" >>"$LOG"
  pm2 restart "$SERVICE" || true
fi
