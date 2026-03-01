#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <patch|minor|major|x.y.z>
# Bumps version in all files, commits, tags, and pushes.

if [ $# -ne 1 ]; then
  echo "Usage: $0 <patch|minor|major|x.y.z>"
  exit 1
fi

CURRENT=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' package.json | head -1)
ARG="$1"

if [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW="$ARG"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$ARG" in
    patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
    major) NEW="$((MAJOR + 1)).0.0" ;;
    *) echo "Invalid argument: $ARG (use patch, minor, major, or x.y.z)"; exit 1 ;;
  esac
fi

echo "Bumping $CURRENT → $NEW"

# Update all version references
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json
sed -i '' "s/.version(\"$CURRENT\")/.version(\"$NEW\")/" src/cli/index.ts
sed -i '' "s/version: \"$CURRENT\"/version: \"$NEW\"/" src/server/index.ts
sed -i '' "s/const VERSION = \"$CURRENT\"/const VERSION = \"$NEW\"/" src/transports/deployer.ts
sed -i '' "s/const Version = \"$CURRENT\"/const Version = \"$NEW\"/" pincer/main.go

# Verify all updated
echo "Verifying..."
for f in package.json src/cli/index.ts src/server/index.ts src/transports/deployer.ts pincer/main.go; do
  if ! grep -q "$NEW" "$f"; then
    echo "ERROR: $f was not updated"
    exit 1
  fi
done

# Commit, tag, push
git add package.json src/cli/index.ts src/server/index.ts src/transports/deployer.ts pincer/main.go
git commit -m "chore: bump version to $NEW"
git tag "v$NEW"
git push && git push --tags

echo "Released v$NEW"
