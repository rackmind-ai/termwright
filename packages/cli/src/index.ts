import { readFile } from 'node:fs/promises';
import { TerminalSession } from '@termwright/core';
import type { TerminalTrace } from '@termwright/protocol';

const HELP = `termwright - end-to-end testing for terminal applications

Usage:
  termwright inspect -- <command> [args...]
  termwright replay <trace.json>
  termwright --help

inspect launches an exact executable inside a PTY and mirrors its output.
Keyboard input is treated as secret by default and is not retained in traces.`;
const INSPECT_TIMEOUT_MS = 10 * 60 * 1_000;

export async function main(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (command === 'inspect') {
    await inspect(rest);
    return;
  }
  if (command === 'replay') {
    await replay(rest);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

async function inspect(args: readonly string[]): Promise<void> {
  const separator = args.indexOf('--');
  const target = separator >= 0 ? args.slice(separator + 1) : args;
  const [executable, ...targetArgs] = target;
  if (!executable) throw new Error('inspect requires an executable after --');

  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const session = TerminalSession.launch({
    command: executable,
    args: targetArgs,
    cols,
    rows,
    maxTimeoutMs: INSPECT_TIMEOUT_MS,
    sessionTimeoutMs: INSPECT_TIMEOUT_MS,
  });
  const removeTraceListener = session.onTrace(({ event }) => {
    if (event.type === 'output') process.stdout.write(event.data);
  });

  const onInput = (data: Buffer): void => {
    void session.type(data.toString('utf8'), { secret: true });
  };
  const onResize = (): void => {
    if (session.state === 'running' && process.stdout.columns && process.stdout.rows) {
      session.resize(process.stdout.columns, process.stdout.rows);
    }
  };

  process.stdin.on('data', onInput);
  process.stdout.on('resize', onResize);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  try {
    const result = await session.waitForExit({ timeoutMs: INSPECT_TIMEOUT_MS });
    process.exitCode = result.exitCode;
  } finally {
    removeTraceListener();
    process.stdin.off('data', onInput);
    process.stdout.off('resize', onResize);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    await session.close().catch(() => undefined);
  }
}

async function replay(args: readonly string[]): Promise<void> {
  const [tracePath] = args;
  if (!tracePath) throw new Error('replay requires a trace JSON path');
  const candidate: unknown = JSON.parse(await readFile(tracePath, 'utf8'));
  const trace = assertTrace(candidate);
  for (const { event } of trace.records) {
    if (event.type === 'output') process.stdout.write(event.data);
  }
}

function assertTrace(value: unknown): TerminalTrace {
  if (!value || typeof value !== 'object') throw new TypeError('Trace must be a JSON object');
  const candidate = value as Partial<TerminalTrace>;
  if (candidate.protocolVersion !== 1 || !Array.isArray(candidate.records)) {
    throw new TypeError('Unsupported or malformed Termwright trace');
  }
  return candidate as TerminalTrace;
}
