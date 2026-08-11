# Architecture

Termwright separates four concerns even though the first implementation stays in one process:

```text
scenario / property test / constrained agent
                    |
                    v
          controller + lazy locators
                    |
                    v
            PTY process driver
              |           |
              v           v
       xterm screen     raw output
              |           |
              +-----+-----+
                    v
             versioned trace
```

## PTY driver

The driver launches an exact executable and argument vector with `node-pty`. It owns process lifecycle, terminal dimensions, deadlines, output bounds, action budgets, and teardown. It never accepts a shell command string.

## Screen model

Raw output is fed to `@xterm/headless`. Tests inspect the current rendered viewport after ANSI cursor movement and redraws have been applied. Raw bytes remain separate evidence; rendered text is the assertion surface.

## Locators and actionability

Locators are lazy queries evaluated against the latest screen. Before sending input, higher-level scenarios can require that the process is alive, output parsing has settled, the expected prompt is visible, and the screen has remained unchanged for a bounded interval.

## Deterministic and agentic layers

Agents use the same controller as deterministic tests, but through a smaller policy-enforced action set. They can observe, type public or secret input, press named keys, resize to approved dimensions, wait for stability, and assert visibility. They cannot execute shell commands, browse files, alter environments, or access arbitrary network endpoints through Termwright.

An agent finding is not a permanent oracle. The run emits a reproducible action trace which should be minimized into a deterministic regression test.

## Product adapters

Application-specific fakes, selectors, fixtures, credentials, safety leases, and assertions stay in the application repository. Termwright provides generic plugin seams; it does not know about RackMind, Proxmox, authentication providers, or any other product.
