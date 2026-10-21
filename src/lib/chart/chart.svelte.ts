import { morph } from "./morph";
import { applyChange, finish as finishAction, leftToday, moveCard as cardMove, reopen as reopenAction, type Change, type Lane } from "./board.ts";
import type { Goal } from "./calendar.ts";
import { newTool, opened, toolInChart } from "./tools";
import {
  blockOfK,
  blockOfKey,
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
  isActionId,
  idOfKey,
  keyOf,
  pillarActivityLast7,
  progressMilestones,
  reflectionWeekOf,
  searchHits,
  setByKey,
  setMeta,
  todayKey,
  weekHadTicks,
  weekStartKey,
  wholeness,
  withNewIds,
  type ActionId,
  type ActionMeta,
  type ChartData,
  type DayLog,
  type Milestones,
  type ReflectAt,
  type Ref,
  type Session,
  type Timer,
  PASSIVE_WEIGHT,
  parsePassiveWeight,
  type SessionMode,
  type Tool,
  type ToolKind,
  type WeekReflection,
} from "./model.ts";
import { DEFAULT_ACCENT, type AccentId } from "./accent.ts";
import { accentOf, applyAccent, applyTheme, saveAccent, saveTheme, themeOf, type AppTheme } from "./theme.ts";
import {
  LIBRARY_KEY,
  activeRecord,
  cloneChart,
  deleteFromLibrary,
  deleteManyFromLibrary,
  emptyLibrary,
  flushActive,
  forgetManyFromLibrary,
  newRecord,
  heldRows,
  parseLibrary,
  purgeLibrary,
  reconcile,
  restoreManyFromLibrary,
  summarize,
  summarizeDeleted,
  titleOf,
  withoutHistory,
  TRASH_MS,
  type ChartLibrary,
  type ChartSummary,
  type DeletedSummary,
} from "./library.ts";
import {
  batchSubject,
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
import { ingest as ingestSessions, ingestWords, type IngestRequest, type IngestResult } from "./ingest.ts";
import {
  addSession,
  BREAK_MINUTES,
  formatMinutes,
  isForgotten,
  isOver,
  sessionEndingAt,
  sessionOf,
  actionLabel,
} from "./timer.ts";

export type TimerEnd = {
  id: number;
  kind: "stopped" | "block" | "break";
  action?: ActionId;
  minutes: number;
};

export type SyncStatus = "off" | "syncing" | "synced" | "error";
const SYNC_ROOM_KEY = "mandala-sync-room";
const SYNC_STATE_KEY = "mandala-sync-state-v1";
const HELD_KEY = "mandala-held";
import { exampleChart, isExampleChart } from "./example.ts";
import { applySavedGoalFit } from "$lib/components/goal-fit";
import { buildChart, getPreset, type Preset, type PresetId } from "./presets/index.ts";
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

export type { AppTheme } from "./theme.ts";
export type ViewMode = "view" | "edit" | "split" | "today" | "calendar" | "board";
export type ChartLayout = "view" | "edit" | "split";

function isLayout(mode: ViewMode): mode is ChartLayout {
  return mode === "view" || mode === "edit" || mode === "split";
}
export type BackupState = "off" | "on" | "needs-permission";
export type ViewScale = "fit" | "large";

function loadInitialAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    return accentOf(localStorage.getItem("accent"));
  } catch {
    return DEFAULT_ACCENT;
  }
}

function loadInitialTheme(): AppTheme {
  if (typeof window === "undefined") return "system";
  try {
    return themeOf(localStorage.getItem("theme"));
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
      storedMode === "calendar" ||
      storedMode === "board"
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
    return emptyLibrary();
  } catch {
    return emptyLibrary();
  }
}

const bootLibrary = loadInitialLibrary();

const START_SHEET_KEY = "mandala_start_sheet";

type StartSheetState = { chartId: string; borrowedPreset: PresetId | null };

