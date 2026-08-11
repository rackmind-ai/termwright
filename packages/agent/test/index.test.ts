import { describe, expect, it, vi } from 'vitest';
import {
  AgentBudgetExceededError,
  AgentTerminalController,
  type AgentTerminalDriver,
} from '../src/index.js';

function driver(): AgentTerminalDriver {
  return {
    snapshot: () => ({
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      size: { cols: 80, rows: 24 },
      cursor: { x: 0, y: 0 },
      lines: ['ready'],
      text: 'ready',
      ansi: 'ready',
    }),
    type: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    resize: vi.fn(),
    waitForStable: vi.fn(async () => driver().snapshot()),
    getByText: vi.fn(
      () =>
        ({ wait: vi.fn(async () => undefined) }) as unknown as ReturnType<
          AgentTerminalDriver['getByText']
        >,
    ),
  };
}

describe('AgentTerminalController', () => {
  it('redacts secret inputs through the typed driver action', async () => {
    const fake = driver();
    const controller = new AgentTerminalController(fake);

    await controller.typeSecret('secret');

    expect(fake.type).toHaveBeenCalledWith('secret', { secret: true });
    expect(controller.budget().inputCharactersUsed).toBe(6);
  });

  it('enforces action and resize policies', () => {
    const controller = new AgentTerminalController(driver(), {
      maxActions: 1,
      allowedSizes: [{ cols: 80, rows: 24 }],
    });

    controller.resize(80, 24);
    expect(() => controller.observeScreen()).toThrow(AgentBudgetExceededError);
  });
});
