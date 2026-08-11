export class TerminalTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${String(timeoutMs)}ms`);
    this.name = 'TerminalTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class TerminalClosedError extends Error {
  constructor(message = 'The terminal session is closed') {
    super(message);
    this.name = 'TerminalClosedError';
  }
}

export class LocatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocatorError';
  }
}

export class TerminalActionLimitError extends Error {
  readonly maxActions: number;

  constructor(maxActions: number) {
    super(`Terminal session action limit reached (${String(maxActions)})`);
    this.name = 'TerminalActionLimitError';
    this.maxActions = maxActions;
  }
}
