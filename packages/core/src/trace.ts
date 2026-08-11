import {
  PROTOCOL_VERSION,
  type TerminalEvent,
  type TerminalTrace,
  type TraceRecord,
} from '@termwright/protocol';

export type TraceListener = (record: TraceRecord) => void;

export class TraceRecorder {
  readonly sessionId: string;
  readonly startedAt: string;

  #records: TraceRecord[] = [];
  #listeners = new Set<TraceListener>();
  #nextSequence = 1;
  #droppedRecords = 0;
  #maxRecords: number;

  constructor(sessionId: string, maxRecords = 10_000, startedAt = new Date().toISOString()) {
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) {
      throw new RangeError('maxTraceRecords must be a positive safe integer');
    }
    this.sessionId = sessionId;
    this.startedAt = startedAt;
    this.#maxRecords = maxRecords;
  }

  emit(event: TerminalEvent): TraceRecord {
    const record: TraceRecord = {
      protocolVersion: PROTOCOL_VERSION,
      sequence: this.#nextSequence++,
      sessionId: this.sessionId,
      event,
    };
    this.#records.push(record);
    if (this.#records.length > this.#maxRecords) {
      this.#records.shift();
      this.#droppedRecords += 1;
    }
    for (const listener of this.#listeners) listener(record);
    return record;
  }

  onRecord(listener: TraceListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshot(): TerminalTrace {
    return {
      protocolVersion: PROTOCOL_VERSION,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      droppedRecords: this.#droppedRecords,
      records: this.#records.map((record) => ({
        ...record,
        event: { ...record.event },
      })),
    };
  }
}
