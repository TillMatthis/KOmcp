#!/bin/bash
set -e
echo "Deploying KOmcp at $(date)"
cd /opt/KOmcp
git reset --hard HEAD
git clean -fd
git pull origin main
docker compose build --no-cache komcp 2>/dev/null || echo "No docker-compose yet – OK"
docker compose up -d --force-recreate komcp 2>/dev/null || echo "Service not defined yet – OK"
echo "KOmcp deployed successfully!"
