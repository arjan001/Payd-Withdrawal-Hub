#!/bin/bash
set -a
source .env
set +a
export PORT=5000
node --enable-source-maps ./dist/index.mjs
