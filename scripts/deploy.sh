#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Elite Signals Pro — one-click deploy script
# Commits any pending changes, pushes to GitHub, and triggers Vercel via CI.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Colour helpers
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

# ── Guard: tokens must be present ────────────────────────────────────────────
[[ -z "${GITHUB_TOKEN:-}" ]]  && error "GITHUB_TOKEN secret not set. Add it in Replit Secrets."
[[ -z "${VERCEL_TOKEN:-}"  ]] && error "VERCEL_TOKEN secret not set. Add it in Replit Secrets."

# ── Commit message ────────────────────────────────────────────────────────────
MSG="${1:-"chore: auto-deploy $(date '+%Y-%m-%d %H:%M:%S')"}"

# ── Stage & commit (skip if nothing to commit) ────────────────────────────────
cd "$(git rev-parse --show-toplevel)"

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  info "Staging all changes…"
  git add -A
  info "Committing: $MSG"
  git commit -m "$MSG"
else
  info "Nothing to commit — pushing existing HEAD."
fi

# ── Configure git credential helper ──────────────────────────────────────────
git config credential.helper '!f() { echo "username=x-token"; echo "password='"${GITHUB_TOKEN}"'"; }; f'

# Ensure github remote exists
if ! git remote get-url github &>/dev/null; then
  git remote add github "https://github.com/developercharloh/Cashflow-site.git"
fi

# ── Push to GitHub → triggers GitHub Actions → Vercel deploy ─────────────────
info "Pushing to github/main…"
git push github main

info "✅ Push complete. GitHub Actions will now build & deploy to Vercel automatically."
info "   Track progress at: https://github.com/developercharloh/Cashflow-site/actions"
info "   Live URL (after deploy): https://elite-signals-pro.vercel.app"
