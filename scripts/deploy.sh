#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Elite Signals Pro — one-click deploy script
# Commits any pending changes, pushes to GitHub → triggers Vercel via CI.
#
# REQUIREMENTS (Replit Secrets):
#   GITHUB_PERSONAL_ACCESS_TOKEN  — scopes: repo + workflow
#   VERCEL_TOKEN                  — already set
#
# Usage:
#   bash scripts/deploy.sh                        # auto commit message
#   bash scripts/deploy.sh "feat: my message"     # custom commit message
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

[[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]] && error "GITHUB_PERSONAL_ACCESS_TOKEN not set in Replit Secrets."
[[ -z "${VERCEL_TOKEN:-}"  ]]               && error "VERCEL_TOKEN not set in Replit Secrets."

MSG="${1:-"chore: auto-deploy $(date '+%Y-%m-%d %H:%M:%S')"}"
cd "$(git rev-parse --show-toplevel)"

# Stage & commit if anything changed
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  info "Staging changes…"
  git add -A
  info "Committing: $MSG"
  git commit -m "$MSG"
else
  info "Nothing to commit — pushing existing HEAD."
fi

# Set remote with token, push, then clean URL
git remote set-url github "https://x-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/developercharloh/Cashflow-site.git" 2>/dev/null || \
  git remote add github "https://x-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/developercharloh/Cashflow-site.git"

info "Pushing to github/main…"
git push github main
git remote set-url github "https://github.com/developercharloh/Cashflow-site.git"

info "✅ Pushed! GitHub Actions is now building & deploying to Vercel."
info "   Actions:  https://github.com/developercharloh/Cashflow-site/actions"
info "   Live URL: https://elite-signals-pro.vercel.app"
