import { morph } from "./morph";
import { newTool, opened } from "./tools";
import {
  blockOfK,
  blockOfKey,
  clockOf,
  completedBy,
  emptyChart,
  exportText,
  filledCount,
  getByKey,
  getDayLog,
  getMeta,
  getWeekReflection,
  hasContent,
  idx,
  pillarActivityLast7,
  progressMilestones,
  reflectionWeekOf,
  searchHits,
  setByKey,
  setMeta,
  STORAGE_KEY,
  todayKey,
  weekHadTicks,
  weekStartKey,
  wholeness,
  type ActionMeta,
  type ChartBrief,
  type ChartData,
  type DayLog,
  type Milestones,
  type ReflectAt,
  type Tool,
  type ToolKind,
  type WeekReflection,
} from "./model.ts";
import { isAccent, type AccentId } from "./accent.ts";
import {
  LIBRARY_KEY,
  activeRecord,
  cloneChart,
  deleteFromLibrary,
  emptyLibrary,
  flushActive,
  forgetManyFromLibrary,
  migrateFromV1,
  newRecord,
  parseLibrary,
  purgeLibrary,
  reconcile,
  restoreManyFromLibrary,
  summarize,
  summarizeDeleted,
  titleOf,
  TRASH_MS,
  type ChartLibrary,
  type ChartSummary,
  type DeletedSummary,
} from "./library.ts";
import {
  batchSubject,
  burstToast,
  placeSlip,
  SLIP_MS,
  type Slip,
} from "./toast.ts";
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
import { applySavedGoalFit } from "$lib/components/goal-fit";
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
export type ViewMode = "view" | "edit" | "split" | "today" | "calendar";
export type BackupState = "off" | "on" | "needs-permission";
export type ViewScale = "fit" | "large";

