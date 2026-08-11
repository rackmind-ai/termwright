# Security Policy

## Supported versions

Termwright is pre-alpha. Security fixes are applied to the latest commit on `main` until the first versioned release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for `JanicsJophles/termwright`. Do not open a public issue for secret leakage, process escape, command injection, unsafe child-process handling, or trace-redaction failures.

## Threat model

Termwright executes user-supplied programs inside a PTY. A PTY is not a sandbox. Run untrusted targets inside a dedicated container or VM and with a low-privilege account. Agent mode never receives shell or filesystem tools from Termwright, but the target process still has the operating-system privileges of its parent.
