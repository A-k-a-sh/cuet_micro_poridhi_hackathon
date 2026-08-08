import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisIncr = jest.fn().mockResolvedValue(1);
const mockBroadcast = jest.fn();

jest.unstable_mockModule('../../src/db/postgres.js', () => ({
  query: mockQuery,
  getClient: jest.fn().mockResolvedValue({
    query: mockQuery,
    release: jest.fn()
  })
}));

jest.unstable_mockModule('../../src/db/redis.js', () => ({
  getRedis: () => ({
    get: mockRedisGet,
    set: mockRedisSet,
    incr: mockRedisIncr,
    del: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(1)
  })
}));

jest.unstable_mockModule('../../src/websocket/wsServer.js', () => ({
  broadcast: mockBroadcast
}));

jest.unstable_mockModule('../../src/modules/auth/auth.service.js', () => ({
  sendOTP: jest.fn().mockResolvedValue({ ref: 'otp-ref' })
}));

const { processCallback } = await import('../../src/modules/payment/payment.service.js');

describe('processCallback — idempotency', () => {
  beforeEach(() => jest.clearAllMocks());

  test('processes SUCCEEDED callback correctly', async () => {
    mockRedisGet.mockResolvedValue(null); // Not seen before
    mockRedisSet.mockResolvedValue('OK');
    mockQuery.mockResolvedValue({
      rows: [{
        booking_ref: 'bk_1',
        payment_id: 'pay_1',
        booking_status: 'pending_payment',
        phone: '01700'
      }]
    });

    const payload = {
      event_id: 'evt_001',
      payment_id: 'pay_1',
      booking_ref: 'bk_1',
      status: 'SUCCEEDED',
      amount: 250
    };

    const result = await processCallback(payload);
    expect(result.processed).toBe(true);
  });

  test('swallows duplicate callback with same event_id', async () => {
    // Simulate already processed
    mockRedisGet.mockResolvedValue('1');

    const payload = {
      event_id: 'evt_001', // Same event_id
      payment_id: 'pay_1',
      booking_ref: 'bk_1',
      status: 'SUCCEEDED',
      amount: 250
    };

    const result = await processCallback(payload);

    expect(result.duplicate).toBe(true);
    expect(mockRedisIncr).toHaveBeenCalledWith('metrics:duplicate_callbacks');
    // Should NOT process payment (only metrics logging is allowed)
    const nonMetricsCalls = mockQuery.mock.calls.filter(call => !call[0].includes('metrics_log'));
    expect(nonMetricsCalls.length).toBe(0);
  });

  test('uses event_id not payment_id for deduplication key', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockQuery.mockResolvedValue({ rows: [{ booking_ref: 'bk_1', payment_id: 'pay_1', booking_status: 'pending_payment', phone: '01700' }] });

    await processCallback({
      event_id: 'evt_unique_123',
      payment_id: 'pay_1',
      booking_ref: 'bk_1',
      status: 'SUCCEEDED',
      amount: 250
    });

    // Key must use event_id
    expect(mockRedisSet).toHaveBeenCalledWith(
      'idem:evt_unique_123',
      '1',
      { EX: 86400 }
    );
  });

  test('releases seat on FAILED callback', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockQuery.mockResolvedValue({
      rows: [{
        booking_ref: 'bk_1',
        payment_id: 'pay_1',
        booking_status: 'pending_payment',
        phone: '01700',
        show_id: 's1',
        seat_id: 'se1'
      }]
    });

    await processCallback({
      event_id: 'evt_fail_001',
      payment_id: 'pay_1',
      booking_ref: 'bk_1',
      status: 'FAILED',
      amount: 250
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAYMENT_FAILED' })
    );
  });
});
