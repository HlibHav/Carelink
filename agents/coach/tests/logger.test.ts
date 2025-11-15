import { describe, it, expect, vi } from 'vitest';
import { coachLog } from '../src/telemetry/logger.js';

describe('coachLog', () => {
  it('logs structured JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    coachLog({ event: 'test', userId: 'u1', metadata: { foo: 'bar' } });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.event).toBe('test');
    expect(payload.userId).toBe('u1');
    spy.mockRestore();
  });
});
