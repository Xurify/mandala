import {
  blockOfK,
  blockOfKey,
  emptyChart,
  exportText,
  filledCount,
  getDayLog,
  getMeta,
  getWeekReflection,
  getByKey,
  hasContent,
  idx,
  pillarActivityLast7,
  progressMilestones,
  searchHits,
  setByKey,
  setMeta,
  STORAGE_KEY,
  todayKey,
  weekStartKey,
  type ActionMeta,
  type ChartData,
  type DayLog,
  type Milestones,
  type WeekReflection,
} from "./model.ts";
import {
  LIBRARY_KEY,
  activeRecord,
  cloneChart,
  deleteFromLibrary,
  emptyLibrary,
  flushActive,
  forgetFromLibrary,
  migrateFromV1,
  newRecord,
  parseLibrary,
  purgeLibrary,
  restoreFromLibrary,
  summarize,
  summarizeDeleted,
  type ChartLibrary,
  type ChartSummary,
  type DeletedSummary,
} from "./library.ts";
import {
  fetchRow,
  publishChart,
  pushRow,
  unpublishChart,
} from "./sync/publish.ts";
import { overlayLocalEdits } from "./sync/sync.ts";

export type SyncStatus = "off" | "syncing" | "synced" | "error";
const SYNC_ROOM_KEY = "mandala-sync-room";
const SYNC_STATE_KEY = "mandala-sync-state-v1";
import { exampleChart, isExampleChart } from "./example.ts";
import { bindGoalFit } from "$lib/components/goal-fit";
import { buildChart, type Preset } from "./presets/index.ts";
import {
  clearBackupHandle,
  loadBackupHandle,
  pickBackupDirectory,
  queryBackupPermission,
  requestBackupPermission,
  saveBackupHandle,
  supportsDirectoryPicker,
  writeBackupFile,
} from "./backup.ts";

export type AppTheme = "system" | "light" | "dark";
export type ViewMode = "view" | "edit" | "split" | "today" | "year";
export type BackupState = "off" | "on" | "needs-permission";
export type ViewScale = "fit" | "large";

function loadInitialTheme(): AppTheme {
  if (typeof window === "undefined") return "system";
  try {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }
    return "system";
  } catch {
    return "system";
  }
}

function loadInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "view";
  try {
    const storedMode = localStorage.getItem("mandala_view_mode");
    if (
      storedMode === "view" ||
      storedMode === "edit" ||
      storedMode === "split" ||
      storedMode === "today" ||
      storedMode === "year"
    ) {
      return storedMode;
    }
    return "view";
  } catch {
    return "view";
  }
}

function loadInitialViewScale(): ViewScale {
  if (typeof window === "undefined") return "fit";
  try {
    const storedScale = localStorage.getItem("mandala_view_scale");
    if (storedScale === "fit" || storedScale === "large") {
      return storedScale;
    }
    return "fit";
  } catch {
    return "fit";
  }
}

