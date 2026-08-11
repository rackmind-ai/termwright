import { describe, expect, it } from 'vitest';
import { BoundedOutputBuffer } from '../src/output-buffer.js';

describe('BoundedOutputBuffer', () => {
  it('keeps a byte-bounded tail and tracks total bytes', () => {
    const output = new BoundedOutputBuffer(5);
    output.append('abc');
    output.append('def');

    expect(output.toString()).toBe('bcdef');
    expect(output.totalBytes).toBe(6);
    expect(output.truncated).toBe(true);
  });

  it('does not retain an invalid leading UTF-8 continuation byte', () => {
    const output = new BoundedOutputBuffer(4);
    output.append('a🙂b');

    expect(output.toString()).toBe('b');
    expect(output.toString()).not.toContain('�');
  });
});
