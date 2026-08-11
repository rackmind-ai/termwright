# Contributing to Termwright

Thanks for helping make terminal applications easier to test.

## Setup

1. Install Node.js 20.18.1 or newer and your platform's native C/C++ build tools.
2. Run `npm install`.
3. Run `npm run check && npm run build` before submitting changes.

## Pull requests

- Keep changes focused and add tests for behavior changes.
- Use conventional commit titles.
- Describe the terminal/platform matrix you verified.
- Attach a minimized trace or deterministic reproduction for PTY bugs.
- Never include credentials, private command output, or real infrastructure details.

## Design expectations

- Conditions and retries should be observable and bounded.
- Public APIs must not expose cached terminal row coordinates.
- Platform-specific behavior belongs behind a typed adapter.
- An agent-discovered issue becomes a deterministic regression test before it gates merges.
