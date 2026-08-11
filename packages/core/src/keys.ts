import type { KeyModifiers, NamedKey } from '@termwright/protocol';

const NAMED_KEYS = new Map<NamedKey, string>([
  ['ArrowDown', '\u001b[B'],
  ['ArrowLeft', '\u001b[D'],
  ['ArrowRight', '\u001b[C'],
  ['ArrowUp', '\u001b[A'],
  ['Backspace', '\u007f'],
  ['Delete', '\u001b[3~'],
  ['End', '\u001b[F'],
  ['Enter', '\r'],
  ['Escape', '\u001b'],
  ['Home', '\u001b[H'],
  ['Insert', '\u001b[2~'],
  ['PageDown', '\u001b[6~'],
  ['PageUp', '\u001b[5~'],
  ['Space', ' '],
  ['Tab', '\t'],
  ['F1', '\u001bOP'],
  ['F2', '\u001bOQ'],
  ['F3', '\u001bOR'],
  ['F4', '\u001bOS'],
  ['F5', '\u001b[15~'],
  ['F6', '\u001b[17~'],
  ['F7', '\u001b[18~'],
  ['F8', '\u001b[19~'],
  ['F9', '\u001b[20~'],
  ['F10', '\u001b[21~'],
  ['F11', '\u001b[23~'],
  ['F12', '\u001b[24~'],
]);

export function encodeKey(key: string, modifiers: KeyModifiers = {}): string {
  const named = NAMED_KEYS.get(key as NamedKey);
  let value = named ?? key;

  if (modifiers.ctrl) {
    const controlCode = key.toUpperCase().charCodeAt(0);
    if (key.length !== 1 || controlCode < 64 || controlCode > 95) {
      throw new TypeError(
        `Ctrl modifier requires a compatible single-character key, received ${JSON.stringify(key)}`,
      );
    }
    value = String.fromCharCode(controlCode & 0x1f);
  }
  if (modifiers.shift && !named && key.length === 1) value = value.toUpperCase();
  if (modifiers.alt) value = `\u001b${value}`;
  return value;
}
