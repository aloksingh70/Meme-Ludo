# Ludo

Play Ludo on one screen, against the computer, or online with friends. Features authentic Pachisi cloth-style aesthetics, hop-by-hop arc token path animations, Web Audio synthesized sound effects, and an optional SQL account and match history system.

```
shared/   Rules engine, bot, path calculations and network protocol (pure TypeScript, no UI).
client/   React + Vite + Tailwind web app with SVG board, hop animation driver, and Web Audio synthesis.
server/   Node + Socket.io game server with native node:sqlite relational database and scrypt authentication.
RULES.md  The agreed rules.
```

## Run it
```bash
npm install

# terminal 1: the game server (port 3001)
npm run dev:server

# terminal 2: the web app (http://localhost:5173)
npm run dev
```
Pass-and-play and play-the-computer run locally with no server or account required.

```bash
npm test         # rules engine, path calculations, database migrations, SQL queries and server tests
npm run typecheck
```

## Features

### 1. Hop-by-Hop Token Animation
- Tokens hop square by square along the actual track and home lane in a parabolic arc with subtle shadow changes.
- Individual hops take ~120–150 ms per square, with total move duration capped at ~1.2 s.
- When an opponent token is captured, it remains on the capture square until the attacking token lands, then animates back to its home base slot.
- Fully respects `prefers-reduced-motion` by jumping directly to the destination without delay.
- In online play, the state transition queue coordinates with move animations so subsequent actions wait for hops to settle. Rejoining or refreshing renders the current board state instantly without replaying.

### 2. Synthesized Sound & Haptics
- Zero external audio files: all sounds are generated via the Web Audio API using custom oscillator and noise envelopes (die rattle, landing thud, soft hop ticks, capture snap, token home arrival chord, extra turn chime, turn indicators, and win fanfare).
- Audio context automatically unlocks on the first user interaction.
- Mute toggle accessible on every screen, with preference persisted in `localStorage`.
- Mobile vibration via `navigator.vibrate` for captures and game victories on supported devices.

### 3. Accounts, Match History & Leaderboard (SQL)
- Built with Node 24 native synchronous SQLite (`node:sqlite`) using hand-written portable SQL—no heavy ORMs.
- Versioned SQL migrations in `server/db/migrations/001_*.sql` applied automatically on server startup and tracked in `schema_migrations`.
- Secure authentication: passwords hashed using `scrypt` with per-user salts and constant-time comparison (`crypto.timingSafeEqual`); 256-bit cryptographic session tokens stored as SHA-256 hashes and delivered via `httpOnly`, `SameSite=Lax` cookies.
- Real SQL showcase queries:
  - Personal statistics including a gaps-and-islands window function calculating the player's longest win streak.
  - Keyset-paginated deterministic leaderboard (`wins DESC, win_rate DESC, total_games ASC, user_id ASC`) avoiding slow `OFFSET` scans.
  - Authoritative match persistence: only the server writes match outcomes and player metrics (captures made, times captured, sixes rolled) upon game completion in a single atomic transaction.
- Guests can play any mode without signing up. An account is purely optional for saving records and ranking on the leaderboard.
- Privacy-first design: no email required, and includes a one-click "Delete my account and data" action that removes the user and anonymizes past match player records (`ON DELETE SET NULL`).

## Configuration
| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | Port to listen on |
| `DB_PATH` | server | `server/db/ludo.db` | Path to SQLite database file |
| `CLIENT_ORIGIN` | server | `http://localhost:5173,http://127.0.0.1:5173` | Allowed web app origins for credentialed CORS |
| `VITE_SERVER_URL` | client (build time) | `http://localhost:3001` | Where the client reaches the backend API and socket server |

## Database Migrations
Migrations run automatically on server boot. Migration files are located in `server/db/migrations/` and named chronologically (e.g. `001_initial_schema.sql`). You can also inspect or test the database directly against in-memory instances using `npm test --workspace server`.

## Known Limits
- Active rooms in progress are maintained in server memory; restarting the server process terminates unfinished active games (only completed games are saved to the SQLite database).
- Single-server instance: scaling horizontally to multiple server processes would require swapping SQLite for PostgreSQL and sharing room state via Redis or an external broker.
- Web Audio requires an initial user interaction (click/tap) before audio can play due to browser autoplay policies.
- Haptic vibration relies on `navigator.vibrate`, which is supported on modern Android browsers but is not available on iOS Safari.
