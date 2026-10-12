# Ready for cloud sync

Mandala keeps everything in the browser today. This page is the contract that keeps local features from drifting away from a future cloud sync, and the list of what that sync still needs. `docs/sync-spike.md` describes the device-sync prototype that exists now.

## The contract

`src/lib/chart/contract.ts` places every field of a saved chart in one of four reaches:

| Reach | Travels | Today |
| --- | --- | --- |
| `shared` | With anyone, by link or published share, and between your devices | the goal, pillars, actions, whether an action is a routine or a one-time step, pinned, the shelves' links |
| `asked` | Between your devices, and to another person only when that share includes it | an action's `note` and its board `details` (Include notes, in Export) |
| `yours` | Between your own devices, never to another person | everything that happened while the chart was worked (`days` with ticks and time logged, `weeks`, done marks, the board's lanes, `cleared`, what was opened from a shelf and when, the running `timer`), the `brief`, site `icons` |
| `device` | Nowhere | nothing inside a chart; see the browser keys below |

It also says which part of the chart each field is. `plan` is the chart and how it is set up; `history` is what happened while it was worked. Copy without history keeps only `plan` (`withoutHistory` in `library.ts`). History is never `shared`: a person you send a chart to gets the plan, not your days.

It also lists every key the app keeps in the browser (`BROWSER_KEYS`). The library is the one cloud sync replaces. The rest belong to the device: theme, accent, the view, the chat app, share secrets, the prototype's sync state.

Two checks keep it honest:

- A new field on `ChartData`, `ActionMeta`, `DayLog`, `Session`, `Timer`, `WeekReflection`, `Tool`, or `ChartBrief` fails `bun run check` until `contract.ts` places it.
- `contract.test.ts` fails when `forSharing` (`share.ts`) gives away anything not `shared` (or `asked`, when notes are included), or keeps anything that is, when `withoutHistory` keeps history or drops plan, when a history field is `shared`, and when a `localStorage` key appears in the code that `BROWSER_KEYS` does not list, or a listed one is no longer used.

So a feature that saves something new has to decide where it goes, in the same change.

## Already safe

- **Nothing unreadable is lost.** `parseLibrary` keeps every chart it can read. A chart it cannot (from a newer version, or damaged) is set aside under `mandala-held` before the library is written back, and a library that cannot be read at all is kept there whole before the app starts fresh.
- **Newer charts are refused, not trimmed.** `parseChart` returns null for a `version` above `CHART_VERSION`, so an older app never drops fields it does not know and writes the rest back.
- **Remote charts are read like local ones.** `fetchRow` runs `parseChart` on what the server sends, and fails loudly on a chart it cannot read instead of treating it as missing, which would let this device write over it.
- **One record of done.** Today's tick, the board's Done, and the editor's Mark done write the action's `done`/`doneAt` and the day's tick together (`finish`, `reopen` in `board.ts`), so no view can disagree with another after a merge that keeps both halves.
- **Everything has an id that says what it is.** Charts, actions, tools, and shares get a TypeID from `id.ts`: `chart_…`, `action_…`, `tool_…`, `share_…`, then a UUIDv7 in base32, so ids sort by when they were made and fit a UUID column on a server. Days and weeks are keyed by their date, and pillars by their place, on purpose: two devices ticking the same day land in the same log, and a pillar's hue and angle belong to its place.
- **An action is its id, not its cell.** `meta`, ticks, and a tool kept for an action point at `actionIds`, never at `a{k}_{j}`. A line keeps its id while its words change. A cleared line gets a new id, and what pointed at the old one stays with it: `cleared` keeps its words and place, so its days still name it, and the same words back in the same place bring it back whole. A duplicate, an import, or a share gets new action ids (`withNewIds`), so no two charts hold the same action.
- **The prototype carries one chart.** Sync remembers the chart it was turned on for, and does not push or pull while another is open.

## Still to do before cloud sync

Ordered by how much each would cost to get wrong.

1. **Sync the library, not the open chart.** One row per chart id, plus tombstones for deleted charts kept on the server for good. The prototype's single row cannot carry more than one chart.
2. **Merge per field, not per chart.** Today the library takes the later chart whole, and the prototype replaces a whole day log, so two devices ticking on the same day lose one side. Use per-field last write wins with a hybrid logical clock, and set union for `checked`, `focus`, and `dropped`. Merge tools by id. Merge a cell's id and words as one value, and when one side cleared a line the other side ticked, write its `cleared` record in the merge.
3. **Compare and swap on the server.** The PUT reads, then writes. Send the version it read (`If-Match`), answer 412 when it moved, and merge again.
4. **Ranks set only on the card that moved.** To do and Doing renumber the whole list on every move, so two devices moving cards touch many keys and collide. Use fractional ranks between the neighbours. `rank` on a done card is a timestamp; give it its own field.
5. **Times with a zone.** Day keys and `doneAt` are local dates, and tick times are local `HH:MM`. Keep the date keys (they are what the person lived), and store a UTC time with the offset beside each tick, so two devices in different zones agree on order.
6. **The open chart is the device's.** `activeId` lives inside the library; move it to a device key so syncing does not switch charts under someone.
7. **Room to grow.** Site icons can reach 96KB each; store them once by content hash outside the chart. Move the library from `localStorage` (about 5MB) to IndexedDB before `days` and the trash outgrow it.
8. **Pushes that wait.** A push skipped while another runs is not retried, and nothing goes out as the page closes. Keep a queue of pending changes and drain it.
9. **Share ownership on the server.** A share's update secret lives on the device that published it, so another device cannot update it. Tie shares to the account once there is one.
