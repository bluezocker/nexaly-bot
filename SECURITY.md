# Security notes (Nexaly)

## Auth

- Discord OAuth2 with one-time Redis state (10 min). State cookie is compared when present.
- Session is an opaque ID in an HttpOnly `SameSite=Lax` cookie. The browser never sees a session id in JSON.
- The web BFF copies `x-nexaly-session` onto the cookie after the server-side callback.
- Logout deletes the DB session and the Redis OAuth token.

## Tenancy

- Every guild route authorizes via the user's OAuth guild list + owner/admin/manage/manager-role.
- Mutations scope Prisma writes with `guildId` from the URL, never from the body (`strict()` Zod schemas).
- Deletes use `deleteMany({ id, guildId })`.

## Moderation

- Role hierarchy is enforced before kick/ban/timeout. Owner and the bot cannot be targeted.
- Auto-mod does not invent “malware” from URL substrings. Allow/block lists match hostnames only.

## Logs

- `actorId` is set only when exactly one audit-log entry matches target, action and time window.

## Secrets

- Production refuses a `SESSION_SECRET` that looks like the example value.
- Production refuses the compose default `nexaly:nexaly` database URL.
- `.env` is gitignored. Images do not copy `.env`.

## Docker

- App ports bind to `127.0.0.1`.
- Containers run as user `nexaly`.
- Postgres/Redis healthchecks gate the app profile.

## Remaining limitations

- Twitch EventSub webhook is not wired; live detection polls Helix.
- YouTube live checks cost Data API quota.
- IMAGE welcome cards need the worker; TEXT/EMBED do not.
- Cookie `Secure` is only set when `NODE_ENV=production`. Use TLS in front of the web process.