function loadInitialAccent(): AccentId {
  if (typeof window === "undefined") return "ink";
  try {
    const storedAccent = localStorage.getItem("accent");
    if (storedAccent && isAccent(storedAccent)) return storedAccent;
    if (storedAccent) localStorage.removeItem("accent");
    return "ink";
    return "ink";
  } catch {
    return "ink";
  }
}

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
    // The year view became the calendar.
    if (storedMode === "year") return "calendar";
    if (
      storedMode === "view" ||
      storedMode === "edit" ||
      storedMode === "split" ||
      storedMode === "today" ||
      storedMode === "calendar"
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
const REFLECT_KEY = "mandala_reflect";

function loadInitialReflectAt(): ReflectAt {
  const fallback: ReflectAt = { day: 0, hour: 18 };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(REFLECT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReflectAt>;
    const day = Number(parsed.day);
    const hour = Number(parsed.hour);
    if (!Number.isInteger(day) || day < 0 || day > 6) return fallback;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fallback;
    return { day, hour };
  } catch {
    return fallback;
  }
}
/** How long typing pauses before a line that made something whole counts as written. */
const HOLD_MS = 1400;

export class ChartStore {
  #library: ChartLibrary = $state(bootLibrary);
  data: ChartData = $state(cloneChart(activeRecord(bootLibrary).data));
  sel = $state(4);
  theme: AppTheme = $state(loadInitialTheme());
  accent: AccentId = $state(loadInitialAccent());
  viewMode: ViewMode = $state(loadInitialViewMode());
  viewScale: ViewScale = $state(loadInitialViewScale());
  query = $state("");
  status = $state("");
  /** Quiet label above the front slip. Empty for a one-line note. */
  statusKicker = $state("");
  /** The thing the front slip is about. */
  statusSubject = $state("");
  /** Repeats of the front slip's action. */
  statusCount = $state(0);
  /** Slips still on the clock. Newest is last. */
  slips: Slip[] = $state([]);
  exportFallback = $state("");
  saveWarned = $state(false);
  themeTick = $state(0);
  hoveredColorIndex = $state<number | null>(null);
  focusedKey = $state<string | null>(null);

  #saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** The library JSON this tab last wrote or read, so a change in storage can be told from its own. */
  #seen = "";
  #watching = false;
  #statusTimer: ReturnType<typeof setTimeout> | null = null;
  #slipSeq = 1;
  #toastsHeld = false;
  #toastPauseAt = 0;

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
  /**
   * What writing just made whole: pillars that got their last line, and the chart if it filled. It clears
   * itself after the moment, and it is never saved, so a reload does not replay it.
   */
  /** The weekly reflection is open. Any view can open it. */
  reflecting = $state(false);

  landed = $state<{ id: number; pillars: number[]; chart: boolean } | null>(
    null,
  );
  #landedTimer: ReturnType<typeof setTimeout> | null = null;
  /** What typing made whole, held while the person is still typing. It lands when the pen lifts. */
  #held: { done: { pillars: number[]; chart: boolean }; timer: ReturnType<typeof setTimeout> } | null = null;

  /** Now, as of the last time anything asked. A page left open overnight still sees the new offer. */
  #clockTick = $state(Date.now());
  /** When the week's reflection is offered. The person's own, so it holds across charts. */
  reflectAt: ReflectAt = $state(loadInitialReflectAt());
  /** The week whose reflection is on offer: the one whose offer time passed last. */
  reflectionWeek: string = $derived(reflectionWeekOf(this.reflectAt, new Date(this.#clockTick)));
  weekReflectionDue: boolean = $derived.by(() => {
    if (typeof window === "undefined") return false;
    const weekKey = this.reflectionWeek;
    const reflection = getWeekReflection(this.data, weekKey);
    if (reflection.dismissed || reflection.savedAt) return false;
    return weekHadTicks(this.data, weekKey);
  });

  setReflectAt(patch: Partial<ReflectAt>): void {
    this.reflectAt = { ...this.reflectAt, ...patch };
    this.#clockTick = Date.now();
    try {
      localStorage.setItem(REFLECT_KEY, JSON.stringify(this.reflectAt));
    } catch {
      // storage blocked
    }
  }

  load(): void {
    this.#watchStorage();
    try {
      const rawLibrary = localStorage.getItem(LIBRARY_KEY);
      if (rawLibrary) {
        const parsed = parseLibrary(rawLibrary);
        if (parsed) {
          this.#seen = rawLibrary;
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
    this.#applySavedGoalFit();
  }

  #applySavedGoalFit(): void {
    if (typeof window === "undefined") return;
    applySavedGoalFit(this.data.goal, this.viewMode, this.viewScale, window.innerWidth);
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

  /** Puts the open chart's lines into its record. True when they had changed since the last flush. */
  #flush(): boolean {
    const changed =
      JSON.stringify(activeRecord(this.#library).data) !== JSON.stringify(this.data);
    this.#library.charts = flushActive(
      this.#library.charts,
      this.#library.activeId,
      this.data,
    );
    return changed;
  }

  saveNow(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    const edited = this.#flush();
    this.#catchUp(edited ? this.#library.activeId : null);
    try {
      const raw = JSON.stringify(this.#library);
      localStorage.setItem(LIBRARY_KEY, raw);
      this.#seen = raw;
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
    this.#catchUp(null);
    try {
      const raw = JSON.stringify(this.#library);
      localStorage.setItem(LIBRARY_KEY, raw);
      this.#seen = raw;
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

  /**
   * Another tab may have written the library since this tab last looked: a chart it made, edited, deleted or
   * restored. Writing over that loses it, so what storage holds comes in first. `keep` names the chart being
   * edited here, whose lines stay this tab's.
   */
  #catchUp(keep: string | null): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LIBRARY_KEY);
    } catch {
      return;
    }
    if (!raw || raw === this.#seen) return;
    this.#seen = raw;
    const stored = parseLibrary(raw);
    if (!stored) return;
    const was = this.#library.activeId;
    this.#library = reconcile(this.#library, stored, keep);
    this.#follow(was, keep !== null);
  }

  /** Storage changed under this tab: the library another tab wrote comes in, and the chart in view follows. */
  #absorb(raw: string): void {
    if (raw === this.#seen) return;
    this.#seen = raw;
    const stored = parseLibrary(raw);
    if (!stored) return;
    const editing = this.#flush() || this.#saveTimer !== null;
    const was = this.#library.activeId;
    this.#library = reconcile(this.#library, stored, editing ? was : null);
    this.#follow(was, editing);
    // Lines written here and not yet saved ride on top, and go out with the next save.
    if (editing) this.save();
  }

  /** The chart in view after a merge: another one if its own went away, or its lines if they changed elsewhere. */
  #follow(was: string, editing: boolean): void {
    const record = activeRecord(this.#library);
    if (record.id !== was) {
      this.data = cloneChart(record.data);
      this.#resetView();
      this.#adoptShareState();
      this.#applySavedGoalFit();
    } else if (!editing && JSON.stringify(record.data) !== JSON.stringify(this.data)) {
      this.data = cloneChart(record.data);
    }
  }

  #watchStorage(): void {
    if (this.#watching || typeof window === "undefined") return;
    this.#watching = true;
    window.addEventListener("storage", (event) => {
      if (event.key === LIBRARY_KEY && event.newValue) this.#absorb(event.newValue);
    });
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
    this.#place({
      key: message,
      kicker: "",
      subject: message,
      keep,
    });
  }

  /** Named slip. Repeats of the same action while it is still in the pile stamp the count. */
  note(kicker: string, subject: string, amount = 1, mixedBatch = false): void {
    this.#applyNote(this.#copySlips(), kicker, subject, amount, mixedBatch);
  }

  /** Put back what the showing slip deleted. */
  undoSlip(): void {
    const front = this.slips.at(-1);
    if (!front || front.undo.length === 0) return;
    const ids = front.undo;
    this.slips = this.slips.filter((slip) => slip.id !== front.id);
    this.restoreCharts(ids);
  }

  /** Pause every slip's clock while the pointer is on the pile. */
  holdToasts(held: boolean): void {
    if (held === this.#toastsHeld) return;
    const now = Date.now();
    if (held) {
      this.#toastsHeld = true;
      this.#toastPauseAt = now;
      if (this.#statusTimer) clearTimeout(this.#statusTimer);
      this.#statusTimer = null;
      return;
    }
    const paused = now - this.#toastPauseAt;
    this.#toastsHeld = false;
    this.slips = this.slips.map((slip) =>
      slip.until === Number.POSITIVE_INFINITY
        ? slip
        : { ...slip, until: slip.until + paused },
    );
    this.#dropExpired();
  }

  #copySlips(): Slip[] {
    return this.slips.map((slip) => ({ ...slip }));
  }

  /** `held` is the pile from before a save, so a storage warning cannot reset the count. */
  #applyNote(
    held: Slip[],
    kicker: string,
    subject: string,
    amount: number,
    mixedBatch: boolean,
    undo: string[] = [],
  ): void {
    this.slips = held;
    this.#place({
      key: kicker,
      kicker,
      subject,
      amount,
      mixedBatch,
      undo,
    });
  }

  #place(input: {
    key: string;
    kicker: string;
    subject: string;
    amount?: number;
    mixedBatch?: boolean;
    keep?: boolean;
    undo?: string[];
  }): void {
    const placed = placeSlip(this.slips, Date.now(), this.#slipSeq, input);
    this.slips = placed.pile;
    this.#slipSeq = placed.nextId;
    this.#syncFront();
    this.#armToastTimer();
  }

  #syncFront(): void {
    const front = this.slips.at(-1);
    if (!front) {
      this.status = "";
      this.statusKicker = "";
      this.statusSubject = "";
      this.statusCount = 0;
      return;
    }
    this.statusKicker = front.kicker;
    this.statusSubject = front.kicker ? front.subject : "";
    this.statusCount = front.count;
    this.status = front.kicker
      ? burstToast(front.kicker, front.subject, front.count, front.mixed)
      : front.subject;
  }

  #armToastTimer(): void {
    if (this.#statusTimer) clearTimeout(this.#statusTimer);
    this.#statusTimer = null;
    if (this.#toastsHeld) return;
    const finite = this.slips.filter(
      (slip) => slip.until < Number.POSITIVE_INFINITY,
    );
    if (finite.length === 0) return;
    const next = Math.min(...finite.map((slip) => slip.until));
    const wait = Math.max(0, next - Date.now());
    this.#statusTimer = setTimeout(() => this.#dropExpired(), wait);
  }

  #dropExpired(): void {
    if (this.#toastsHeld) return;
    const now = Date.now();
    this.slips = this.slips.filter((slip) => slip.until > now);
    this.#syncFront();
    this.#armToastTimer();
  }

  select(blockIndex: number): void {
    this.sel = blockIndex;
  }

  /** `animate` false switches at once, for setup code that changes more right after. */
  setViewMode(mode: ViewMode, animate = true): void {
    const apply = (): void => {
      this.viewMode = mode;
      document.documentElement.dataset.view = mode;
      try {
        localStorage.setItem("mandala_view_mode", mode);
      } catch {
        // storage blocked
      }
      this.#applySavedGoalFit();
    };
    if (mode === this.viewMode || !animate) apply();
    else morph(apply);
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
    this.#applySavedGoalFit();
  }

  setQuery(value: string): void {
    this.query = value;
  }

  /**
   * `quiet` when the caller says what happened itself, as Bindu's moment does: the ring still plays, and
   * lines landing together make one moment at once. A typed line waits for the pen to lift instead.
   */
  setText(key: string, value: string, quiet = false): void {
    const before = wholeness(this.data);
    setByKey(this.data, key, value);
    this.save();
    if (key === "g") this.#applySavedGoalFit();
    const after = wholeness(this.data);
    const done = completedBy(before, after);
    if (quiet) {
      if (done.pillars.length > 0 || done.chart) this.#land(done, quiet);
      return;
    }
    this.#hold(done, after);
  }

  /** Keeps what typing made whole until typing pauses or the field is left. A line cleared again lets go. */
  #hold(done: { pillars: number[]; chart: boolean }, now: { pillars: boolean[]; chart: boolean }): void {
    const held = this.#held;
    if (held) clearTimeout(held.timer);
    const pillars = [...new Set([...(held?.done.pillars ?? []), ...done.pillars])]
      .filter((pillarIndex) => now.pillars[pillarIndex])
      .sort((a, b) => a - b);
    const chart = (Boolean(held?.done.chart) || done.chart) && now.chart;
    this.#held =
      pillars.length > 0 || chart
        ? { done: { pillars, chart }, timer: setTimeout(() => this.settle(), HOLD_MS) }
        : null;
  }

  /** The pen lifted: the field was left, or typing paused. What it made whole lands now, if it still is. */
  settle(): void {
    const held = this.#held;
    if (!held) return;
    clearTimeout(held.timer);
    this.#held = null;
    const now = wholeness(this.data);
    const done = {
      pillars: held.done.pillars.filter((pillarIndex) => now.pillars[pillarIndex]),
      chart: held.done.chart && now.chart,
    };
    if (done.pillars.length > 0 || done.chart) this.#land(done, false);
  }

  /** Writing made something whole. Several lines landing together (a fill) read as one moment. */
  #land(done: { pillars: number[]; chart: boolean }, quiet: boolean): void {
    const current = this.landed;
    this.landed = {
      id: (current?.id ?? 0) + 1,
      pillars: [...new Set([...(current?.pillars ?? []), ...done.pillars])].sort(
        (a, b) => a - b,
      ),
      chart: Boolean(current?.chart) || done.chart,
    };
    if (done.chart && !quiet) this.say("Chart complete. All 64 actions are written.");
    if (this.#landedTimer) clearTimeout(this.#landedTimer);
    this.#landedTimer = setTimeout(() => (this.landed = null), 3200);
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

  /** `replaced`: Bindu swapped the whole list, so the old picks were not taken off by hand. */
  setFocus(dateKey: string, keys: string[], replaced = false): void {
    if (!this.data.days) this.data.days = {};
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    const removed = replaced ? [] : existing.focus.filter((key) => !keys.includes(key));
    const dropped = [...(existing.dropped ?? []).filter((key) => !keys.includes(key)), ...removed];
    const log: DayLog = { ...existing, focus: keys, started: true, dropped: dropped.length > 0 ? [...new Set(dropped)] : undefined };
    this.data.days[dateKey] = log;
    this.data = { ...this.data };
    this.save();
  }

  toggleChecked(dateKey: string, key: string): void {
    if (!this.data.days) this.data.days = {};
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    const isChecked = existing.checked.includes(key);
    const at = { ...existing.at };
    if (isChecked) delete at[key];
    else at[key] = clockOf(new Date());
    const log: DayLog = {
      ...existing,
      checked: isChecked
        ? existing.checked.filter((checkedKey) => checkedKey !== key)
        : [...existing.checked, key],
      at: Object.keys(at).length > 0 ? at : undefined,
    };
    this.data.days[dateKey] = log;
    this.data = { ...this.data };
    this.save();
  }

  /** Bindu's suggestions turned down today, so they are not offered again today. */
  declineToday(keys: string[]): void {
    if (keys.length === 0) return;
    if (!this.data.days) this.data.days = {};
    const dateKey = todayKey();
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    this.data.days[dateKey] = { ...existing, declined: [...new Set([...(existing.declined ?? []), ...keys])] };
    this.data = { ...this.data };
    this.save();
  }

  /** Insights Bindu has shown today, so the greeting does not repeat itself. */
  noteShown(signature: string): void {
    if (!this.data.days) this.data.days = {};
    const dateKey = todayKey();
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    if (existing.shown?.includes(signature)) return;
    this.data.days[dateKey] = { ...existing, shown: [...(existing.shown ?? []), signature] };
    this.data = { ...this.data };
    this.save();
  }

  /** A link that arrived by share or paste, waiting for a shelf. */
  pendingLink = $state<string | null>(null);

  offerLink(url: string): void {
    this.pendingLink = url;
  }

  addTool(pillarIndex: number, url: string, title = "", kind: ToolKind = "repeat"): Tool {
    const tool = newTool(url, title, kind);
    const key = `p${pillarIndex}`;
    const tools = { ...this.data.tools, [key]: [...(this.data.tools?.[key] ?? []), tool] };
    this.data = { ...this.data, tools };
    this.save();
    return tool;
  }

  updateTool(pillarIndex: number, id: string, patch: Partial<Tool>): void {
    this.#patchTool(pillarIndex, id, (tool) => {
      const next = { ...tool, ...patch };
      // Clearing a field removes it, so the saved chart stays small.
      for (const field of ["action", "known", "opened"] as const) if (next[field] === undefined) delete next[field];
      return next;
    });
  }

  removeTool(pillarIndex: number, id: string): void {
    const key = `p${pillarIndex}`;
    const rest = (this.data.tools?.[key] ?? []).filter((tool) => tool.id !== id);
    const tools = { ...this.data.tools };
    if (rest.length > 0) tools[key] = rest;
    else delete tools[key];
    this.data = { ...this.data, tools: Object.keys(tools).length > 0 ? tools : undefined };
    this.save();
  }

  /** The person opened it. Today is logged, and a once tool leaves the rotation. */
  openTool(pillarIndex: number, id: string): void {
    this.#patchTool(pillarIndex, id, (tool) => opened(tool));
  }

  #patchTool(pillarIndex: number, id: string, change: (tool: Tool) => Tool): void {
    const key = `p${pillarIndex}`;
    const list = this.data.tools?.[key];
    if (!list?.some((tool) => tool.id === id)) return;
    this.data = {
      ...this.data,
      tools: { ...this.data.tools, [key]: list.map((tool) => (tool.id === id ? change(tool) : tool)) },
    };
    this.save();
  }

  /** Replaces what Bindu kept from the draft. An empty brief is removed. */
  setBrief(brief: ChartBrief | undefined): void {
    const next = brief && Object.values(brief).some((value) => value?.trim()) ? brief : undefined;
    this.data = { ...this.data, brief: next };
    this.save();
  }

  saveWeekReflection(
    weekKey: string,
    patch: Partial<{ note: string; swapped: string[] }>,
  ): void {
    if (!this.data.weeks) this.data.weeks = {};
    const existing = getWeekReflection(this.data, weekKey);
    const week: WeekReflection = { ...existing, ...patch, savedAt: todayKey() };
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
    if (theme === this.theme) return;
    morph(() => {
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
    }, "theme");
  }

  setAccent(accent: AccentId): void {
    if (accent === this.accent) return;
    morph(() => {
      this.accent = accent;
      try {
        if (accent === "ink") {
          localStorage.removeItem("accent");
          document.documentElement.removeAttribute("data-accent");
        } else {
          localStorage.setItem("accent", accent);
          document.documentElement.setAttribute("data-accent", accent);
        }
      } catch {
        // private mode / storage blocked
      }
    }, "theme");
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
    const title = titleOf(this.data);
    const held = this.#copySlips();
    this.data = emptyChart();
    this.saveNow();
    this.#applyNote(held, "Cleared", title, 1, false);
  }

  importChart(importedData: ChartData, message = "Chart imported."): boolean {
    return this.#fillOrSpawn(importedData, message);
  }

  /** `quiet` when the caller says it itself, as Bindu does with its own moment. */
  applyDraft(next: ChartData, quiet = false): boolean {
    return this.#fillOrSpawn(
      next,
      quiet ? null : "Draft ready. Edit any cell to make it yours.",
    );
  }

  newChart(): boolean {
    this.#flush();
    const record = newRecord(emptyChart());
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = emptyChart();
    this.#resetView();
    const held = this.#copySlips();
    this.saveNow();
    this.#applyNote(held, "New", titleOf(this.data), 1, false);
    return true;
  }

  duplicateChart(): boolean {
    this.#flush();
    const record = newRecord(this.data);
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = cloneChart(record.data);
    this.#resetView();
    const title = titleOf(this.data);
    const held = this.#copySlips();
    this.saveNow();
    this.#applyNote(held, "Duplicated", title, 1, false);
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
    const doomed = this.#library.charts.find((item) => item.id === id);
    const title = doomed ? titleOf(doomed.data) : titleOf(this.data);
    const next = deleteFromLibrary(this.#library, id);
    if (!next) return;
    const activeChanged = next.activeId !== this.#library.activeId;
    this.#library = next;
    if (activeChanged) {
      this.data = cloneChart(activeRecord(next).data);
      this.#resetView();
      this.#adoptShareState();
      this.#applySavedGoalFit();
    }
    const held = this.#copySlips();
    this.saveNow();
    this.#applyNote(held, "Deleted", title, 1, false, [id]);
  }

  restoreChart(id: string): void {
    this.restoreCharts([id]);
  }

  restoreCharts(ids: string[]): void {
    if (ids.length === 0) return;
    this.#flush();
    const now = Date.now();
    const want = new Set(ids);
    const titles = this.#library.deleted
      .filter((row) => want.has(row.id) && now - row.deletedAt < TRASH_MS)
      .map((row) => titleOf(row.data));
    const next = restoreManyFromLibrary(this.#library, ids, now);
    if (!next || titles.length === 0) return;
    const batch = batchSubject(titles);
    const held = this.#copySlips();
    this.#library = next;
    this.data = cloneChart(activeRecord(next).data);
    this.#resetView();
    this.#adoptShareState();
    this.#applySavedGoalFit();
    this.saveNow();
    this.#applyNote(held, "Restored", batch.subject, titles.length, batch.mixed);
  }

  forgetChart(id: string): void {
    this.forgetCharts([id]);
  }

  forgetCharts(ids: string[]): void {
    if (ids.length === 0) return;
    const want = new Set(ids);
    const titles = this.#library.deleted
      .filter((row) => want.has(row.id))
      .map((row) => titleOf(row.data));
    const next = forgetManyFromLibrary(this.#library, ids);
    if (!next || titles.length === 0) return;
    const batch = batchSubject(titles);
    const held = this.#copySlips();
    this.#library = next;
    this.saveNow();
    this.#applyNote(held, "Removed", batch.subject, titles.length, batch.mixed);
  }

  #fillOrSpawn(next: ChartData, message: string | null): boolean {
    if (!this.dirty) {
      this.data = cloneChart(next);
      this.#resetView();
      this.saveNow();
      if (message) this.say(message);
      return true;
    }
    this.#flush();
    const record = newRecord(next);
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = cloneChart(next);
    this.#resetView();
    this.saveNow();
    if (message) this.say(message);
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
  applySavedGoalFit(chart.data.goal, chart.viewMode, chart.viewScale, window.innerWidth);
  requestAnimationFrame(() => {
    document.documentElement.dataset.chartMotion = "";
  });
}
