# Nexaly

Discord-Bot mit Web-Dashboard. Slogan: **Dein Server. Deine Regeln. Alles im Blick.**

Jeder Discord-Server hat eigene Einstellungen. Bot, API, Worker und Dashboard laufen getrennt.

Live-Domain: [nexaly.app](https://nexaly.app)

---

## Was du brauchst

| Für | Brauchst du |
|---|---|
| Entwicklung | Node.js 20+, pnpm 9 (`corepack enable`), Docker |
| Produktion (VM) | Docker + Compose-Plugin, Domain **nexaly.app**, Dual-Stack (IPv4+IPv6) |
| Immer | Discord-Application mit Bot-Token |

**Wichtig:** Discord-Gateway und REST sind nicht zuverlässig **IPv6-only**. Die VM braucht IPv4 (Dual-Stack, NAT64 oder Tunnel), sonst bleibt der Bot offline. Das Dashboard kann trotzdem nur per AAAA erreichbar sein.

---

## 1. Discord Application anlegen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → Name `Nexaly`.
2. **Bot**
   - Reset Token, Token kopieren → `DISCORD_TOKEN`
   - Privileged Gateway Intents einschalten:
     - **SERVER MEMBERS INTENT**
     - **MESSAGE CONTENT INTENT**
3. **OAuth2 → General**
   - Client ID → `DISCORD_CLIENT_ID`
   - Client Secret → `DISCORD_CLIENT_SECRET`
   - Redirects:
     - Entwicklung: `http://localhost:3000/api/auth/discord/callback`
     - Produktion: `https://nexaly.app/api/auth/discord/callback`
4. Login-Scopes (macht Nexaly selbst): `identify`, `guilds`
5. Bot einladen (Scopes `bot` + `applications.commands`). Das Dashboard erzeugt den Invite-Link, sobald du angemeldet bist.

Ohne Message-Content-Intent funktionieren Auto-Mod, Level-XP und gelöschte Log-Inhalte nicht.

---

## 2. Entwicklung (lokal)

```bash
git clone <repo> nexaly && cd nexaly
cp .env.example .env
```

In `.env` mindestens setzen:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
SESSION_SECRET=mindestens-32-zeichen-langes-geheimnis
```

Dann:

```bash
docker compose up -d postgres redis
pnpm install
pnpm db:generate
pnpm --filter @nexaly/database exec prisma migrate deploy
pnpm dev
```

| Dienst | Adresse |
|---|---|
| Dashboard | http://localhost:3000 |
| API Health | http://localhost:3001/v1/health |
| API Ready | http://localhost:3001/v1/ready |

`pnpm dev` startet API, Bot, Web und Worker. Ohne Worker laufen Text-/Embed-Welcome und die restlichen Module; Bildkarten und Stream-Polling nicht.

Optional `DISCORD_DEV_GUILD_ID`: Slash-Commands nur auf den Dev-Server statt global.

---

## 3. Produktion auf der VM (nexaly.app, IPv6)

### 3.1 DNS

Beim Registrar:

| Name | Typ | Wert |
|---|---|---|
| `@` / `nexaly.app` | **AAAA** | globale IPv6 der VM |
| `www` | **AAAA** | dieselbe IPv6 |
| `@` | **A** (empfohlen) | IPv4 der VM, für Discord-Gateway |

DNS muss **stehen**, bevor Caddy das erste Mal startet. Sonst schlägt Let’s Encrypt fehl.

Prüfen:

```bash
dig AAAA nexaly.app +short
dig A nexaly.app +short
```

### 3.2 Firewall

Offen: **80/tcp**, **443/tcp**, **443/udp** (HTTP/3). Postgres, Redis, API und Bot bleiben intern.

### 3.3 Discord auf Produktion umstellen

Im Developer Portal den Redirect **zusätzlich** eintragen:

`https://nexaly.app/api/auth/discord/callback`

### 3.4 Dateien auf die VM

Archiv nach `/opt/nexaly` legen und entpacken:

```bash
sudo mkdir -p /opt/nexaly
sudo tar -xzf nexaly-vm.tgz -C /opt
cd /opt/nexaly
```

### 3.5 Secrets

```bash
cp .env.production.example .env
nano .env
```

Pflichtfelder:

| Variable | Wert |
|---|---|
| `DISCORD_TOKEN` | Bot-Token |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | OAuth-Secret |
| `DISCORD_REDIRECT_URI` | `https://nexaly.app/api/auth/discord/callback` |
| `POSTGRES_PASSWORD` | starkes Passwort |
| `DATABASE_URL` | dasselbe Passwort in der URL, Host `postgres` |
| `SESSION_SECRET` | Ausgabe von `openssl rand -hex 32` |
| `ACME_EMAIL` | Mail für Let’s Encrypt |

`SESSION_SECRET` muss mindestens 32 Zeichen haben. Production startet nicht mit Beispiel-Secret oder `nexaly:nexaly` in der Datenbank-URL.

Twitch / YouTube / Kick nur eintragen, wenn Live-Alerts wirklich genutzt werden. Ohne Keys speichert das Dashboard keinen Stream-Kanal.

### 3.6 Start

```bash
chmod +x scripts/vm-setup.sh
./scripts/vm-setup.sh
```

Das Skript prüft Docker, öffnet ggf. ufw 80/443 und startet:

`docker compose -f docker-compose.prod.yml up -d --build`

Caddy hängt direkt am Host-Netz (IPv6 + HTTP/3), terminiert TLS und reicht an das Dashboard weiter. Öffentlich erreichbar ist nur HTTPS.

### 3.7 Prüfen

1. https://nexaly.app — Startseite, Slogan, Footer
2. **Mit Discord anmelden** — nur Server mit Owner / Administrator / Manage Server
3. Bot auf einem Server einladen, in Discord online
4. Ein Modul im Dashboard umlegen, in Discord testen

Logs:

```bash
docker compose -f docker-compose.prod.yml logs -f bot web api caddy
```

---

## Architektur

```
Browser  →  Caddy (443)  →  Web (Next.js)
                              ↓  intern
                            API (Fastify)  →  Postgres
                                           →  Redis
Discord Gateway  →  Bot
BullMQ / Queue   →  Worker (Welcome-Karten, Stream-Polling)
```

```
apps/bot        Gateway, Commands, Module
apps/api        REST, OAuth, Guild-Rechte
apps/web        Dashboard
apps/worker     Bildkarten, Stream-Polling
packages/database   Prisma
packages/shared     Rechte, Schemas, Provider
packages/config     Env
```

---

## Umgebungsvariablen

Vorlagen: `.env.example` (Dev), `.env.production.example` (Live). Niemals echte Tokens committen.

| Variable | Wer | Pflicht |
|---|---|---|
| `DATABASE_URL` | API, Bot, Worker | ja |
| `REDIS_URL` | API, Bot, Worker | ja |
| `SESSION_SECRET` | API | ja, ≥ 32 Zeichen |
| `DISCORD_TOKEN` | Bot, Worker, API | ja für den Bot |
| `DISCORD_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | API | ja für Login |
| `PUBLIC_WEB_URL` | CORS, Redirects | Produktion: `https://nexaly.app` |
| `PUBLIC_API_URL` | Web → API | Produktion intern: `http://api:3001` |
| `ACME_EMAIL` | Caddy | ja in Produktion |
| `TWITCH_*`, `YOUTUBE_API_KEY`, `KICK_*` | Worker | nur Live-Alerts |
| `ASSET_DIR` | Worker | Welcome-Hintergründe |
| `DISCORD_DEV_GUILD_ID` | Bot | optional, nur Dev |

---

## Module

| Modul | Verhalten |
|---|---|
| **Logs** | Gateway-Events als Embeds. Täter nur bei **genau einem** passenden Audit-Log. |
| **Moderation** | Auto-Mod (Flood, Duplikate, Mentions, Emoji, Caps, Links, Invites, Wortfilter), Cases, `/warn` `/timeout` `/kick` `/ban` `/purge` `/slowmode`. Keine Aktion gegen Owner, Bot oder gleich-/höhergestellte Rollen. |
| **Willkommen** | Text, Embed oder Bildkarte. Platzhalter `{user}`, `{user.name}`, `{server}`, `{memberCount}`. Karten baut der Worker. |
| **Level** | XP mit Cooldown. Kurve `5n² + 50n + 100`. `/rank`, `/leaderboard`. |
| **Embeds** | Vorlagen mit Discord-Limits, Versand nur in Kanäle **dieser** Guild. |
| **Streams** | Twitch Helix, YouTube Data API v3, Kick Public API. Keine Scraper. Ohne Keys kein Live-Status. |

---

## Alltag

```bash
# Status
docker compose -f docker-compose.prod.yml ps

# Neu bauen nach Update
cd /opt/nexaly
docker compose -f docker-compose.prod.yml up -d --build

# Datenbank-Migrationen (passiert beim Compose-Start über den migrate-Service)
docker compose -f docker-compose.prod.yml run --rm migrate

# Stoppen
docker compose -f docker-compose.prod.yml down
```

Volumes (`pgdata`, `redisdata`, `uploads`, `caddy_data`) bleiben beim `down` erhalten. Löschen nur mit `down -v` — das wippt Daten und Zertifikate.

---

## Tests & Checks

```bash
pnpm test
pnpm typecheck
```

Abgedeckt: Rechte, Guild-Isolation, Auto-Mod, Audit-Picker, Level-Kurve, Embed-/Welcome-/Stream-Schemas, Moderations-Hierarchie.

---

## Sicherheit (kurz)

- Session nur als HttpOnly-Cookie, nicht im JSON.
- Guild-Zugriff über OAuth-Guilds + Owner / Admin / Manage Server / Manager-Rolle.
- Schreibzugriffe immer mit `guildId` aus der URL, nie aus dem Body.
- Production lehnt schwache Secrets und Default-DB-Passwörter ab.
- Details: [SECURITY.md](./SECURITY.md)

---

## Impressum

Vor dem Livegang in `apps/web/src/app/impressum/page.tsx` Name, Anschrift und E-Mail des Betreibers eintragen. Ohne diese Angaben ist das Impressum rechtlich unvollständig.

---

## Typische Fehler

| Symptom | Ursache |
|---|---|
| Bot startet nicht, `DISCORD_TOKEN` / `DATABASE_URL` required | `.env` fehlt oder Compose sieht die Datei nicht (`env_file: .env` im Projektroot) |
| Bot verbindet nicht, Dashboard schon | VM nur IPv6 — Discord braucht IPv4 |
| Login-Redirect-Fehler | Redirect in Discord Portal ≠ `DISCORD_REDIRECT_URI` |
| Kein Zertifikat | DNS zeigt noch nicht auf die VM, Port 80 zu, oder `ACME_EMAIL` leer |
| `SESSION_SECRET is too weak` | Beispielwert nicht durch `openssl rand -hex 32` ersetzt |
| Welcome-Bildkarte kommt nicht | Worker down oder `ASSET_DIR` nicht beschreibbar |
| Live-Alert speichert den Kanal nicht | Platform-Key fehlt (Twitch/YouTube/Kick) — das ist Absicht, kein Fake-Live-Status |