function loadStartSheetState(): StartSheetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(START_SHEET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StartSheetState>;
    if (typeof parsed.chartId !== "string") return null;
    const presetId = parsed.borrowedPreset;
    const borrowedPreset = typeof presetId === "string" && getPreset(presetId) ? (presetId as PresetId) : null;
    return { chartId: parsed.chartId, borrowedPreset };
  } catch {
    return null;
  }
}

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
  chartLayout: ChartLayout = $state(isLayout(this.viewMode) ? this.viewMode : "view");
  viewScale: ViewScale = $state(loadInitialViewScale());
  query = $state("");
  slips: Slip[] = $state([]);
  exportFallback = $state("");
  saveWarned = $state(false);
  themeTick = $state(0);
  hoveredColorIndex = $state<number | null>(null);
  #unhoverTimer: ReturnType<typeof setTimeout> | null = null;

  hoverColor(colorIndex: number): void {
    if (this.#unhoverTimer) clearTimeout(this.#unhoverTimer);
    this.#unhoverTimer = null;
    this.hoveredColorIndex = colorIndex;
  }

  /** Waits a beat, so crossing the gap to the next cell does not switch the highlight off and on again. */
  unhoverColor(): void {
    if (this.#unhoverTimer) clearTimeout(this.#unhoverTimer);
    this.#unhoverTimer = setTimeout(() => {
      this.#unhoverTimer = null;
      this.hoveredColorIndex = null;
    }, 90);
  }
  focusedKey = $state<string | null>(null);
  face = $state<"actions" | "shelf">("actions");

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

  #syncBase: ChartData | null = null;
  /** The chart sync was turned on for. The prototype carries one chart, so others never go out under its key. */
  #syncChart = "";
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
  shareNotes = $state(false);
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
  #startSheet: StartSheetState | null = $state(loadStartSheetState());
  inStartSheet = $derived(this.#startSheet?.chartId === this.#library.activeId);
  borrowedPreset: PresetId | null = $derived(this.inStartSheet ? (this.#startSheet?.borrowedPreset ?? null) : null);
  chartCount = $derived(this.#library.charts.length);
  calendarScope = $state("all");
  goals: Goal[] = $derived(
    this.#library.charts.map((record) => {
      const data = record.id === this.#library.activeId ? this.data : record.data;
      return { id: record.id, title: titleOf(data), data };
    }),
  );

  /** The local date. It rolls over at midnight and when the page wakes, so a tab left open ticks into the right day. */
  today = $state(todayKey());
  elsewhere: { id: string; title: string; left: number }[] = $derived(
    this.goals.flatMap((goal) => {
      if (goal.id === this.#library.activeId) return [];
      const left = leftToday(goal.data, this.today);
      return left > 0 ? [{ id: goal.id, title: goal.title, left }] : [];
    }),
  );
  todayLog: DayLog = $derived(getDayLog(this.data, this.today));
  pillarActivity: number[] = $derived(pillarActivityLast7(this.data));
  reflecting = $state(false);
  selecting = $state(false);
  browsingShelves = $state(false);
  duplicating = $state(false);
  /** A tool whose settings the shelf opens on, when a door elsewhere asks for them. Never saved. */
  shelfTool = $state<string | null>(null);

  landed = $state<{ id: number; pillars: number[]; chart: boolean } | null>(
    null,
  );
  #landedTimer: ReturnType<typeof setTimeout> | null = null;
  #held: { done: { pillars: number[]; chart: boolean }; timer: ReturnType<typeof setTimeout> } | null = null;

  /** Now, as of the last time anything asked. A page left open overnight still sees the new offer. */
  #clockTick = $state(Date.now());
  reflectAt: ReflectAt = $state(loadInitialReflectAt());
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
    } catch {}
  }

  load(): void {
    this.#watchStorage();
    this.#watchDay();
    try {
      const rawLibrary = localStorage.getItem(LIBRARY_KEY);
      if (rawLibrary) {
        const parsed = parseLibrary(rawLibrary);
        this.#setAside(rawLibrary, parsed === null);
        if (parsed) {
          this.#seen = rawLibrary;
          const next = purgeLibrary(parsed);
          this.#adopt(next);
          if (next !== parsed) this.#writeLibrary();
          this.#resumeSync();
          return;
        }
      }
      this.#adopt(emptyLibrary());
      this.saveNow();
    } catch {}
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
            { id: string; updatedAt: number | null; auto: boolean; notes?: boolean }
          >)
        : {};
      const entry = all[chartId];
      this.shareId = entry?.id ?? "";
      this.shareUpdatedAt = entry?.updatedAt ?? null;
      this.autoShare = entry?.auto ?? false;
      this.shareNotes = entry?.notes === true;
    } catch {
      this.shareId = "";
      this.shareUpdatedAt = null;
      this.autoShare = false;
      this.shareNotes = false;
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
        notes: this.shareNotes,
      };
      localStorage.setItem(SHARE_STATE_KEY, JSON.stringify(all));
    } catch {}
  }

  #resetView(): void {
    this.sel = 4;
    this.query = "";
    this.focusedKey = null;
    this.timerEnd = null;
    this.loggingTime = null;
  }

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
    this.#setAside(raw, stored === null);
    if (!stored) return;
    const was = this.#library.activeId;
    this.#library = reconcile(this.#library, stored, keep);
    this.#follow(was, keep !== null);
  }

  /**
   * Sets aside what this version cannot read (a newer version's chart, a damaged row, or the whole library),
   * under its own key, before the library is written back without it.
   */
  #setAside(raw: string, whole: boolean): void {
    const rows = whole ? [raw] : heldRows(raw);
    if (rows.length === 0) return;
    try {
      const before = JSON.parse(localStorage.getItem(HELD_KEY) ?? "[]") as unknown;
      const kept: unknown[] = Array.isArray(before) ? before : [];
      const seen = new Set(kept.map((row) => JSON.stringify(row)));
      const added = rows.filter((row) => !seen.has(JSON.stringify(row)));
      if (added.length > 0) localStorage.setItem(HELD_KEY, JSON.stringify([...kept, ...added]));
    } catch {}
  }

  #absorb(raw: string): void {
    if (raw === this.#seen) return;
    this.#seen = raw;
    const stored = parseLibrary(raw);
    this.#setAside(raw, stored === null);
    if (!stored) return;
    const editing = this.#flush() || this.#saveTimer !== null;
    const was = this.#library.activeId;
    this.#library = reconcile(this.#library, stored, editing ? was : null);
    this.#follow(was, editing);
    // Lines written here and not yet saved ride on top, and go out with the next save.
    if (editing) this.save();
  }

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

  #watchingDay = false;

  #watchDay(): void {
    if (this.#watchingDay || typeof window === "undefined") return;
    this.#watchingDay = true;
    const roll = (): void => {
      this.#clockTick = Date.now();
      const now = todayKey();
      if (now !== this.today) this.today = now;
    };
    const atMidnight = (): void => {
      const next = new Date();
      next.setHours(24, 0, 1, 0);
      setTimeout(() => {
        roll();
        atMidnight();
      }, next.getTime() - Date.now());
    };
    atMidnight();
    // Timers stall while a laptop sleeps or a phone tab is frozen; waking is the other way the day turns over.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") roll();
    });
    window.addEventListener("focus", roll);
  }

  #watchStorage(): void {
    if (this.#watching || typeof window === "undefined") return;
    this.#watching = true;
    window.addEventListener("storage", (event) => {
      if (event.key === LIBRARY_KEY && event.newValue) this.#absorb(event.newValue);
      else if (event.key === "theme") this.#followTheme(themeOf(event.newValue));
      else if (event.key === "accent") this.#followAccent(accentOf(event.newValue));
    });
  }

  #followTheme(theme: AppTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    applyTheme(theme);
    this.bumpTheme();
  }

  #followAccent(accent: AccentId): void {
    if (accent === this.accent) return;
    this.accent = accent;
    applyAccent(accent);
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

  note(kicker: string, subject: string, amount = 1, mixedBatch = false): void {
    this.#applyNote(this.#copySlips(), kicker, subject, amount, mixedBatch);
  }

  undoSlip(): void {
    const front = this.slips.at(-1);
    if (!front || front.undo.length === 0) return;
    const ids = front.undo;
    this.slips = this.slips.filter((slip) => slip.id !== front.id);
    const tools = ids.filter((id) => this.#removedTools.has(id));
    for (const token of tools) this.#restoreTool(token);
    const time = ids.filter((id) => this.#removedTime.has(id));
    for (const token of time) this.#restoreTime(token);
    this.restoreCharts(ids.filter((id) => !tools.includes(id) && !time.includes(id)));
  }

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
    this.#armToastTimer();
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
    this.#armToastTimer();
  }

  select(blockIndex: number): void {
    this.sel = blockIndex;
  }

  setViewMode(mode: ViewMode, animate = true): void {
    const apply = (): void => {
      this.viewMode = mode;
      if (isLayout(mode)) this.chartLayout = mode;
      document.documentElement.dataset.view = mode;
      try {
        localStorage.setItem("mandala_view_mode", mode);
      } catch {}
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
    } catch {}
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
    const was = getByKey(this.data, key).trim();
    setByKey(this.data, key, value);
    if (value.trim() && value.trim() !== was) this.#noteWritten(key);
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

  #noteWritten(key: string): void {
    const id = isActionId(key) ? key : idOfKey(this.data, key);
    if (!id) return;
    const existing = this.data.days?.[this.today] ?? { focus: [], checked: [] };
    if (existing.wrote?.includes(id)) return;
    this.data.days = { ...this.data.days, [this.today]: { ...existing, wrote: [...(existing.wrote ?? []), id] } };
  }

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

  textOf(ref: Ref): string {
    return getByKey(this.data, ref);
  }

  metaOf(id: ActionId): ActionMeta | undefined {
    return getMeta(this.data, id);
  }

  setActionMeta(id: ActionId, patch: Partial<ActionMeta>): void {
    setMeta(this.data, id, patch);
    this.data = { ...this.data };
    this.save();
  }

  toggleDone(id: ActionId): void {
    if (getMeta(this.data, id)?.done) this.reopen(id);
    else this.finish(id);
  }

  finish(id: ActionId): void {
    this.#apply(finishAction(this.data, id, this.today));
  }

  reopen(id: ActionId): void {
    this.#apply(reopenAction(this.data, id, this.today));
  }

  moveCard(id: ActionId, lane: Lane, index: number): boolean {
    const change = cardMove(this.data, id, lane, index, this.today);
    if (!change) return false;
    const timer = this.data.timer;
    const wasToday = timer?.action === id && getDayLog(this.data, this.today).focus.includes(id);
    this.#apply(change);
    if (wasToday && timer && !getDayLog(this.data, this.today).focus.includes(id)) {
      const stopped = this.#timerOff(timer, id);
      this.data = { ...this.data };
      this.save();
      this.say(stopped);
    }
    return true;
  }

  #apply(change: Change): void {
    if (!applyChange(this.data, change)) return;
    this.data = { ...this.data };
    this.save();
  }

  /**
   * `replaced`: Bindu swapped the whole list, so the old picks were not taken off by hand. Returns what happened to a
   * stopwatch on an action taken off today, which it has already said.
   */
  setFocus(dateKey: string, ids: ActionId[], replaced = false): string | null {
    if (!this.data.days) this.data.days = {};
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    const removed = replaced ? [] : existing.focus.filter((id) => !ids.includes(id));
    const dropped = [...(existing.dropped ?? []).filter((id) => !ids.includes(id)), ...removed];
    const log: DayLog = { ...existing, focus: ids, started: true, dropped: dropped.length > 0 ? [...new Set(dropped)] : undefined };
    this.data.days[dateKey] = log;
    const timer = this.data.timer;
    const stopped = dateKey === this.today && timer?.action && existing.focus.includes(timer.action) && !ids.includes(timer.action) ? this.#timerOff(timer, timer.action) : null;
    this.data = { ...this.data };
    this.save();
    if (stopped) this.say(stopped);
    return stopped;
  }

  /** As switching to another action does: the minutes so far are kept, unless it was left on for hours. */
  #timerOff(timer: Timer, action: ActionId): string {
    const now = Date.now();
    const label = actionLabel(this.data, action);
    const logged = isForgotten(timer, now) ? null : this.#logTimer(timer, now);
    delete this.data.timer;
    this.timerEnd = null;
    if (isForgotten(timer, now)) return `The stopwatch on ${label} ran for hours, so it was not logged.`;
    return logged ? `Logged ${formatMinutes(logged.minutes)} on ${label}.` : `Stopped the stopwatch on ${label}.`;
  }

  declineToday(ids: ActionId[]): void {
    if (ids.length === 0) return;
    if (!this.data.days) this.data.days = {};
    const dateKey = this.today;
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    this.data.days[dateKey] = { ...existing, declined: [...new Set([...(existing.declined ?? []), ...ids])] };
    this.data = { ...this.data };
    this.save();
  }

  noteShown(signature: string): void {
    if (!this.data.days) this.data.days = {};
    const dateKey = this.today;
    const existing = this.data.days[dateKey] ?? { focus: [], checked: [] };
    if (existing.shown?.includes(signature)) return;
    this.data.days[dateKey] = { ...existing, shown: [...(existing.shown ?? []), signature] };
    this.data = { ...this.data };
    this.save();
  }

  timer: Timer | null = $derived(this.data.timer ?? null);
  timerEnd = $state<TimerEnd | null>(null);
  loggingTime = $state<{ action: ActionId; forgotten?: Timer } | null>(null);
  #endSeq = 1;

  startTimer(action: ActionId, length?: number, link?: string): void {
    const now = Date.now();
    const previous = this.data.timer;
    if (previous?.action) {
      if (isForgotten(previous, now)) {
        this.say(`The stopwatch on ${actionLabel(this.data, previous.action)} ran for hours, so it was not logged.`);
      } else {
        const logged = this.#logTimer(previous, now);
        if (logged) this.say(`Logged ${formatMinutes(logged.minutes)} on ${actionLabel(this.data, previous.action)}.`);
      }
    }
    this.data.timer = { action, since: now, ...(length ? { length } : {}), ...(link ? { link } : {}) };
    this.timerEnd = null;
    this.data = { ...this.data };
    this.save();
  }

  startBreak(minutes = BREAK_MINUTES): void {
    this.data.timer = { since: Date.now(), length: minutes };
    this.timerEnd = null;
    this.data = { ...this.data };
    this.save();
  }

  stopTimer(): void {
    const timer = this.data.timer;
    if (!timer) return;
    const now = Date.now();
    if (timer.action && isForgotten(timer, now)) {
      this.loggingTime = { action: timer.action, forgotten: timer };
      return;
    }
    const logged = this.#logTimer(timer, now);
    this.#clearTimer();
    this.timerEnd = timer.action ? { id: this.#endSeq++, kind: "stopped", action: timer.action, minutes: logged?.minutes ?? 0 } : null;
  }

  finishTimer(): TimerEnd | null {
    const timer = this.data.timer;
    const now = Date.now();
    if (!timer || !isOver(timer, now)) return null;
    const logged = this.#logTimer(timer, now);
    this.#clearTimer();
    this.timerEnd = { id: this.#endSeq++, kind: timer.action ? "block" : "break", action: timer.action, minutes: logged?.minutes ?? timer.length ?? 0 };
    return this.timerEnd;
  }

  dismissTimerEnd(): void {
    this.timerEnd = null;
  }

  discardTimer(): void {
    if (!this.data.timer) return;
    this.loggingTime = null;
    this.#clearTimer();
  }

  logTime(action: ActionId, minutes: number, link?: string, mode?: SessionMode): void {
    const forgotten = this.loggingTime?.forgotten;
    if (forgotten && this.data.timer?.since === forgotten.since) {
      this.#logTimer(forgotten, Date.now(), minutes, link ?? forgotten.link);
      this.#clearTimer();
    } else {
      const { dateKey, session } = sessionEndingAt(action, minutes, new Date(), link, mode);
      addSession(this.data, dateKey, session);
      this.data = { ...this.data };
      this.save();
    }
    this.loggingTime = null;
    const tool = link ? toolInChart(this.data, link)?.tool : null;
    const on = tool ? ` on “${tool.title}” (${actionLabel(this.data, action)})` : ` on ${actionLabel(this.data, action)}`;
    this.say(`Logged ${formatMinutes(minutes)}${mode === 'passive' && !forgotten ? ' passive' : ''}${on}.`);
  }

  #removedTime = new Map<string, { chartId: string; dateKey: string; sessions: Session[] }>();
  #timeSeq = 1;

  removeTime(dateKey: string, action: ActionId, session?: Session): void {
    const log = this.data.days?.[dateKey];
    const all = log?.sessions ?? [];
    let matched = false;
    const removed: Session[] = [];
    const rest = all.filter((entry) => {
      if (entry.action !== action) return true;
      if (session && (matched || entry.at !== session.at || entry.minutes !== session.minutes)) return true;
      matched = true;
      removed.push(entry);
      return false;
    });
    if (!log || removed.length === 0) return;
    this.data.days![dateKey] = { ...log, sessions: rest.length > 0 ? rest : undefined };
    this.data = { ...this.data };
    this.save();
    const token = `time:${this.#timeSeq++}`;
    this.#removedTime.set(token, { chartId: this.#library.activeId, dateKey, sessions: removed });
    const minutes = removed.reduce((sum, entry) => sum + entry.minutes, 0);
    this.#place({ key: token, kicker: "Removed", subject: `${formatMinutes(minutes)} on ${actionLabel(this.data, action)}`, undo: [token] });
  }

  #restoreTime(token: string): void {
    const removed = this.#removedTime.get(token);
    this.#removedTime.delete(token);
    if (!removed || removed.chartId !== this.#library.activeId) return;
    for (const session of removed.sessions) addSession(this.data, removed.dateKey, session);
    this.data = { ...this.data };
    this.save();
  }

  /** Time measured on a page by a browser extension. Each session is logged once, by its id. */
  ingest(request: IngestRequest): IngestResult {
    const { changed, logged, result } = ingestSessions(this.data, request);
    if (changed) {
      this.data = { ...this.data };
      this.save();
      this.say(ingestWords(this.data, logged));
    }
    return result;
  }

  setPassiveWeight(weight: number): void {
    if (parsePassiveWeight(weight) === undefined) return;
    if (weight === PASSIVE_WEIGHT) {
      const { passiveWeight: _passiveWeight, ...rest } = this.data;
      this.data = rest;
    } else {
      this.data = { ...this.data, passiveWeight: weight };
    }
    this.save();
  }

  #logTimer(timer: Timer, now: number, minutes?: number, link?: string): { minutes: number } | null {
    const logged = sessionOf(link ? { ...timer, link } : timer, now, minutes);
    if (!logged) return null;
    addSession(this.data, logged.dateKey, logged.session);
    return logged.session;
  }

  #clearTimer(): void {
    const { timer: _timer, ...rest } = this.data;
    this.data = rest;
    this.save();
  }

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
      if (next.kind === "staple") delete next.known;
      for (const field of ["action", "known", "opened"] as const) if (next[field] === undefined) delete next[field];
      return next;
    });
  }

  #removedTools = new Map<string, { chartId: string; pillarIndex: number; at: number; tool: Tool }>();

  /** One slip for the lot, and its Undo puts each back where it was. */
  removeTools(picks: readonly { pillarIndex: number; id: string }[]): void {
    const tokens: string[] = [];
    let title = "";
    for (const { pillarIndex, id } of picks) {
      const key = `p${pillarIndex}`;
      const list = this.data.tools?.[key] ?? [];
      const at = list.findIndex((tool) => tool.id === id);
      if (at < 0) continue;
      const rest = list.filter((tool) => tool.id !== id);
      const tools = { ...this.data.tools };
      if (rest.length > 0) tools[key] = rest;
      else delete tools[key];
      this.data = { ...this.data, tools: Object.keys(tools).length > 0 ? tools : undefined };
      const token = `tool:${id}`;
      this.#removedTools.set(token, { chartId: this.#library.activeId, pillarIndex, at, tool: list[at]! });
      // Put back last-removed first, so each lands at the index it had when it went.
      tokens.unshift(token);
      title = list[at]!.title;
    }
    if (tokens.length === 0) return;
    this.save();
    const subject = tokens.length === 1 ? title : `${tokens.length} links`;
    this.#place({ key: tokens.length === 1 ? tokens[0]! : `tools:${tokens.join()}`, kicker: "Off the shelf", subject, undo: tokens });
  }

  /** A tool handed out by one action cannot keep it on another pillar, so a move hands it to that shelf's routines. */
  moveTools(picks: readonly { pillarIndex: number; id: string }[], to: number): void {
    let tools = { ...this.data.tools };
    let moved = 0;
    for (const { pillarIndex, id } of picks) {
      if (pillarIndex === to) continue;
      const from = tools[`p${pillarIndex}`] ?? [];
      const tool = from.find((each) => each.id === id);
      if (!tool) continue;
      const rest = from.filter((each) => each.id !== id);
      if (rest.length > 0) tools[`p${pillarIndex}`] = rest;
      else delete tools[`p${pillarIndex}`];
      const kept = { ...tool };
      delete kept.action;
      tools = { ...tools, [`p${to}`]: [...(tools[`p${to}`] ?? []), kept] };
      moved++;
    }
    if (moved === 0) return;
    this.data = { ...this.data, tools };
    this.save();
    const name = this.data.pillars[to]?.trim() || `Pillar ${to + 1}`;
    this.say(moved === 1 ? `Moved to ${name}.` : `Moved ${moved} links to ${name}.`);
  }

  #restoreTool(token: string): void {
    const removed = this.#removedTools.get(token);
    this.#removedTools.delete(token);
    if (!removed || removed.chartId !== this.#library.activeId) return;
    const key = `p${removed.pillarIndex}`;
    const list = [...(this.data.tools?.[key] ?? [])];
    list.splice(Math.min(removed.at, list.length), 0, removed.tool);
    this.data = { ...this.data, tools: { ...this.data.tools, [key]: list } };
    this.save();
  }

  setIcon(host: string, icon: string | null): void {
    if (!host) return;
    const icons = { ...this.data.icons };
    if (icon) icons[host] = icon;
    else delete icons[host];
    this.data = { ...this.data, icons: Object.keys(icons).length > 0 ? icons : undefined };
    this.save();
  }

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

  saveWeekReflection(
    weekKey: string,
    patch: Partial<{ note: string }>,
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
      if (!this.#syncChart) this.#syncChart = this.#library.activeId;
      void this.pullSync();
    } catch {}
  }

  #syncing(): boolean {
    return this.syncEnabled && Boolean(this.syncRoom) && this.#library.activeId === this.#syncChart;
  }

  #loadSyncState(room: string): void {
    try {
      const raw = localStorage.getItem(SYNC_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        room: string;
        chart?: string;
        updatedAt: number;
        data: ChartData;
      };
      if (parsed.room !== room) return;
      this.#syncBase = parsed.data;
      this.#syncBaseAt = parsed.updatedAt;
      if (parsed.chart) this.#syncChart = parsed.chart;
    } catch {
    }
  }

  #persistSyncState(): void {
    if (!this.#syncBase) return;
    try {
      localStorage.setItem(
        SYNC_STATE_KEY,
        JSON.stringify({
          room: this.syncRoom,
          chart: this.#syncChart,
          updatedAt: this.#syncBaseAt,
          data: this.#syncBase,
        }),
      );
    } catch {
    }
  }

  async pullSync(): Promise<void> {
    if (!this.#syncing() || this.#syncBusy) return;
    this.#syncBusy = true;
    this.syncStatus = "syncing";
    try {
      const remote = await fetchRow(this.syncRoom, this.#syncBaseAt || null);
      if (remote.unchanged) {
        this.syncStatus = "synced";
        return;
      }
      if (remote.chart && remote.updatedAt !== null) {
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
          await this.#putSync(merged);
        }
        this.syncStatus = "synced";
      } else {
        await this.#putSync(this.data);
        this.syncStatus = "synced";
      }
    } catch {
      this.syncStatus = "error";
    } finally {
      this.#syncBusy = false;
    }
  }

  async pushSync(): Promise<void> {
    if (!this.#syncing() || this.#syncBusy) return;
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
    if (this.#syncApplying || !this.#syncing()) return;
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
    }
    this.syncEnabled = true;
    this.syncRoom = trimmed;
    this.#loadSyncState(trimmed);
    this.#syncChart = this.#library.activeId;
    void this.pullSync();
    this.say("Sync on for this chart. It follows you to devices with the same key.");
  }

  disableSync(): void {
    this.syncEnabled = false;
    this.syncStatus = "off";
    this.syncRoom = "";
    this.#syncChart = "";
    this.#syncBase = null;
    this.#syncBaseAt = 0;
    if (this.#syncTimer) {
      clearTimeout(this.#syncTimer);
      this.#syncTimer = null;
    }
    try {
      localStorage.removeItem(SYNC_ROOM_KEY);
      localStorage.removeItem(SYNC_STATE_KEY);
    } catch {}
    this.say("Sync off.");
  }

  async publishShare(): Promise<void> {
    if (this.shareBusy) return;
    this.shareBusy = true;
    try {
      const result = await publishChart(this.data, this.shareId || null, this.shareNotes);
      this.shareId = result.id;
      this.shareUpdatedAt = result.updatedAt;
      this.#persistShareState();
    } finally {
      this.shareBusy = false;
    }
  }

  async stopSharing(): Promise<void> {
    if (!this.shareId) return;
    const id = this.shareId;
    this.shareId = "";
    this.shareUpdatedAt = null;
    this.autoShare = false;
    this.#persistShareState();
    await unpublishChart(id);
  }

  setShareNotes(on: boolean): void {
    this.shareNotes = on;
    this.#persistShareState();
    if (this.shareId && this.autoShare) this.#scheduleAutoPublish();
  }

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
      const result = await publishChart(this.data, this.shareId, this.shareNotes);
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

  jumpToKey(ref: Ref): void {
    const key = isActionId(ref) ? keyOf(this.data, ref) : ref;
    if (!key) return;
    this.select(blockOfKey(key));
    this.face = "actions";
    this.focusedKey = key;
    if (this.viewMode === "view" || this.viewMode === "today" || this.viewMode === "calendar" || this.viewMode === "board") {
      this.setViewMode("edit");
    }
  }

  setFace(face: "actions" | "shelf"): void {
    this.face = face;
  }

  openShelf(pillarIndex: number, toolId: string | null = null): void {
    this.selectPillar(pillarIndex);
    this.face = "shelf";
    this.shelfTool = toolId;
    if (this.viewMode === "view" || this.viewMode === "today" || this.viewMode === "calendar" || this.viewMode === "board") {
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
      saveTheme(theme);
      applyTheme(theme);
      this.bumpTheme();
    }, "theme");
  }

  setAccent(accent: AccentId): void {
    if (accent === this.accent) return;
    morph(() => {
      this.accent = accent;
      saveAccent(accent);
      applyAccent(accent);
    }, "theme");
  }

  openStartSheet(borrowedPreset: PresetId | null = null): void {
    this.#startSheet = { chartId: this.#library.activeId, borrowedPreset };
    try {
      localStorage.setItem(START_SHEET_KEY, JSON.stringify(this.#startSheet));
    } catch {}
  }

  closeStartSheet(): void {
    if (!this.inStartSheet) return;
    this.#startSheet = null;
    try {
      localStorage.removeItem(START_SHEET_KEY);
    } catch {}
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
    this.data = cloneChart(record.data);
    this.#resetView();
    const held = this.#copySlips();
    this.saveNow();
    this.#applyNote(held, "New", titleOf(this.data), 1, false);
    return true;
  }

  duplicateChart(fresh = false, goal?: string): boolean {
    this.#flush();
    const copy = fresh ? withoutHistory(this.data) : this.data;
    const record = newRecord(goal === undefined ? copy : { ...copy, goal });
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
    if (id === this.#syncChart) void this.pullSync();
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

  deleteCharts(ids: string[]): void {
    if (ids.length === 0) return;
    if (ids.length === 1) {
      this.deleteChart(ids[0]!);
      return;
    }
    this.#flush();
    const want = new Set(ids);
    const doomed = this.#library.charts.filter((item) => want.has(item.id));
    const next = deleteManyFromLibrary(this.#library, doomed.map((item) => item.id));
    if (!next || doomed.length === 0) return;
    const activeChanged = next.activeId !== this.#library.activeId;
    this.#library = next;
    if (activeChanged) {
      this.data = cloneChart(activeRecord(next).data);
      this.#resetView();
      this.#adoptShareState();
      this.#applySavedGoalFit();
    }
    const batch = batchSubject(doomed.map((item) => titleOf(item.data)));
    const held = this.#copySlips();
    this.saveNow();
    this.#applyNote(held, "Deleted", batch.subject, doomed.length, batch.mixed, doomed.map((item) => item.id));
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
      this.closeStartSheet();
      this.data = withNewIds(next);
      this.#resetView();
      this.saveNow();
      if (message) this.say(message);
      return true;
    }
    this.#flush();
    const record = newRecord(next);
    this.#library.charts = [...this.#library.charts, record];
    this.#library.activeId = record.id;
    this.data = cloneChart(record.data);
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
