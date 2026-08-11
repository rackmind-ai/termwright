import {
  TerminalSession,
  type TerminalLaunchOptions,
  type TypeOptions,
  type WaitForStableOptions,
} from '@termwright/core';
import { expect, test as vitestTest } from 'vitest';

type LaunchOverrides = Omit<TerminalLaunchOptions, 'command' | 'args'>;

export class TerminalFixture {
  #sessions: TerminalSession[] = [];
  #active?: TerminalSession;

  readonly keyboard = {
    type: async (text: string, options?: TypeOptions): Promise<void> => {
      await this.active().type(text, options);
    },
    press: async (
      key: Parameters<TerminalSession['press']>[0],
      modifiers?: Parameters<TerminalSession['press']>[1],
    ): Promise<void> => {
      await this.active().press(key, modifiers);
    },
  };

  async launch(
    command: string,
    args: readonly string[] = [],
    options: LaunchOverrides = {},
  ): Promise<TerminalSession> {
    if (this.#active?.state === 'running') {
      await this.#active.close();
    }
    const session = TerminalSession.launch({ command, args, ...options });
    this.#sessions.push(session);
    this.#active = session;
    return session;
  }

  active(): TerminalSession {
    if (!this.#active) throw new Error('No terminal is active. Call terminal.launch() first.');
    return this.#active;
  }

  getByText(...args: Parameters<TerminalSession['getByText']>) {
    return this.active().getByText(...args);
  }

  getPrompt(...args: Parameters<TerminalSession['getPrompt']>) {
    return this.active().getPrompt(...args);
  }

  screen() {
    return this.active().snapshot();
  }

  resize(cols: number, rows: number): void {
    this.active().resize(cols, rows);
  }

  waitForStable(options?: WaitForStableOptions) {
    return this.active().waitForStable(options);
  }

  async dispose(): Promise<void> {
    await Promise.all(
      this.#sessions.map(async (session) => {
        if (session.state !== 'closed') await session.close().catch(() => undefined);
      }),
    );
  }
}

export interface TermwrightFixtures {
  terminal: TerminalFixture;
}

export const test = vitestTest.extend<TermwrightFixtures>({
  terminal: async (_context, use) => {
    const terminal = new TerminalFixture();
    try {
      await use(terminal);
    } finally {
      await terminal.dispose();
    }
  },
});

export { expect };
export * from '@termwright/core';
