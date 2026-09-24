#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
if curl -fsS http://127.0.0.1:4173/ > /dev/null 2>&1; then
  exit 0
fi
nohup npm start > /tmp/kartenwerk-server.log 2>&1 < /dev/null &
