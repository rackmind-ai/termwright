import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { platform } from 'node:os';
import { SerializeAddon } from '@xterm/addon-serialize';
import type { Terminal as XtermTerminal } from '@xterm/headless';
import type {
  KeyModifiers,
  ScreenSnapshot,
  TerminalSize,
  TerminalTrace,
} from '@termwright/protocol';
import { spawn, type IPty } from 'node-pty';
import { TerminalActionLimitError, TerminalClosedError, TerminalTimeoutError } from './errors.js';
import { encodeKey } from './keys.js';
import { LineLocator, PromptLocator, TextLocator } from './locators.js';
import { BoundedOutputBuffer } from './output-buffer.js';
import { SecretRedactor } from './redactor.js';
import { TraceRecorder, type TraceListener } from './trace.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_PROMPT = /(?:^|\s)[>$#❯]\s*$/;
const ESCAPE = String.fromCharCode(0x1b);
const SYNCHRONIZED_OUTPUT_SEQUENCE = new RegExp(`${ESCAPE}\\[\\?2026([hl])`, 'g');
const { Terminal } = createRequire(import.meta.url)('@xterm/headless') as {
  Terminal: typeof XtermTerminal;
};

export type TerminalSessionState = 'running' | 'exited' | 'closed';

export interface TerminalLaunchOptions {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string | undefined>>;
  cols?: number;
  rows?: number;
  name?: string;
  encoding?: string;
  scrollback?: number;
  defaultTimeoutMs?: number;
  maxTimeoutMs?: number;
  maxOutputBytes?: number;
  maxTraceRecords?: number;
  /** Hard wall-clock lifetime. The process is terminated when it expires. */
  sessionTimeoutMs?: number;
  /** Maximum number of public terminal operations for this session. */
  maxActions?: number;
}

export interface TypeOptions {
  /** Redacts the trace record while still sending the real text to the PTY. */
  secret?: boolean;
  /** Optional delay between Unicode code points. */
  delayMs?: number;
}

