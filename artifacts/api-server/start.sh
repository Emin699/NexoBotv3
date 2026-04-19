#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node --enable-source-maps "$SCRIPT_DIR/dist/index.mjs"
