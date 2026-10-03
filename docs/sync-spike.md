# Sync and sharing

Mandala stays local-first: charts live in the browser and every sync surface
is optional. Both features ride on one SQLite table (`charts`) behind
same-origin API routes in this app (`src/routes/api/chart/[key]`), backed by
Turso in production. There is no separate worker, no WebSocket, no CORS.

The model is **whole-chart last write wins**: one row, one `updated_at`,
replace the JSON. Field merge was deliberately skipped — with one person and
one device at a time, the second device pulls the first device's chart before
anyone types, so per-field merge only matters in a rare corner.

## The row

```sql
CREATE TABLE charts (
	key TEXT PRIMARY KEY,
	secret TEXT NOT NULL,
	data TEXT NOT NULL,
	updated_at INTEGER NOT NULL
)
```

The same shape serves both surfaces. Reads only need the key; writes and
deletes need the row's secret.

- **Device sync**: the key is the owner's personal sync key, and the key
  doubles as the secret. Off by default; `chart.enableSync(key)` persists it
  in localStorage.
- **Published share**: the key is an unguessable public id; the owner keeps
  the secret in localStorage (`mandala-share-secrets-v1`).

## API (`/api/chart/<key>`)

- `GET` → `{ chart, updatedAt }`, or 404. Supports `if-none-match` with an
  `updatedAt`-derived ETag → 304 when unchanged.
- `PUT` with `x-chart-secret` and `{ chart }` → creates the row or replaces
  it, returns `{ updatedAt }`. Wrong secret → 403.
- `DELETE` with `x-chart-secret` → removes the row.

## Device sync flow (`src/lib/chart/chart.svelte.ts`)

1. **Pull on open** (`pullSync`, called on resume and `enableSync`): fetch the
   row. No row → this device seeds it. Row newer than the device's last
   synced snapshot (`mandala-sync-state-v1`: `{ room, updatedAt, data }`) →
   adopt it.
2. **Push after edits** (debounced `pushSync` from `save()`): before the PUT,
   check the row. If the server moved ahead since this device last synced,
   `overlayLocalEdits` (`src/lib/chart/sync/sync.ts`, tested) re-applies only
   this device's own changes onto the server copy, then pushes the result.
   A stale tab therefore can't clobber newer work with yesterday's chart.
3. Adopting a pulled chart flows through `saveNow` while a re-entrancy guard
   is up, so pulls never trigger pushes of their own content.

`syncStatus` is `off | syncing | synced | error`; nothing in the app UI calls
`enableSync` yet — `/dev/sync` is the harness.

## Share page (`/s/[id]`)

Read-only snapshot of the row. One fetch on open plus a manual refresh
button; no polling. Visitors need no configuration — the API is same-origin,
which is exactly why the sync worker (with its placeholder URL and
cross-origin fetches) was removed.

## Local development

```sh
# .env — a file: URL needs no account or token
TURSO_DATABASE_URL=file:./local/charts.db

bun run dev
```

Production: set `TURSO_DATABASE_URL` (libsql://) and `TURSO_AUTH_TOKEN`
as Vercel env vars. The table creates itself on first request.

## Remaining caveats

- A sync key is a password: whoever holds it can read and overwrite the row.
- First-time enable with content on both sides adopts the cloud copy; there
  is no three-way merge for that case.
- Rows grow one per sync key / share id; there is no garbage collection of
  abandoned keys.