export interface WaitForStableOptions {
  /**
   * Minimum wall-clock duration for which the rendered screen must remain
   * unchanged. This is a lower bound, not the sole stability signal.
   */
  stableForMs?: number;
  /** Number of consecutive rendered snapshots that must agree. */
  minimumObservations?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ExitResult {
  exitCode: number;
  signal?: number;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new RangeError(`${name} must be a positive safe integer`);
  return value;
}

function now(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

export class TerminalSession {
  readonly id: string;
  readonly pid: number;
  readonly command: string;

  #pty: IPty;
  #terminal: XtermTerminal;
  #serializer: SerializeAddon;
  #trace: TraceRecorder;
  #output: BoundedOutputBuffer;
  #redactor = new SecretRedactor();
  #state: TerminalSessionState = 'running';
  #defaultTimeoutMs: number;
  #maxTimeoutMs: number;
  #screenSequence = 0;
  #screenRevision = 0;
  #renderRevision = 0;
  #synchronizedOutputOpen = false;
  #synchronizationTail = '';
  #pendingWrites: Promise<void> = Promise.resolve();
  #exitResult?: ExitResult;
  #resolveExit!: (result: ExitResult) => void;
  #exitPromise: Promise<ExitResult>;
  #wallTimer: ReturnType<typeof setTimeout>;
  #forceKillTimer?: ReturnType<typeof setTimeout>;
  #maxActions: number;
  #actionCount = 0;

  private constructor(options: TerminalLaunchOptions) {
    if (!options.command.trim()) throw new TypeError('command must not be empty');
    const cols = positiveInteger(options.cols ?? 80, 'cols');
    const rows = positiveInteger(options.rows ?? 24, 'rows');
    this.#maxTimeoutMs = positiveInteger(options.maxTimeoutMs ?? MAX_TIMEOUT_MS, 'maxTimeoutMs');
    this.#defaultTimeoutMs = positiveInteger(
      options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      'defaultTimeoutMs',
    );
    if (this.#defaultTimeoutMs > this.#maxTimeoutMs) {
      throw new RangeError('defaultTimeoutMs must be less than or equal to maxTimeoutMs');
    }

    this.id = randomUUID();
    this.command = options.command;
    this.#output = new BoundedOutputBuffer(options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES);
    this.#trace = new TraceRecorder(this.id, options.maxTraceRecords);
    this.#maxActions = positiveInteger(options.maxActions ?? 10_000, 'maxActions');
    const sessionTimeoutMs = positiveInteger(
      options.sessionTimeoutMs ?? 30_000,
      'sessionTimeoutMs',
    );
    this.#terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
      scrollback: options.scrollback ?? 1_000,
    });
    this.#serializer = new SerializeAddon();
    this.#terminal.loadAddon(this.#serializer);
    this.#exitPromise = new Promise((resolve) => {
      this.#resolveExit = resolve;
    });

    const inheritedEnvironment = cleanEnvironment(process.env);
    this.#pty = spawn(options.command, [...(options.args ?? [])], {
      name: options.name ?? 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: { ...inheritedEnvironment, ...cleanEnvironment(options.env ?? {}) },
      encoding: options.encoding ?? 'utf8',
    });
    this.pid = this.#pty.pid;

    this.#pty.onData((data) => {
      this.#handleOutput(data);
    });
    this.#pty.onExit(({ exitCode, signal }) => {
      clearTimeout(this.#wallTimer);
      if (this.#forceKillTimer) clearTimeout(this.#forceKillTimer);
      const remainingOutput = this.#redactor.flush();
      if (remainingOutput) this.#commitOutput(remainingOutput);
      const result: ExitResult = { exitCode, ...(signal === undefined ? {} : { signal }) };
      this.#exitResult = result;
      if (this.#state === 'running') this.#state = 'exited';
      this.#trace.emit({ type: 'exited', timestamp: now(), ...result });
      this.#resolveExit(result);
    });
    this.#trace.emit({ type: 'started', timestamp: now(), pid: this.pid, size: { cols, rows } });
    this.#wallTimer = setTimeout(() => {
      this.#handleWallClockTimeout(sessionTimeoutMs);
    }, sessionTimeoutMs);
    this.#wallTimer.unref();
  }

  static launch(options: TerminalLaunchOptions): TerminalSession {
    return new TerminalSession(options);
  }

  get state(): TerminalSessionState {
    return this.#state;
  }

  get size(): TerminalSize {
    return { cols: this.#terminal.cols, rows: this.#terminal.rows };
  }

  get output(): string {
    return this.#output.toString();
  }

  get outputBytes(): number {
    return this.#output.totalBytes;
  }

  get outputTruncated(): boolean {
    return this.#output.truncated;
  }

  get actionCount(): number {
    return this.#actionCount;
  }

  resolveTimeout(timeoutMs = this.#defaultTimeoutMs): number {
    positiveInteger(timeoutMs, 'timeoutMs');
    if (timeoutMs > this.#maxTimeoutMs) {
      throw new RangeError(`timeoutMs cannot exceed maxTimeoutMs (${String(this.#maxTimeoutMs)})`);
    }
    return timeoutMs;
  }

  getByText(text: string | RegExp, options: { exact?: boolean } = {}): TextLocator {
    return new TextLocator(this, text, options.exact);
  }

  getLine(index: number): LineLocator {
    return new LineLocator(this, index);
  }

  getPrompt(pattern: string | RegExp = DEFAULT_PROMPT): PromptLocator {
    return new PromptLocator(this, pattern);
  }

  async type(text: string, options: TypeOptions = {}): Promise<void> {
    this.#assertRunning();
    this.#consumeAction();
    const delayMs = options.delayMs ?? 0;
    if (!Number.isFinite(delayMs) || delayMs < 0)
      throw new RangeError('delayMs must be a non-negative number');
    const redacted = options.secret === true;
    if (redacted) this.#redactor.add(text);
    this.#trace.emit({
      type: 'input',
      timestamp: now(),
      data: redacted ? '[REDACTED]' : text,
      byteLength: Buffer.byteLength(text),
      redacted,
    });
    if (delayMs === 0) {
      this.#pty.write(text);
      return;
    }
    for (const character of text) {
      this.#assertRunning();
      this.#pty.write(character);
      await delay(delayMs);
    }
  }

  press(key: string, modifiers: KeyModifiers = {}): void {
    this.#assertRunning();
    this.#consumeAction();
    const encoded = encodeKey(key, modifiers);
    this.#trace.emit({ type: 'key', timestamp: now(), key, modifiers: { ...modifiers } });
    this.#pty.write(encoded);
  }

  resize(cols: number, rows: number): void {
    this.#assertRunning();
    this.#consumeAction();
    positiveInteger(cols, 'cols');
    positiveInteger(rows, 'rows');
    this.#pty.resize(cols, rows);
    this.#terminal.resize(cols, rows);
    this.#screenRevision += 1;
    this.#trace.emit({ type: 'resized', timestamp: now(), size: { cols, rows } });
  }

  /** Reads the rendered viewport without emitting a trace event or consuming an action. */
  readScreen(): ScreenSnapshot {
    const buffer = this.#terminal.buffer.active;
    const lines: string[] = [];
    for (let row = 0; row < this.#terminal.rows; row += 1) {
      lines.push(buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '');
    }
    while (lines.length > 1 && lines.at(-1) === '') lines.pop();
    const snapshot: ScreenSnapshot = {
      sequence: ++this.#screenSequence,
      timestamp: now(),
      size: this.size,
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      lines,
      text: lines.join('\n'),
      ansi: this.#serializer.serialize(),
    };
    return snapshot;
  }

  snapshot(): ScreenSnapshot {
    this.#consumeAction();
    const snapshot = this.readScreen();
    this.#trace.emit({ type: 'snapshot', timestamp: snapshot.timestamp, snapshot });
    return snapshot;
  }

  async waitForStable(options: WaitForStableOptions = {}): Promise<ScreenSnapshot> {
    this.#consumeAction();
    const timeoutMs = this.resolveTimeout(options.timeoutMs);
    const stableForMs = positiveInteger(options.stableForMs ?? 100, 'stableForMs');
    const minimumObservations = positiveInteger(
      options.minimumObservations ?? 2,
      'minimumObservations',
    );
    const pollIntervalMs = positiveInteger(options.pollIntervalMs ?? 20, 'pollIntervalMs');
    if (stableForMs > timeoutMs) throw new RangeError('stableForMs must not exceed timeoutMs');
    const started = Date.now();
    let lastRenderRevision = this.#renderRevision;
    let unchangedSince = Date.now();
    let previousFingerprint: string | undefined;
    let matchingObservations = 0;

    for (;;) {
      await this.#pendingWrites;
      const currentRenderRevision = this.#renderRevision;
      const snapshot = this.readScreen();
      const fingerprint = JSON.stringify({
        size: snapshot.size,
        cursor: snapshot.cursor,
        text: snapshot.text,
        ansi: snapshot.ansi,
      });

      if (
        this.#synchronizedOutputOpen ||
        currentRenderRevision !== lastRenderRevision ||
        fingerprint !== previousFingerprint
      ) {
        lastRenderRevision = currentRenderRevision;
        previousFingerprint = fingerprint;
        unchangedSince = Date.now();
        matchingObservations = 1;
      } else {
        matchingObservations += 1;
      }

      if (
        !this.#synchronizedOutputOpen &&
        matchingObservations >= minimumObservations &&
        Date.now() - unchangedSince >= stableForMs
      ) {
        const elapsedMs = Date.now() - started;
        this.#trace.emit({ type: 'stable', timestamp: now(), stableForMs, elapsedMs });
        this.#trace.emit({ type: 'snapshot', timestamp: snapshot.timestamp, snapshot });
        return snapshot;
      }
      if (Date.now() - started >= timeoutMs) {
        throw new TerminalTimeoutError('Waiting for the terminal screen to stabilize', timeoutMs);
      }
      await delay(Math.min(pollIntervalMs, Math.max(1, timeoutMs - (Date.now() - started))));
    }
  }

  async waitForExit(options: { timeoutMs?: number } = {}): Promise<ExitResult> {
    if (this.#exitResult !== undefined) return this.#exitResult;
    const timeoutMs = this.resolveTimeout(options.timeoutMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.#exitPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new TerminalTimeoutError('Waiting for the terminal process to exit', timeoutMs));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async waitForScreenChange(pollIntervalMs: number, remainingMs: number): Promise<void> {
    const revision = this.#screenRevision;
    const waitMs = Math.min(pollIntervalMs, Math.max(1, remainingMs));
    await delay(waitMs);
    if (this.#screenRevision !== revision) await this.#pendingWrites;
  }

  onTrace(listener: TraceListener): () => void {
    return this.#trace.onRecord(listener);
  }

  trace(): TerminalTrace {
    return this.#trace.snapshot();
  }

  kill(signal?: string): void {
    if (this.#state !== 'running') return;
    this.#pty.kill(signal);
  }

  async close(options: { timeoutMs?: number; signal?: string } = {}): Promise<void> {
    if (this.#state === 'closed') return;
    if (this.#state === 'running') {
      const timeoutMs = this.resolveTimeout(options.timeoutMs);
      this.kill(options.signal ?? (platform() === 'win32' ? undefined : 'SIGTERM'));
      try {
        await this.waitForExit({ timeoutMs: Math.min(timeoutMs, 1_000) });
      } catch (error) {
        if (!(error instanceof TerminalTimeoutError)) throw error;
        this.#pty.kill(platform() === 'win32' ? undefined : 'SIGKILL');
        await this.waitForExit({ timeoutMs });
      }
    }
    await this.#pendingWrites;
    this.#terminal.dispose();
    this.#state = 'closed';
    this.#trace.emit({ type: 'closed', timestamp: now() });
  }

  #handleOutput(data: string): void {
    this.#observeSynchronizedOutput(data);
    const safeData = this.#redactor.push(data);
    if (safeData) this.#commitOutput(safeData);
  }

  #observeSynchronizedOutput(data: string): void {
    const observed = this.#synchronizationTail + data;
    for (const match of observed.matchAll(SYNCHRONIZED_OUTPUT_SEQUENCE)) {
      this.#synchronizedOutputOpen = match[1] === 'h';
    }
    // Retain only enough data to recognize a control sequence split across PTY chunks.
    this.#synchronizationTail = observed.slice(-8);
  }

  #commitOutput(data: string): void {
    this.#output.append(data);
    this.#screenRevision += 1;
    this.#trace.emit({
      type: 'output',
      timestamp: now(),
      data,
      byteLength: Buffer.byteLength(data),
    });
    this.#pendingWrites = this.#pendingWrites.then(
      () =>
        new Promise<void>((resolve) => {
          this.#terminal.write(data, () => {
            this.#renderRevision += 1;
            resolve();
          });
        }),
    );
  }

  #assertRunning(): void {
    if (this.#state !== 'running') throw new TerminalClosedError();
  }

  #consumeAction(): void {
    if (this.#actionCount >= this.#maxActions) throw new TerminalActionLimitError(this.#maxActions);
    this.#actionCount += 1;
  }

  #handleWallClockTimeout(timeoutMs: number): void {
    if (this.#state !== 'running') return;
    this.#trace.emit({
      type: 'error',
      timestamp: now(),
      name: 'TerminalTimeoutError',
      message: `Terminal session exceeded its ${String(timeoutMs)}ms wall-clock limit`,
    });
    this.#pty.kill(platform() === 'win32' ? undefined : 'SIGTERM');
    this.#forceKillTimer = setTimeout(() => {
      if (this.#state === 'running') this.#pty.kill(platform() === 'win32' ? undefined : 'SIGKILL');
    }, 1_000);
    this.#forceKillTimer.unref();
  }
}
