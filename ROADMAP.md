# Roadmap

## v0.1 — Functional terminal core

- Real PTY launch with exact executable and argv.
- Headless xterm rendering and visible-screen snapshots.
- Lazy text, line, and prompt locators.
- Keyboard input, named keys, resize, and stable-screen waits.
- Bounded session time, actions, output, traces, and teardown.
- Secret-aware trace redaction.
- Versioned JSON action/event/trace contracts.
- Vitest fixture and constrained agent controller.
- `termwright inspect` and JSON trace replay.

## v0.2 — Deterministic scenario runner

- Scenario discovery and reporters.
- Retrying `expect` matchers for screen, cursor, process, and exit state.
- Isolated temporary home/config/work directories.
- Deterministic fixture HTTP/TCP helpers.
- JUnit and asciicast artifacts.
- Linux and macOS CI matrix, followed by Windows ConPTY CI.

## v0.3 — Model and property exploration

- `fast-check` command-model integration with seed capture and shrinking.
- Stable YAML reproduction format.
- Trace minimization.
- Unicode, resize, signal, and input-sequence generators.

## v0.4 — Agent exploration

- Provider-neutral agent loop over the constrained action controller.
- Action, wall-clock, character, and token budgets.
- Deterministic fixture oracles and forbidden-side-effect assertions.
- Conversion of discoveries into replayable and minimized scenarios.

## Deferred until justified

- Long-running daemon or remote protocol.
- Trace web viewer.
- Code generation/recording UI.
- MCP facade.
- Additional language clients.
