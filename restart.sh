#!/bin/bash
set -e
cd /opt/KOmcp
git reset --hard HEAD && git clean -fd
git pull origin main
echo "KOmcp ready (Docker will come soon)"
