# Device sync and shares

Mandala stays local-first: charts live in the browser, and both features here are optional. **Device sync** keeps the same charts on every device that holds a sync key. A **published share** is a read-only link that serves the latest version of one chart. Both use same-origin API routes in this app, backed by Turso in production. There is no separate worker, no WebSocket, no CORS.

## Device sync

Turned on from More actions, Sync devices (`SyncDialog.svelte`). The rules live in `src/lib/chart/sync/`.

### The key

`newSyncKey` makes 125 random bits, written as five groups of five (`k7m2q-9xw4t-…`). It is the only secret, and it never leaves the device but by the person's hand: the link `/#sync=<key>` keeps it in the hash, which the browser does not send. `normalizeSyncKey` reads a typed key in any case, with any spacing, and with `i`, `l`, `o` read as `1`, `1`, `0`.

From the key, HKDF derives two things (`syncSecrets`): a **room id**, which names this person's rows on the server, and an **AES-GCM key**, which seals each chart before it leaves. A chart is gzipped, then sealed with its chart id bound in, so a row moved under another id fails to open. The server holds only sealed rows and a hash of the room id, so a copy of the table is not enough to read a chart or to write into a room.

Losing the key loses the way back to the server copy, never the charts on a device. Any device that still syncs shows the key again.

### The rows

```sql
CREATE TABLE sync_rows (
	room TEXT NOT NULL,       -- SHA-256 of the room id the device sends
	id TEXT NOT NULL,         -- the chart's id
	size INTEGER NOT NULL,    -- characters in data, so a room's total is cheap to add up
	updated_at INTEGER NOT NULL,
	data TEXT,                -- the sealed chart, or NULL once deleted for good
	PRIMARY KEY (room, id)
)
```

A sealed chart is `{ id, updatedAt, deletedAt?, data }`: live, or in recently deleted with `deletedAt`. A row with no data is a chart deleted for good, kept so no device brings it back. Which chart is open is the device's own choice and never travels.

### API

All requests carry the room id in `x-sync-room`.

- `GET /api/sync?since=<ms>` → `{ rows: [{ id, data, at }], more }`, oldest first, 200 at a time.
- `PUT /api/sync/<chart id>` with `{ data }` and either `if-match: "<at in base 36>"` (write over the version read) or `if-none-match: *` (create). Returns `{ at }`, or 412 with `{ row }` as it is now when another device wrote first. A write with neither header gets 428. A room holds up to 1,000 rows, 2,000,000 characters a row, and 50,000,000 in all.
- 503 when the server has no database, so the dialog can say sync cannot run there.

### Limits (`lib/server/limit.ts`)

Each request is counted in fixed windows, in the `sync_limits` table, since serverless instances share nothing else. A request over any limit gets 429 with `retry-after`; the device waits that long, the dialog says it paused, and the menu row says Paused.

| Counted by | Limit |
| --- | --- |
| Room | 120 reads and 120 writes a minute |
| Address | 600 reads and 600 writes a minute, 200 MB written an hour, 50 new rooms a day |

A device reads every 45 seconds and writes two seconds after an edit, so one person stays far under the room limits. The address limits are wider because a phone network can put many people behind one address. The address is kept only as a hash, in a window that ends, and windows a day old are cleared.

### A round (`DeviceSync`, `device.svelte.ts`)

Rounds run on opening, on coming back to the tab or leaving it, on reconnecting, two seconds after a save changes the library, and every 45 seconds while the page is in view. One tab runs at a time (Web Locks), and every round starts from storage, so tabs never undo each other.

1. Read every row written since the last round (with two minutes of overlap, since server instances keep their own clocks), and open them. A row this version cannot read (another key, damage, a newer Mandala) is left alone and read again next time.
2. Plan each chart against its **base**, the copy this device last agreed with the server on (`planChart`, `plan.ts`). Changed only on the server: take it. Changed only here: send it over the base's version. Changed on both: this device's edits go on top of the server's copy (`overlayLocalEdits`) and the result goes both ways. Deleting for good wins over any edit, and a chart deleted for good that a stale tab brings back is taken off again.
3. Charts that came down replace the library's copies (`#adoptSynced` in the store). Lines typed while the round ran stay on top, and each adopted chart is stamped later than the copy it replaces, so another tab holding that copy does not keep it as newer. A device that just joined drops its one blank chart for the ones that arrived.
4. Send the planned charts. A 412 hands back the row; it is planned again and sent again, up to four times.

What has not gone up is found again by comparing the library with the bases, so nothing needs a queue: an edit made offline goes up on the next round that reaches the server. Bases and the read position live in `mandala-sync-v1`, the key in `mandala-sync-key`.

### How a chart merges (`sync.ts`)

Against the base, field by field: the goal, each pillar, each cell (words and id together), each action's `meta` by field, each day log list by list (`focus`, `checked`, `dropped`, `declined`, `shown`, `wrote`, sessions by id), tick times by action, each week's note, each shelf by link (a link's `opened` days as a list), site icons by host, the brief, the timer, and the passive weight. A field only this device changed comes from this device; everything else stays as the other device left it.

## Published share (`/s/[id]`)

One row in `charts`: an unguessable public id and an update secret the owner keeps in `mandala-share-secrets-v1`. `PUT /api/chart/<id>` with `x-chart-secret` replaces it, `GET` reads it (with an ETag), `DELETE` removes it. The page is a read-only snapshot, one fetch on open plus a refresh button. A share carries the plan, never the history (`forSharing`).

## Local development

```sh
# .env — a file: URL needs no account or token
TURSO_DATABASE_URL=file:./local/charts.db

bun run dev
```

Production: set `TURSO_DATABASE_URL` (libsql://) and `TURSO_AUTH_TOKEN` as Vercel env vars. The tables create themselves on the first request. Without them the app works as before, and the sync dialog says sync cannot run there.
