import { describe, expect, it } from 'vitest';
import { encodeKey } from '../src/keys.js';

describe('encodeKey', () => {
  it('encodes named and modified keys', () => {
    expect(encodeKey('Enter')).toBe('\r');
    expect(encodeKey('ArrowUp')).toBe('\u001b[A');
    expect(encodeKey('c', { ctrl: true })).toBe('\u0003');
    expect(encodeKey('x', { alt: true })).toBe('\u001bx');
    expect(encodeKey('a', { shift: true })).toBe('A');
  });

  it('rejects unsupported ctrl combinations', () => {
    expect(() => encodeKey('Enter', { ctrl: true })).toThrow(TypeError);
  });
});
