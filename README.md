# Termwright

[![CI](https://github.com/JanicsJophles/termwright/actions/workflows/ci.yml/badge.svg)](https://github.com/JanicsJophles/termwright/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

**A small PTY harness for testing the terminal apps I actually ship.**

It launches a real installed CLI in a real pseudoterminal, reconstructs the screen a human sees, drives keys and resize events, waits on rendered screen state, and records a replayable trace. I built it to stop manually regression-testing RackMind’s interactive workflows.

> Status: pre-alpha. The first PTY/screen slice is functional on macOS. APIs will change before the first tagged release.

## Why

Subprocess tests do not exercise TTY detection, raw input, cursor movement, terminal resize, signal handling, or full-screen Ink/TUI redraws. Stream-matching tools see arrival-order bytes rather than the rendered screen. Termwright combines a real PTY with a headless terminal model so assertions target what the user actually sees.

## Try the working slice

```sh
npm install
npm run build
node packages/cli/bin/termwright.js inspect -- node examples/demo-cli/dist/index.js
```

`inspect` uses a real PTY. Type into it, resize the terminal, and exit as you normally would. The session records raw terminal evidence plus rendered screen snapshots; interactive input is redacted from the trace by default.

## What is real today

- Exact executable + argv launches—never a shell.
- A real PTY rendered through `@xterm/headless`.
- Text, line, and prompt locators; key input and resize actions.
- Bounded session lifetime, output, action count, and trace size.
- Secret-input redaction and replayable in-memory traces.
- A stability wait that checks rendered screen agreement and honors DEC synchronized-output boundaries when an app emits them.

## Development

Requires Node.js 20.18.1 or newer and the native build toolchain required by `node-pty`.

```sh
npm install
npm run check
npm run build
```

The initial binary exposes two low-level tools:

```sh
termwright inspect -- my-cli connect
termwright replay trace.json
```

See [ROADMAP.md](./ROADMAP.md) for deliberately deferred work, including RackMind’s trace-to-regression-test loop.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## License

Apache License 2.0. See [LICENSE](./LICENSE).
