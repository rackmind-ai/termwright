import { describe, expect, it } from 'vitest';
import { SecretRedactor } from '../src/redactor.js';

describe('SecretRedactor', () => {
  it('redacts secrets split across output chunks', () => {
    const redactor = new SecretRedactor();
    redactor.add('correct-horse');

    expect(redactor.push('value=correct-')).toBe('value=');
    expect(redactor.push('horse!')).toBe('[REDACTED]!');
    expect(redactor.flush()).toBe('');
  });

  it('redacts a partial echo when the stream ends', () => {
    const redactor = new SecretRedactor();
    redactor.add('secret');

    expect(redactor.push('sec')).toBe('');
    expect(redactor.flush()).toBe('[REDACTED]');
  });
});
