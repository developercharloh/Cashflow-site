#!/bin/bash
# Deploy to GitHub → Vercel auto-deploys from there
# Usage: bash deploy.sh

set -e

REPO_WITH_TOKEN=$(echo "$GITHUB_REPO_URL" | sed "s|https://|https://x-access-token:$GITHUB_TOKEN@|")

echo "⏫  Pushing to GitHub..."
git --no-optional-locks push "$REPO_WITH_TOKEN" HEAD:main

echo ""
echo "✅  Done! Vercel will auto-deploy in ~30 seconds."
echo "🌐  Live at: https://taskearn-pro.vercel.app"
