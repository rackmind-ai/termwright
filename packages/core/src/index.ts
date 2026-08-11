export {
  LocatorError,
  TerminalActionLimitError,
  TerminalClosedError,
  TerminalTimeoutError,
} from './errors.js';
export { encodeKey } from './keys.js';
export {
  LineLocator,
  Locator,
  PromptLocator,
  TextLocator,
  type LocatedLine,
  type LocatorWaitOptions,
} from './locators.js';
export { BoundedOutputBuffer } from './output-buffer.js';
export { SecretRedactor } from './redactor.js';
export {
  TerminalSession,
  type ExitResult,
  type TerminalLaunchOptions,
  type TerminalSessionState,
  type TypeOptions,
  type WaitForStableOptions,
} from './session.js';
export { TraceRecorder, type TraceListener } from './trace.js';
export type {
  KeyModifiers,
  NamedKey,
  ScreenSnapshot,
  TerminalEvent,
  TerminalSize,
  TerminalTrace,
  TraceRecord,
} from '@termwright/protocol';
