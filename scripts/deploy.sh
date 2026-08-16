#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Elite Signals Pro — one-click deploy script
# Commits any pending changes, pushes to GitHub, which triggers Vercel via CI.
#
# REQUIREMENTS:
#   GITHUB_TOKEN secret — needs scopes: repo + workflow
#   VERCEL_TOKEN secret — already set
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

[[ -z "${GITHUB_TOKEN:-}" ]] && error "GITHUB_TOKEN not set in Replit Secrets."
[[ -z "${VERCEL_TOKEN:-}"  ]] && error "VERCEL_TOKEN not set in Replit Secrets."

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

# Set remote URL with token embedded (cleared after push)
git remote set-url github "https://x-token:${GITHUB_TOKEN}@github.com/developercharloh/Cashflow-site.git" 2>/dev/null || \
  git remote add github "https://x-token:${GITHUB_TOKEN}@github.com/developercharloh/Cashflow-site.git"

info "Pushing to github/main…"
if git push github main 2>&1; then
  info "✅ Push complete — GitHub Actions will build & deploy to Vercel."
  info "   Actions:  https://github.com/developercharloh/Cashflow-site/actions"
  info "   Live URL: https://elite-signals-pro.vercel.app"
else
  warn "Push failed. If you see 'workflow scope' error, regenerate your GitHub PAT"
  warn "at https://github.com/settings/tokens/new with scopes: repo + workflow"
  warn "Then update GITHUB_TOKEN in Replit Secrets and re-run this script."
  git remote set-url github "https://github.com/developercharloh/Cashflow-site.git"
  exit 1
fi

# Remove token from remote URL
git remote set-url github "https://github.com/developercharloh/Cashflow-site.git"
