import type { ScreenSnapshot } from '@termwright/protocol';
import { LocatorError, TerminalTimeoutError } from './errors.js';
import type { TerminalSession } from './session.js';

export interface LocatorWaitOptions {
  timeoutMs?: number;
  state?: 'visible' | 'hidden';
}

export interface LocatedLine {
  /** Zero-based row within the visible viewport. */
  index: number;
  text: string;
}

type LineQuery = (snapshot: ScreenSnapshot) => readonly LocatedLine[];

function testPattern(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

export abstract class Locator {
  protected constructor(
    protected readonly session: TerminalSession,
    private readonly query: LineQuery,
    readonly description: string,
  ) {}

  all(): readonly LocatedLine[] {
    return this.query(this.session.readScreen());
  }

  count(): number {
    return this.all().length;
  }

  first(): LocatedLine {
    const result = this.all()[0];
    if (result === undefined)
      throw new LocatorError(`${this.description} did not match the current screen`);
    return result;
  }

  textContent(): string {
    return this.first().text;
  }

  isVisible(): boolean {
    return this.count() > 0;
  }

  async wait(options: LocatorWaitOptions = {}): Promise<this> {
    const state = options.state ?? 'visible';
    const timeoutMs = this.session.resolveTimeout(options.timeoutMs);
    const started = Date.now();

    for (;;) {
      const visible = this.isVisible();
      if ((state === 'visible' && visible) || (state === 'hidden' && !visible)) return this;
      if (Date.now() - started >= timeoutMs) {
        throw new TerminalTimeoutError(`Waiting for ${this.description} to be ${state}`, timeoutMs);
      }
      await this.session.waitForScreenChange(25, timeoutMs - (Date.now() - started));
    }
  }
}

export class TextLocator extends Locator {
  constructor(session: TerminalSession, text: string | RegExp, exact = false) {
    const description = `text ${JSON.stringify(text instanceof RegExp ? text.toString() : text)}`;
    super(
      session,
      (snapshot) =>
        snapshot.lines.flatMap((line, index) => {
          const matches =
            text instanceof RegExp
              ? testPattern(text, line)
              : exact
                ? line === text
                : line.includes(text);
          return matches ? [{ index, text: line }] : [];
        }),
      description,
    );
  }
}

export class LineLocator extends Locator {
  constructor(session: TerminalSession, index: number) {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new RangeError('Line index must be a non-negative safe integer');
    }
    super(
      session,
      (snapshot) => {
        const text = snapshot.lines[index];
        return text === undefined ? [] : [{ index, text }];
      },
      `visible line ${String(index)}`,
    );
  }
}

export class PromptLocator extends Locator {
  constructor(session: TerminalSession, pattern: string | RegExp) {
    super(
      session,
      (snapshot) =>
        snapshot.lines.flatMap((line, index) => {
          const matches =
            pattern instanceof RegExp ? testPattern(pattern, line) : line.endsWith(pattern);
          return matches ? [{ index, text: line }] : [];
        }),
      `prompt ${JSON.stringify(pattern instanceof RegExp ? pattern.toString() : pattern)}`,
    );
  }
}
