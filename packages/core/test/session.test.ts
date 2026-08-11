import { afterEach, describe, expect, it } from 'vitest';
import { TerminalActionLimitError } from '../src/errors.js';
import { TerminalSession } from '../src/session.js';

const fixture = String.raw`
process.stdin.setEncoding("utf8");
process.stdin.setRawMode?.(true);
let input = "";
process.stdout.write("ready\r\ndemo> ");
process.stdin.on("data", (chunk) => {
  for (const character of chunk) {
    if (character === "\u0003") process.exit(130);
    if (character === "\r" || character === "\n") {
      const command = input;
      input = "";
      if (command === "exit") {
        process.stdout.write("bye\r\n");
        process.exit(0);
      }
      process.stdout.write("got:" + command + "\r\ndemo> ");
    } else {
      input += character;
    }
  }
});
`;

describe('TerminalSession', () => {
  const sessions: TerminalSession[] = [];

  afterEach(async () => {
    await Promise.all(
      sessions.map(async (session) => {
        if (session.state !== 'closed')
          await session.close({ timeoutMs: 1_000 }).catch(() => undefined);
      }),
    );
  });

  function launch(
    options: Partial<Parameters<typeof TerminalSession.launch>[0]> = {},
  ): TerminalSession {
    const session = TerminalSession.launch({
      command: process.execPath,
      args: ['-e', fixture],
      cols: 40,
      rows: 8,
      defaultTimeoutMs: 2_000,
      ...options,
    });
    sessions.push(session);
    return session;
  }

  it('renders output, resolves lazy locators, types, resizes, and exits', async () => {
    const session = launch();
    const prompt = session.getPrompt('demo> ');

    await prompt.wait();
    expect(session.getByText('ready').textContent()).toBe('ready');

    await session.type('hello');
    session.press('Enter');
    await session.getByText('got:hello').wait();
    const stable = await session.waitForStable({ stableForMs: 30 });

    expect(stable.text).toContain('got:hello');
    expect(stable.ansi).toContain('got:hello');
    session.resize(60, 10);
    expect(session.size).toEqual({ cols: 60, rows: 10 });

    await session.type('exit');
    session.press('Enter');
    await expect(session.waitForExit()).resolves.toEqual(expect.objectContaining({ exitCode: 0 }));
  });

  it('redacts secret input from trace records', async () => {
    const session = launch();
    await session.getPrompt('demo> ').wait();
    await session.type('correct-horse', { secret: true });

    const inputRecord = session.trace().records.find((record) => record.event.type === 'input');
    expect(inputRecord?.event).toMatchObject({
      type: 'input',
      data: '[REDACTED]',
      byteLength: 13,
      redacted: true,
    });
    expect(JSON.stringify(inputRecord)).not.toContain('correct-horse');
  });

  it('enforces output and timeout bounds', async () => {
    const session = launch({ maxOutputBytes: 8, defaultTimeoutMs: 100, maxTimeoutMs: 100 });
    await session.getPrompt('demo> ').wait({ timeoutMs: 100 });

    expect(Buffer.byteLength(session.output)).toBeLessThanOrEqual(8);
    expect(() => session.resolveTimeout(101)).toThrow(RangeError);
  });

  it('enforces action and wall-clock limits', async () => {
    const actionLimited = launch({ maxActions: 1 });
    await actionLimited.getPrompt('demo> ').wait();
    actionLimited.press('Space');
    expect(() => actionLimited.press('Space')).toThrow(TerminalActionLimitError);

    const wallLimited = launch({ sessionTimeoutMs: 40 });
    const result = await wallLimited.waitForExit({ timeoutMs: 500 });
    expect(Number.isInteger(result.exitCode)).toBe(true);
    expect(
      wallLimited
        .trace()
        .records.some(
          (record) => record.event.type === 'error' && record.event.name === 'TerminalTimeoutError',
        ),
    ).toBe(true);
  });
});