function loadInitialLibrary(): ChartLibrary {
  if (typeof window === "undefined") {
    return emptyLibrary();
  }
  try {
    const rawLibrary = localStorage.getItem(LIBRARY_KEY);
    if (rawLibrary) {
      const parsed = parseLibrary(rawLibrary);
      if (parsed) return purgeLibrary(parsed);
    }
    return migrateFromV1(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyLibrary();
  }
}

const bootLibrary = loadInitialLibrary();

// Per-chart share state (published id, last push time, auto-republish flag).
const SHARE_STATE_KEY = "mandala-share-state-v1";

export class ChartStore {
  #library: ChartLibrary = $state(bootLibrary);
  data: ChartData = $state(cloneChart(activeRecord(bootLibrary).data));
  sel = $state(4);
  theme: AppTheme = $state(loadInitialTheme());
  viewMode: ViewMode = $state(loadInitialViewMode());
  viewScale: ViewScale = $state(loadInitialViewScale());
  query = $state("");
  status = $state("");
  exportFallback = $state("");
  saveWarned = $state(false);
  themeTick = $state(0);
  hoveredColorIndex = $state<number | null>(null);
  focusedKey = $state<string | null>(null);

  #saveTimer: ReturnType<typeof setTimeout> | null = null;
  #statusTimer: ReturnType<typeof setTimeout> | null = null;

  #backupHandle: FileSystemDirectoryHandle | null = null;
  backupState: BackupState = $state("off");
  backupLastAt = $state<number | null>(null);
  #backupWarned = false;

  // Device sync: one cloud row per personal sync key. Pull on open, push
  // (debounced) after edits. A stale device re-applies its unsynced edits onto
  // a newer server copy before pushing instead of clobbering it — see
  // overlayLocalEdits. Off until enabled; the key lives in localStorage so
  // every device that enters the same key shares one row.
  #syncBase: ChartData | null = null; // last snapshot this device synced
  #syncBaseAt = 0;
  #syncBusy = false;
  #syncApplying = false;
  #syncTimer: ReturnType<typeof setTimeout> | null = null;
  syncEnabled = $state(false);
  syncStatus = $state<SyncStatus>("off");
  syncRoom = $state("");

  shareId = $state("");
  shareUpdatedAt = $state<number | null>(null);
  autoShare = $state(false);
  shareBusy = $state(false);
  #shareTimer: ReturnType<typeof setTimeout> | null = null;
  #shareChartId = "";

  filled = $derived(filledCount(this.data));
  hits = $derived(searchHits(this.data, this.query));
  dirty = $derived(hasContent(this.data));
  milestones: Milestones = $derived(progressMilestones(this.data));
  charts: ChartSummary[] = $derived(
    summarize(this.#library.charts, this.#library.activeId, this.data),
  );
  deletedCharts: DeletedSummary[] = $derived(
    summarizeDeleted(this.#library.deleted),
  );
  activeId = $derived(this.#library.activeId);
  chartCount = $derived(this.#library.charts.length);

  todayLog: DayLog = $derived(getDayLog(this.data, todayKey()));
  pillarActivity: number[] = $derived(pillarActivityLast7(this.data));
  weekReflectionDue: boolean = $derived.by(() => {
    if (typeof window === "undefined") return false;
    const now = new Date();
    if (now.getDay() !== 0) return false;
    const weekKey = weekStartKey(now);
    const reflection = getWeekReflection(this.data, weekKey);
    if (reflection.dismissed) return false;
    const hasDayLogThisWeek = this.pillarActivity.some((count) => count > 0);
    return hasDayLogThisWeek;
  });

  load(): void {
    try {
      const rawLibrary = localStorage.getItem(LIBRARY_KEY);
      if (rawLibrary) {
        const parsed = parseLibrary(rawLibrary);
        if (parsed) {
          const next = purgeLibrary(parsed);
          this.#adopt(next);
          if (next !== parsed) this.#writeLibrary();
          this.#resumeSync();
          return;
        }
      }
      this.#adopt(migrateFromV1(localStorage.getItem(STORAGE_KEY)));
      this.saveNow();
    } catch {
      // private mode / blocked storage
    }
  }

  #adopt(library: ChartLibrary): void {
    this.#library = library;
    this.data = cloneChart(activeRecord(library).data);
    this.sel = 4;
    this.query = "";
    this.#adoptShareState();
    this.#bindGoalFit();
  }

  #bindGoalFit(): void {
    if (typeof window === "undefined") return;
    bindGoalFit(this.data.goal, this.viewMode, this.viewScale, window.innerWidth);
  }

  #adoptShareState(): void {
    const chartId = this.#library.activeId;
    this.#shareChartId = chartId;
    try {
      const raw = localStorage.getItem(SHARE_STATE_KEY);
      const all = raw
        ? (JSON.parse(raw) as Record<
            string,
            { id: string; updatedAt: number | null; auto: boolean }
          >)
        : {};
      const entry = all[chartId];
      this.shareId = entry?.id ?? "";
      this.shareUpdatedAt = entry?.updatedAt ?? null;
      this.autoShare = entry?.auto ?? false;
    } catch {
      this.shareId = "";
      this.shareUpdatedAt = null;
      this.autoShare = false;
    }
  }

  #persistShareState(): void {
    try {
      const raw = localStorage.getItem(SHARE_STATE_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      all[this.#shareChartId] = {
        id: this.shareId,
        updatedAt: this.shareUpdatedAt,
        auto: this.autoShare,
      };
      localStorage.setItem(SHARE_STATE_KEY, JSON.stringify(all));
    } catch {}
  }

  #resetView(): void {
    this.sel = 4;
    this.query = "";
    this.focusedKey = null;
  }

  #flush(): void {
    this.#library.charts = flushActive(
      this.#library.charts,
      this.#library.activeId,
      this.data,
    );
  }

  saveNow(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.#flush();
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(this.#library));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      if (!this.saveWarned) {
        this.saveWarned = true;
        this.say(
          "Your browser blocked saving, so this chart will be lost when you close the page.",
        );
      }
    }
    if (this.backupState === "on") void this.#writeBackup();
  }

  /** Persist the library without treating the open chart as edited. */
  #writeLibrary(): void {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(this.#library));
    } catch {
      if (!this.saveWarned) {
        this.saveWarned = true;
        this.say(
          "Your browser blocked saving, so this chart will be lost when you close the page.",
        );
      }
    }
    if (this.backupState === "on") void this.#writeBackup();
  }

  purgeExpired(): void {
    const next = purgeLibrary(this.#library);
    if (next === this.#library) return;
    this.#library = next;
    this.#writeLibrary();
  }

  save(): void {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.saveNow(), 300);
    // Keep the public share page current without a manual push.
    if (this.autoShare && this.shareId) this.#scheduleAutoPublish();
    if (this.syncEnabled) this.#scheduleSyncPush();
  }

  say(message: string, keep = false): void {
    this.status = message;
    if (this.#statusTimer) clearTimeout(this.#statusTimer);
    if (!keep) {
      this.#statusTimer = setTimeout(() => {
        this.status = "";
      }, 5000);
    }
  }

  select(blockIndex: number): void {
    this.sel = blockIndex;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    document.documentElement.dataset.view = mode;
    try {
      localStorage.setItem("mandala_view_mode", mode);
    } catch {
      // storage blocked
    }
    this.#bindGoalFit();
  }

  setViewScale(scale: ViewScale): void {
    this.viewScale = scale;
    if (scale === "large") document.documentElement.dataset.scale = "large";
    else delete document.documentElement.dataset.scale;
    try {
      localStorage.setItem("mandala_view_scale", scale);
    } catch {
      // storage blocked
    }
    this.#bindGoalFit();
  }

  setQuery(value: string): void {
    this.query = value;
  }

  setText(key: string, value: string): void {
    setByKey(this.data, key, value);
    this.save();
    if (key === "g") this.#bindGoalFit();
  }

  textOf(key: string): string {
    return getByKey(this.data, key);
  }

  metaOf(key: string): ActionMeta | undefined {
    return getMeta(this.data, key);
  }

  setActionMeta(key: string, patch: Partial<ActionMeta>): void {
    setMeta(this.data, key, patch);
    this.data = { ...this.data };
    this.save();
  }

  toggleDone(key: string): void {
    const current = getMeta(this.data, key);
    const isDone = !current?.done;
    const patch: Partial<ActionMeta> = {
      kind: current?.kind ?? "milestone",
      done: isDone,
      doneAt: isDone ? todayKey() : undefined,
    };
    setMeta(this.data, key, patch);
    this.data = { ...this.data };
    this.save();
  }

  setFocus(dateKey: string, keys: string[]): void {
    if (!this.data.days) this.data.days = {};
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    const log: DayLog = { ...existing, focus: keys, started: true };
    this.data.days[dateKey] = log;
    this.data = { ...this.data };
    this.save();
  }

  toggleChecked(dateKey: string, key: string): void {
    if (!this.data.days) this.data.days = {};
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    const isChecked = existing.checked.includes(key);
    const log: DayLog = {
      ...existing,
      checked: isChecked
        ? existing.checked.filter((checkedKey) => checkedKey !== key)
        : [...existing.checked, key],
    };
    this.data.days[dateKey] = log;
    this.data = { ...this.data };
    this.save();
  }

  saveWeekReflection(
    weekKey: string,
    patch: Partial<{ note: string; swapped: string[] }>,
  ): void {
    if (!this.data.weeks) this.data.weeks = {};
    const existing = getWeekReflection(this.data, weekKey);
    const week: WeekReflection = { ...existing, ...patch };
    this.data.weeks[weekKey] = week;
    this.data = { ...this.data };
    this.save();
  }

  dismissWeekNotice(weekKey: string): void {
    if (!this.data.weeks) this.data.weeks = {};
    const existing = getWeekReflection(this.data, weekKey);
    const week: WeekReflection = { ...existing, dismissed: true };
    this.data.weeks[weekKey] = week;
    this.data = { ...this.data };
    this.save();
  }

  #resumeSync(): void {
    try {
      const room = localStorage.getItem(SYNC_ROOM_KEY);
      if (!room) return;
      this.syncEnabled = true;
      this.syncRoom = room;
      this.#loadSyncState(room);
      void this.pullSync();
    } catch {
      // storage blocked
    }
  }

  #loadSyncState(room: string): void {
    try {
      const raw = localStorage.getItem(SYNC_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        room: string;
        updatedAt: number;
        data: ChartData;
      };
      if (parsed.room !== room) return;
      this.#syncBase = parsed.data;
      this.#syncBaseAt = parsed.updatedAt;
    } catch {
      // corrupt or blocked state; the next pull rebuilds it
    }
  }

  #persistSyncState(): void {
    if (!this.#syncBase) return;
    try {
      localStorage.setItem(
        SYNC_STATE_KEY,
        JSON.stringify({
          room: this.syncRoom,
          updatedAt: this.#syncBaseAt,
          data: this.#syncBase,
        }),
      );
    } catch {
      // storage blocked; sync still works, just without the stale guard
    }
  }

  /** Pulls the sync row and reconciles it with local edits. Safe to call again. */
  async pullSync(): Promise<void> {
    if (!this.syncEnabled || this.#syncBusy || !this.syncRoom) return;
    this.#syncBusy = true;
    this.syncStatus = "syncing";
    try {
      const remote = await fetchRow(this.syncRoom, this.#syncBaseAt || null);
      if (remote.unchanged) {
        this.syncStatus = "synced";
        return;
      }
      if (remote.chart && remote.updatedAt !== null) {
        // A device that edited while the server moved ahead re-applies its
        // own edits on top instead of clobbering the newer copy.
        const merged = this.#syncBase
          ? overlayLocalEdits(this.#syncBase, this.data, remote.chart)
          : cloneChart(remote.chart);
        if (JSON.stringify(merged) !== JSON.stringify(this.data)) {
          this.#adoptSync(merged);
          this.say("Pulled the latest from your other device.");
        }
        this.#syncBase = cloneChart(merged);
        this.#syncBaseAt = remote.updatedAt;
        this.#persistSyncState();
        if (JSON.stringify(merged) !== JSON.stringify(remote.chart)) {
          // Local edits rode on top; share the result with the other device.
          await this.#putSync(merged);
        }
        this.syncStatus = "synced";
      } else {
        // Nothing in the cloud yet: this device seeds the row.
        await this.#putSync(this.data);
        this.syncStatus = "synced";
      }
    } catch {
      this.syncStatus = "error";
    } finally {
      this.#syncBusy = false;
    }
  }

  /** Pushes the whole chart; pulls first so a stale tab can't clobber newer work. */
  async pushSync(): Promise<void> {
    if (!this.syncEnabled || this.#syncBusy || !this.syncRoom) return;
    this.#syncBusy = true;
    this.syncStatus = "syncing";
    try {
      const remote = await fetchRow(this.syncRoom, this.#syncBaseAt || null);
      let outgoing = this.data;
      if (
        remote.chart &&
        remote.updatedAt !== null &&
        remote.updatedAt !== this.#syncBaseAt &&
        this.#syncBase
      ) {
        outgoing = overlayLocalEdits(this.#syncBase, this.data, remote.chart);
        this.#adoptSync(outgoing);
      }
      await this.#putSync(outgoing);
      this.syncStatus = "synced";
    } catch {
      this.syncStatus = "error";
    } finally {
      this.#syncBusy = false;
    }
  }

  async #putSync(data: ChartData): Promise<void> {
    const result = await pushRow(this.syncRoom, this.syncRoom, data);
    this.#syncBase = cloneChart(data);
    this.#syncBaseAt = result.updatedAt;
    this.#persistSyncState();
  }

  #adoptSync(data: ChartData): void {
    this.#syncApplying = true;
    try {
      this.data = data;
      this.saveNow();
    } finally {
      this.#syncApplying = false;
    }
  }

  #scheduleSyncPush(): void {
    if (this.#syncApplying) return;
    if (this.#syncTimer) clearTimeout(this.#syncTimer);
    this.#syncTimer = setTimeout(() => {
      this.#syncTimer = null;
      void this.pushSync();
    }, 1200);
  }

  enableSync(room: string): void {
    const trimmed = room.trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) {
      this.say("Sync key needs 8 to 64 letters, numbers, or dashes.");
      return;
    }
    try {
      localStorage.setItem(SYNC_ROOM_KEY, trimmed);
    } catch {
      // storage blocked; sync still works for this session
    }
    this.syncEnabled = true;
    this.syncRoom = trimmed;
    this.#loadSyncState(trimmed);
    void this.pullSync();
    this.say("Sync on. Charts follow you to devices with the same key.");
  }

  disableSync(): void {
    this.syncEnabled = false;
    this.syncStatus = "off";
    this.syncRoom = "";
    this.#syncBase = null;
    this.#syncBaseAt = 0;
    if (this.#syncTimer) {
      clearTimeout(this.#syncTimer);
      this.#syncTimer = null;
    }
    try {
      localStorage.removeItem(SYNC_ROOM_KEY);
      localStorage.removeItem(SYNC_STATE_KEY);
    } catch {
      // storage blocked
    }
    this.say("Sync off.");
  }

  /** Publishes the active chart (first time creates, after that updates). */
  async publishShare(): Promise<void> {
    if (this.shareBusy) return;
    this.shareBusy = true;
    try {
      const result = await publishChart(this.data, this.shareId || null);
      this.shareId = result.id;
      this.shareUpdatedAt = result.updatedAt;
      this.#persistShareState();
    } finally {
      this.shareBusy = false;
    }
  }

  /** Stops sharing and clears the auto-republish flag. */
  async stopSharing(): Promise<void> {
    if (!this.shareId) return;
    const id = this.shareId;
    this.shareId = "";
    this.shareUpdatedAt = null;
    this.autoShare = false;
    this.#persistShareState();
    await unpublishChart(id);
  }

  /** Turns auto-republish on or off; on, it pushes soon after any edit. */
  setAutoShare(on: boolean): void {
    this.autoShare = on;
    this.#persistShareState();
    if (on) {
      if (!this.shareId) void this.#autoPublish();
      else this.#scheduleAutoPublish();
    } else {
      this.#cancelAutoPublish();
    }
  }

  #scheduleAutoPublish(): void {
    if (this.#shareTimer) clearTimeout(this.#shareTimer);
    this.#shareTimer = setTimeout(() => {
      this.#shareTimer = null;
      void this.#autoPublish();
    }, 4000);
  }

  #cancelAutoPublish(): void {
    if (this.#shareTimer) {
      clearTimeout(this.#shareTimer);
      this.#shareTimer = null;
    }
  }

  async #autoPublish(): Promise<void> {
    if (!this.autoShare || !this.shareId || this.shareBusy) return;
    this.shareBusy = true;
    try {
      const result = await publishChart(this.data, this.shareId);
      this.shareUpdatedAt = result.updatedAt;
      this.#persistShareState();
    } catch {
      // Retry on the next edit; the page still serves the last good snapshot.
      this.#scheduleAutoPublish();
    } finally {
      this.shareBusy = false;
    }
  }

  exported(): string {
    return exportText(this.data);
  }

  jumpToKey(key: string): void {
    this.select(blockOfKey(key));
    this.focusedKey = key;
    if (this.viewMode === "view" || this.viewMode === "today") {
      this.setViewMode("edit");
    }
  }

  clearFocusedKey(): void {
    this.focusedKey = null;
  }

  selectGoal(): void {
    this.sel = 4;
  }

  selectPillar(pillarIndex: number): void {
    this.sel = blockOfK(pillarIndex);
  }

  selectNextPillar(): void {
    if (this.sel === 4) {
      this.sel = blockOfK(0);
    } else {
      const currentPillar = idx(this.sel);
      const nextPillar = (currentPillar + 1) % 8;
      this.sel = blockOfK(nextPillar);
    }
  }

  selectPreviousPillar(): void {
    if (this.sel === 4) {
      this.sel = blockOfK(7);
    } else {
      const currentPillar = idx(this.sel);
      const previousPillar = (currentPillar + 7) % 8;
      this.sel = blockOfK(previousPillar);
    }
  }

  setTheme(theme: AppTheme): void {
    this.theme = theme;
    try {
      if (theme === "system") {
        localStorage.removeItem("theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
      }
    } catch {
      // private mode / storage blocked
    }
    this.bumpTheme();
  }

  applyPreset(preset: Preset): boolean {
    return this.#fillOrSpawn(
      buildChart(preset),
      `${preset.title} preset loaded. Edit any cell to make it yours.`,
    );
  }

  loadExample(): boolean {
    return this.#fillOrSpawn(
      exampleChart(),
      "Example chart loaded. Edit any cell to make it yours.",
    );
  }

  checkForMatchingExample(): { id: string; active: boolean } | null {
    if (isExampleChart(this.data)) {
      return { id: this.#library.activeId, active: true };
    }
    let best: { id: string; updatedAt: number } | null = null;
    for (const record of this.#library.charts) {
      if (record.id === this.#library.activeId) continue;
      if (!isExampleChart(record.data)) continue;
      if (!best || record.updatedAt > best.updatedAt) {
        best = { id: record.id, updatedAt: record.updatedAt };
      }
    }
    if (!best) return null;
    return { id: best.id, active: false };
  }

  clearAll(): void {
    this.data = emptyChart();
    this.saveNow();
    this.say("Chart cleared.");
  }

  importChart(importedData: ChartData, message = "Chart imported."): boolean {
    return this.#fillOrSpawn(importedData, message);
  }

  applyDraft(next: ChartData): boolean {
    return this.#fillOrSpawn(
      next,
      "Draft ready. Edit any cell to make it yours.",
    );
  }

  newChart(): boolean {
    this.#flush();
    const record = newRecord(emptyChart());
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = emptyChart();
    this.#resetView();
    this.saveNow();
    this.say("New chart.");
    return true;
  }

  duplicateChart(): boolean {
    this.#flush();
    const record = newRecord(this.data);
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = cloneChart(record.data);
    this.#resetView();
    this.saveNow();
    this.say("Chart duplicated.");
    return true;
  }

  switchChart(id: string): void {
    if (id === this.#library.activeId) return;
    const record = this.#library.charts.find((chart) => chart.id === id);
    if (!record) return;
    this.#flush();
    this.#library.activeId = id;
    this.data = cloneChart(record.data);
    this.#resetView();
    this.saveNow();
  }

  deleteChart(id: string): void {
    this.#flush();
    const next = deleteFromLibrary(this.#library, id);
    if (!next) return;
    const activeChanged = next.activeId !== this.#library.activeId;
    this.#library = next;
    if (activeChanged) {
      this.data = cloneChart(activeRecord(next).data);
      this.#resetView();
      this.#adoptShareState();
      this.#bindGoalFit();
    }
    this.saveNow();
    this.say("Chart deleted.");
  }

  restoreChart(id: string): void {
    this.#flush();
    const next = restoreFromLibrary(this.#library, id);
    if (!next) return;
    this.#library = next;
    this.data = cloneChart(activeRecord(next).data);
    this.#resetView();
    this.#adoptShareState();
    this.#bindGoalFit();
    this.saveNow();
    this.say("Chart restored.");
  }

  forgetChart(id: string): void {
    const next = forgetFromLibrary(this.#library, id);
    if (!next) return;
    this.#library = next;
    this.saveNow();
    this.say("Chart removed.");
  }

  #fillOrSpawn(next: ChartData, message: string): boolean {
    if (!this.dirty) {
      this.data = cloneChart(next);
      this.#resetView();
      this.saveNow();
      this.say(message);
      return true;
    }
    this.#flush();
    const record = newRecord(next);
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = cloneChart(next);
    this.#resetView();
    this.saveNow();
    this.say(message);
    return true;
  }

  bumpTheme(): void {
    this.themeTick += 1;
  }

  async restoreBackupHandle(): Promise<void> {
    if (!supportsDirectoryPicker()) return;
    const handle = await loadBackupHandle();
    if (!handle) return;
    this.#backupHandle = handle;
    const permission = await queryBackupPermission(handle);
    if (permission === "granted") {
      this.backupState = "on";
      await this.#writeBackup();
    } else {
      this.backupState = "needs-permission";
    }
  }

  async enableBackups(): Promise<void> {
    try {
      const handle = await pickBackupDirectory();
      if (!handle) return;
      this.#backupHandle = handle;
      await saveBackupHandle(handle);
      this.backupState = "on";
      await this.#writeBackup();
      this.say("Backups on. Your charts now save to that folder as you edit.");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      this.say("Could not open a backup folder here.");
    }
  }

  async resumeBackups(): Promise<void> {
    const handle = this.#backupHandle;
    if (!handle) return;
    const permission = await requestBackupPermission(handle);
    if (permission === "granted") {
      this.backupState = "on";
      await this.#writeBackup();
      this.say("Backups resumed.");
    } else {
      this.say("Backup permission was not granted.");
    }
  }

  async disableBackups(): Promise<void> {
    this.#backupHandle = null;
    this.backupState = "off";
    this.backupLastAt = null;
    await clearBackupHandle();
    this.say("Backups turned off.");
  }

  async #writeBackup(): Promise<void> {
    const handle = this.#backupHandle;
    if (!handle) return;
    try {
      await writeBackupFile(handle, JSON.stringify(this.#library));
      this.backupLastAt = Date.now();
    } catch (error) {
      if ((error as DOMException)?.name === "NotAllowedError") {
        this.backupState = "needs-permission";
        return;
      }
      if (!this.#backupWarned) {
        this.#backupWarned = true;
        this.say("Backup write failed. Charts still save in this browser.");
      }
    }
  }
}

export const chart = new ChartStore();

if (typeof document !== "undefined") {
  document.documentElement.dataset.view = chart.viewMode;
  if (chart.viewScale === "large")
    document.documentElement.dataset.scale = "large";
  else delete document.documentElement.dataset.scale;
  bindGoalFit(chart.data.goal, chart.viewMode, chart.viewScale, window.innerWidth);
  requestAnimationFrame(() => {
    document.documentElement.dataset.chartMotion = "";
  });
}
