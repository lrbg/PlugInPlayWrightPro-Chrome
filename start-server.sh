#!/usr/bin/env bash
set -e

# Resolve Node 18+ path — supports nvm, fnm, and system node
find_node18() {
  # 1. Scan nvm versions
  local NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  for v in 22 21 20 19 18; do
    local candidate
    candidate=$(ls "$NVM_DIR/versions/node"/v${v}.*/bin/node 2>/dev/null | sort -V | tail -1)
    if [ -n "$candidate" ] && "$candidate" --version &>/dev/null; then
      echo "$candidate"; return
    fi
  done
  # 2. System node if >= 18
  local sys_node; sys_node=$(which node 2>/dev/null || true)
  if [ -n "$sys_node" ]; then
    local sys_ver; sys_ver=$("$sys_node" -e "process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)" 2>/dev/null && echo "$sys_node" || true)
    if [ -n "$sys_ver" ]; then echo "$sys_node"; return; fi
  fi
  echo ""
}

NODE_BIN=$(find_node18)
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js 18+ is required. Install it: nvm install 20"
  exit 1
fi

NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"

echo "Using Node: $($NODE_BIN --version)  [$NODE_BIN]"

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Install root dependencies / browsers if needed
if [ ! -d "node_modules/@playwright" ]; then
  echo "Installing root dependencies..."
  npm install
fi

if ! npx playwright --version &>/dev/null 2>&1; then
  echo "Installing Playwright browsers (Chromium)..."
  npx playwright install chromium --with-deps
fi

echo ""
echo "Building companion server..."
cd companion-server
npm install --silent
npm run build

echo ""
echo "Starting PlaywrightPro Companion Server (Node $($NODE_BIN --version))..."
node dist/server.js
