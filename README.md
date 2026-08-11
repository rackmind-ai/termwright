# Termwright

[![CI](https://github.com/JanicsJophles/termwright/actions/workflows/ci.yml/badge.svg)](https://github.com/JanicsJophles/termwright/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

**Playwright-style, agent-ready end-to-end testing for terminal applications.**

Termwright launches your CLI inside a real pseudoterminal, reconstructs the screen a human sees, drives keys and resize events, waits on stable visible state, and records a replayable trace. Deterministic tests remain the correctness oracle; a constrained agent can explore on top of the same safe actions and turn discoveries into reproducible scenarios.

> Status: pre-alpha. The first PTY/screen slice is functional and tested on macOS. APIs will change before the first tagged release.

## Why

Subprocess tests do not exercise TTY detection, raw input, cursor movement, terminal resize, signal handling, or full-screen Ink/TUI redraws. Stream-matching tools see arrival-order bytes rather than the rendered screen. Termwright combines a real PTY with a headless terminal model so assertions target what the user actually sees.

## Target API

```ts
import { test, expect } from '@termwright/test';

test('interactive setup', async ({ terminal }) => {
  await terminal.launch('my-cli', ['connect']);
  await terminal.getByText('Host').waitFor();
  await terminal.keyboard.type('10.0.0.2');
  await terminal.keyboard.press('Enter');
  await expect(terminal.screen()).toContainText('Connected');
});
```

## Principles

- Real PTY behavior, not mocked stdin/stdout.
- Assertions against rendered terminal state, not raw ANSI chunks.
- Lazy locators and retrying assertions; no arbitrary scenario sleeps.
- Raw evidence plus normalized screen snapshots in every trace.
- Secrets are never persisted.
- Bounded processes, output, actions, time, and agent access.
- Generic engine only. Product-specific fixtures stay with the product.

## Planned packages

| Package                | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `@termwright/core`     | PTY lifecycle, screen model, input, locators, waits, traces |
| `@termwright/protocol` | Versioned action, event, and trace contracts                |
| `@termwright/test`     | Fixtures, assertions, retries, and reporters                |
| `@termwright/agent`    | Constrained agent actions, budgets, and policies            |
| `termwright`           | Test, inspect, and replay CLI                               |

## Development

Requires Node.js 20.18.1 or newer and the native build toolchain required by `node-pty`.

```sh
npm install
npm run check
npm run build
```

The initial binary also exposes two low-level tools:

```sh
termwright inspect -- my-cli connect
termwright replay trace.json
```

`inspect` launches an exact executable and argv inside a PTY. It never invokes a shell, and interactive input is treated as secret in the in-memory trace by default.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## License

Apache License 2.0. See [LICENSE](./LICENSE).
