# Termwright

Termwright is an open-source, agent-ready end-to-end testing framework for terminal applications. It should feel familiar to Playwright users while testing the real rendered terminal through a PTY.

## Mission

Build the smallest reliable stack that lets humans, deterministic tests, property tests, and constrained agents drive a CLI exactly as a user would and leave behind a replayable trace.

## Architecture

- `packages/core`: PTY lifecycle, xterm screen model, locators, input, waits, traces, and safety limits.
- `packages/protocol`: versioned action/event/trace contracts. No runtime or product dependencies.
- `packages/test`: test fixtures, assertions, reporters, and Vitest integration.
- `packages/agent`: constrained agent action surface, budgets, and policy enforcement.
- `packages/cli`: the `termwright` command.
- `examples`: self-contained dogfood targets. Never depend on RackMind credentials or infrastructure.

Keep the logical driver/controller boundary in-process until a real use case requires a daemon. Do not add a trace viewer, code generator, MCP server, or multi-language client during the initial core phase.

## Non-negotiable Safety Rules

- Never spawn through a shell. Launch an exact executable plus argv.
- Every session has wall-clock, output-byte, and action limits.
- Kill the entire child process tree on timeout or teardown and verify exit.
- Secret input is never written to traces, snapshots, logs, hashes, or error messages.
- Agent mode exposes only typed terminal actions; it never exposes a shell, filesystem, environment mutation, or arbitrary network tools.
- Fixture mode is the default. Live destructive testing requires an external capability/lease system and is not part of core.

## Quality Gates

Before every commit run:

```sh
npm run check
npm run build
```

`check` must cover lint, formatting, type checking, and tests. PTY tests run serially and use isolated temporary directories.

## Engineering Rules

- TypeScript strict mode; no `any`, `@ts-ignore`, or swallowed errors.
- Prefer lazy locators over cached screen coordinates or row numbers.
- Wait on observable screen/process conditions, never arbitrary sleeps in scenarios.
- Preserve raw PTY bytes and normalized rendered-screen evidence separately.
- Public schemas are versioned from day one.
- Tests must reproduce from a fixed seed or a deterministic trace.
- Do not add RackMind-specific selectors, fixtures, credentials, prompts, server logic, or policies here.

## Git Workflow

- `main` is protected and releasable.
- Work on focused feature branches and open PRs.
- Conventional commits.
- Never commit `.env`, trace bundles, recordings, `node_modules`, `dist`, or secrets.
