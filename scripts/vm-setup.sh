#!/bin/sh
# Einmalig auf der VM: Docker, Firewall, IPv6-Weiterleitung.
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker fehlt. Unter Debian/Ubuntu z. B.:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  sysctl -w net.ipv6.conf.all.forwarding=1 >/dev/null || true
  if command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow 443/udp || true
  fi
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.production.example .env
  echo "Datei .env angelegt — Secrets eintragen, dann erneut ausführen."
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d --build
echo "Nexaly läuft. Dashboard: https://nexaly.app"
