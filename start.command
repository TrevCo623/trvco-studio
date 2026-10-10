#!/bin/bash
# Double-click to preview the site locally at http://localhost:8080
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Get it from https://nodejs.org, then run this again."; read -n 1 -s; exit 1
fi
( sleep 1; open "http://localhost:8080" ) &
node serve.mjs
