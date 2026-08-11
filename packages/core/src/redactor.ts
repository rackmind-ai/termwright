const REDACTION = '[REDACTED]';

/**
 * Streaming literal redactor. It holds only suffixes that could become a secret,
 * which prevents split PTY chunks from leaking part of a registered value.
 */
export class SecretRedactor {
  #secrets = new Set<string>();
  #pending = '';

  add(secret: string): void {
    if (secret.length > 0) this.#secrets.add(secret);
  }

  push(value: string): string {
    if (this.#secrets.size === 0) return value;
    this.#pending += value;
    return this.#drain(false);
  }

  flush(): string {
    return this.#drain(true);
  }

  #drain(flush: boolean): string {
    let output = '';
    while (this.#pending.length > 0) {
      const fullMatch = [...this.#secrets].find((secret) => this.#pending.startsWith(secret));
      if (fullMatch) {
        output += REDACTION;
        this.#pending = this.#pending.slice(fullMatch.length);
        continue;
      }

      const possibleSecret = [...this.#secrets].some((secret) => secret.startsWith(this.#pending));
      if (possibleSecret) {
        if (flush) {
          output += REDACTION;
          this.#pending = '';
        }
        break;
      }

      const [first = ''] = this.#pending;
      output += first;
      this.#pending = this.#pending.slice(first.length);
    }
    return output;
  }
}
