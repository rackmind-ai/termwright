import type { Locator, WaitForStableOptions } from '@termwright/core';
import type { KeyModifiers, NamedKey, ScreenSnapshot } from '@termwright/protocol';

export interface AgentTerminalDriver {
  snapshot(): ScreenSnapshot;
  type(text: string, options?: { secret?: boolean }): Promise<void>;
  press(key: NamedKey | string, modifiers?: KeyModifiers): Promise<void>;
  resize(cols: number, rows: number): void;
  waitForStable(options?: WaitForStableOptions): Promise<ScreenSnapshot>;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
}

export interface AgentControllerOptions {
  maxActions?: number;
  maxDurationMs?: number;
  maxInputCharacters?: number;
  allowedSizes?: readonly { cols: number; rows: number }[];
}

export interface AgentBudgetSnapshot {
  actionsUsed: number;
  actionsRemaining: number;
  inputCharactersUsed: number;
  inputCharactersRemaining: number;
  elapsedMs: number;
  durationRemainingMs: number;
  finished: boolean;
}

export class AgentBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentBudgetExceededError';
  }
}

export class AgentTerminalController {
  readonly #driver: AgentTerminalDriver;
  readonly #maxActions: number;
  readonly #maxDurationMs: number;
  readonly #maxInputCharacters: number;
  readonly #allowedSizes: ReadonlySet<string> | undefined;
  readonly #startedAt = Date.now();
  #actionsUsed = 0;
  #inputCharactersUsed = 0;
  #finished = false;

  constructor(driver: AgentTerminalDriver, options: AgentControllerOptions = {}) {
    this.#driver = driver;
    this.#maxActions = positiveInteger(options.maxActions ?? 100, 'maxActions');
    this.#maxDurationMs = positiveInteger(options.maxDurationMs ?? 60_000, 'maxDurationMs');
    this.#maxInputCharacters = positiveInteger(
      options.maxInputCharacters ?? 10_000,
      'maxInputCharacters',
    );
    this.#allowedSizes = options.allowedSizes
      ? new Set(options.allowedSizes.map(({ cols, rows }) => sizeKey(cols, rows)))
      : undefined;
  }

  observeScreen(): ScreenSnapshot {
    this.#consumeAction();
    return this.#driver.snapshot();
  }

  async typePublic(text: string): Promise<void> {
    this.#consumeInput(text);
    await this.#driver.type(text);
  }

  async typeSecret(text: string): Promise<void> {
    this.#consumeInput(text);
    await this.#driver.type(text, { secret: true });
  }

  async pressKey(key: NamedKey | string, modifiers?: KeyModifiers): Promise<void> {
    this.#consumeAction();
    await this.#driver.press(key, modifiers);
  }

  resize(cols: number, rows: number): void {
    this.#consumeAction();
    if (this.#allowedSizes && !this.#allowedSizes.has(sizeKey(cols, rows))) {
      throw new RangeError(`Terminal size ${cols}x${rows} is not allowed by this run's policy`);
    }
    this.#driver.resize(cols, rows);
  }

  async waitForStable(options?: WaitForStableOptions): Promise<ScreenSnapshot> {
    this.#consumeAction();
    return this.#driver.waitForStable(options);
  }

  async assertVisible(text: string | RegExp, timeoutMs?: number): Promise<void> {
    this.#consumeAction();
    await this.#driver.getByText(text).wait(timeoutMs === undefined ? {} : { timeoutMs });
  }

  finish(): AgentBudgetSnapshot {
    this.#assertActive();
    this.#finished = true;
    return this.budget();
  }

  budget(): AgentBudgetSnapshot {
    const elapsedMs = Date.now() - this.#startedAt;
    return {
      actionsUsed: this.#actionsUsed,
      actionsRemaining: Math.max(0, this.#maxActions - this.#actionsUsed),
      inputCharactersUsed: this.#inputCharactersUsed,
      inputCharactersRemaining: Math.max(0, this.#maxInputCharacters - this.#inputCharactersUsed),
      elapsedMs,
      durationRemainingMs: Math.max(0, this.#maxDurationMs - elapsedMs),
      finished: this.#finished,
    };
  }

  #consumeInput(text: string): void {
    this.#consumeAction();
    const characters = [...text].length;
    if (this.#inputCharactersUsed + characters > this.#maxInputCharacters) {
      throw new AgentBudgetExceededError('Agent input-character budget exceeded');
    }
    this.#inputCharactersUsed += characters;
  }

  #consumeAction(): void {
    this.#assertActive();
    if (Date.now() - this.#startedAt > this.#maxDurationMs) {
      throw new AgentBudgetExceededError('Agent wall-clock budget exceeded');
    }
    if (this.#actionsUsed >= this.#maxActions) {
      throw new AgentBudgetExceededError('Agent action budget exceeded');
    }
    this.#actionsUsed += 1;
  }

  #assertActive(): void {
    if (this.#finished) throw new Error('This agent terminal controller is already finished');
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function sizeKey(cols: number, rows: number): string {
  positiveInteger(cols, 'cols');
  positiveInteger(rows, 'rows');
  return `${cols}x${rows}`;
}
