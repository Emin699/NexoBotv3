#!/bin/bash
set -a
source /root/bot/.env
set +a
exec node --enable-source-maps /root/bot/artifacts/api-server/dist/index.mjs
