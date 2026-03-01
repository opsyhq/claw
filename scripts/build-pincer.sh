#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PINCER_DIR="$PROJECT_DIR/pincer"
OUT_DIR="$PROJECT_DIR/pincer-bin"

mkdir -p "$OUT_DIR"

echo "Building pincer for linux/amd64..."
GOOS=linux GOARCH=amd64 go build -C "$PINCER_DIR" -ldflags="-s -w" -o "$OUT_DIR/pincer-linux-amd64" .

echo "Building pincer for linux/arm64..."
GOOS=linux GOARCH=arm64 go build -C "$PINCER_DIR" -ldflags="-s -w" -o "$OUT_DIR/pincer-linux-arm64" .

echo "Done. Binaries in $OUT_DIR:"
ls -lh "$OUT_DIR"/pincer-*
