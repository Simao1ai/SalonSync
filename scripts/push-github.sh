#!/usr/bin/env bash
set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "Error: GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not set."
  echo "Add it as a secret in the Replit environment settings."
  exit 1
fi

GITHUB_USER="Simao1ai"
GITHUB_REPO="SalonSync"
BRANCH="${1:-main}"
LOCAL_BRANCH="master"

echo "Pushing to github.com/$GITHUB_USER/$GITHUB_REPO ($LOCAL_BRANCH → $BRANCH)..."

git push \
  "https://${GITHUB_USER}:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git" \
  "${LOCAL_BRANCH}:${BRANCH}" \
  --force

echo "Done! https://github.com/$GITHUB_USER/$GITHUB_REPO"
