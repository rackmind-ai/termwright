export class BoundedOutputBuffer {
  readonly maxBytes: number;
  #value = Buffer.alloc(0);
  #totalBytes = 0;

  constructor(maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new RangeError('maxOutputBytes must be a positive safe integer');
    }
    this.maxBytes = maxBytes;
  }

  append(value: string): void {
    const next = Buffer.from(value);
    this.#totalBytes += next.byteLength;
    this.#value = Buffer.concat([this.#value, next]);
    if (this.#value.byteLength > this.maxBytes) {
      this.#value = this.#value.subarray(this.#value.byteLength - this.maxBytes);
      // Do not expose a leading UTF-8 continuation byte after truncation.
      while (this.#value.length > 0) {
        const firstByte = this.#value[0];
        if (firstByte === undefined || (firstByte & 0xc0) !== 0x80) break;
        this.#value = this.#value.subarray(1);
      }
    }
  }

  get totalBytes(): number {
    return this.#totalBytes;
  }

  get truncated(): boolean {
    return this.#totalBytes > this.#value.byteLength;
  }

  toString(): string {
    return this.#value.toString('utf8');
  }
}
