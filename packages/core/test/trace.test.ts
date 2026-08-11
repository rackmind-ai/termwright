import { describe, expect, it } from 'vitest';
import { TraceRecorder } from '../src/trace.js';

describe('TraceRecorder', () => {
  it('sequences records and evicts the oldest records at its bound', () => {
    const trace = new TraceRecorder('session', 2, '2025-01-01T00:00:00.000Z');
    trace.emit({ type: 'closed', timestamp: '1' });
    trace.emit({ type: 'closed', timestamp: '2' });
    trace.emit({ type: 'closed', timestamp: '3' });

    expect(trace.snapshot()).toMatchObject({
      protocolVersion: 1,
      sessionId: 'session',
      droppedRecords: 1,
      records: [{ sequence: 2 }, { sequence: 3 }],
    });
  });
});
