# Roadmap

Termwright is pre-alpha and primarily dogfooded against RackMind’s installed CLI.

## Next

- Run the packed RackMind binary through onboarding, login, SSH readiness, chat, resize, and interruption scenarios.
- Make every failure leave a small, replayable trace bundle.
- Build the workflow I actually need: turn a reviewed exploratory trace into a deterministic RackMind regression test.
- Add Linux CI before treating the driver as portable.

## Deliberately deferred

- A browser-like trace viewer.
- A daemon, MCP server, or multi-language SDK.
- General-purpose code generation.
- Windows / ConPTY support until RackMind has a concrete Windows CLI audience.
