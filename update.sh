#!/usr/bin/env bash
# Update the booking server to the latest master and start it.
#   Usage (from the project folder):  git pull origin master && bash update.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Fetching latest code"
git pull --ff-only origin master

# .env is no longer tracked by git, so the pull that removed it from the
# repository also deleted the local copy. Recover it from git history once.
if [ ! -f backend/.env ]; then
  last=$(git log -n 1 --format=%H -- backend/.env || true)
  if [ -n "$last" ] && git cat-file -e "${last}^:backend/.env" 2>/dev/null; then
    git show "${last}^:backend/.env" > backend/.env
    chmod 600 backend/.env
    echo "==> Restored backend/.env from git history."
    echo "    It still holds the OLD database password: after you change the password"
    echo "    in MongoDB Atlas, update MONGODB_URI in backend/.env and run this again."
  else
    echo "!! backend/.env is missing. Copy backend/.env.example to backend/.env and fill it in."
    exit 1
  fi
fi

echo "==> Installing dependencies"
(cd backend && npm ci --omit=dev)

echo "==> Starting server (stop any older server process first; Ctrl+C to stop)"
cd backend && exec npm start
