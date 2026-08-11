export const PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

export interface TerminalSize {
  cols: number;
  rows: number;
}

export type NamedKey =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'Backspace'
  | 'Delete'
  | 'End'
  | 'Enter'
  | 'Escape'
  | 'Home'
  | 'Insert'
  | 'PageDown'
  | 'PageUp'
  | 'Space'
  | 'Tab'
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12';

export interface KeyModifiers {
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

export interface LaunchAction {
  type: 'launch';
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string>>;
  size?: TerminalSize;
}

export interface WriteAction {
  type: 'write';
  text: string;
  secret?: boolean;
}

export interface PressKeyAction {
  type: 'press-key';
  /** A named key or a literal single-character key. */
  key: string;
  modifiers?: KeyModifiers;
}

export interface ResizeAction {
  type: 'resize';
  size: TerminalSize;
}

export interface WaitForStableAction {
  type: 'wait-for-stable';
  stableForMs?: number;
  timeoutMs?: number;
}

export interface SnapshotAction {
  type: 'snapshot';
}

export interface CloseAction {
  type: 'close';
  signal?: string;
}

export type TerminalAction =
  | LaunchAction
  | WriteAction
  | PressKeyAction
  | ResizeAction
  | WaitForStableAction
  | SnapshotAction
  | CloseAction;

export interface ScreenSnapshot {
  sequence: number;
  timestamp: string;
  size: TerminalSize;
  cursor: {
    x: number;
    y: number;
  };
  /** Visible terminal rows, with trailing whitespace removed. */
  lines: readonly string[];
  /** Visible rows joined with newlines. */
  text: string;
  /** ANSI serialization of the terminal's rendered state. */
  ansi: string;
}

interface EventBase {
  timestamp: string;
}

export interface StartedEvent extends EventBase {
  type: 'started';
  pid: number;
  size: TerminalSize;
}

export interface OutputEvent extends EventBase {
  type: 'output';
  data: string;
  byteLength: number;
}

export interface InputEvent extends EventBase {
  type: 'input';
  data: string;
  byteLength: number;
  redacted: boolean;
}

export interface KeyEvent extends EventBase {
  type: 'key';
  key: string;
  modifiers: KeyModifiers;
}

export interface ResizedEvent extends EventBase {
  type: 'resized';
  size: TerminalSize;
}

export interface StableEvent extends EventBase {
  type: 'stable';
  stableForMs: number;
  elapsedMs: number;
}

export interface SnapshotEvent extends EventBase {
  type: 'snapshot';
  snapshot: ScreenSnapshot;
}

export interface ExitedEvent extends EventBase {
  type: 'exited';
  exitCode: number;
  signal?: number;
}

export interface ErrorEvent extends EventBase {
  type: 'error';
  name: string;
  message: string;
}

export interface ClosedEvent extends EventBase {
  type: 'closed';
}

export type TerminalEvent =
  | StartedEvent
  | OutputEvent
  | InputEvent
  | KeyEvent
  | ResizedEvent
  | StableEvent
  | SnapshotEvent
  | ExitedEvent
  | ErrorEvent
  | ClosedEvent;

export interface TraceRecord<E extends TerminalEvent = TerminalEvent> {
  protocolVersion: ProtocolVersion;
  sequence: number;
  sessionId: string;
  event: E;
}

export interface TerminalTrace {
  protocolVersion: ProtocolVersion;
  sessionId: string;
  startedAt: string;
  /** Number of oldest records evicted by the configured trace bound. */
  droppedRecords: number;
  records: readonly TraceRecord[];
}
