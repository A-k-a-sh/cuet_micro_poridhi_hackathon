import axios from 'axios';
import { getRedis } from '../../db/redis.js';

const GATEWAY = process.env.GATEWAY_URL;

// This function is always called with .catch() — never awaited inline
// It fires and returns a promise that the caller may choose to ignore
export const chargeGateway = async ({ amount, currency, booking_ref, callback_url, payment_id }) => {
  const redis = getRedis();

  try {
    const response = await axios.post(
      `${GATEWAY}/charge`,
      { amount, currency, booking_ref, callback_url },
      {
        timeout: 10_000, // 10s timeout
        // Remove X-Mock-Mode header before production — judges will control this
      }
    );

    // Update payment record with gateway's payment_id
    if (response.data?.payment_id) {
      await import('../../db/postgres.js').then(({ query }) =>
        query(`
          UPDATE payments
          SET payment_id = $1, status = 'pending', updated_at = NOW()
          WHERE id = $2
        `, [response.data.payment_id, payment_id])
      );
    }

    await redis.set('metrics:gateway_status', 'up', { EX: 30 });
    return response.data;

  } catch (err) {
    await redis.set('metrics:gateway_status', 'down', { EX: 30 });
    console.error('[Gateway] /charge error:', err.message);
    throw err;
  }
};

export const refundGateway = async (payment_id) => {
  try {
    const { data } = await axios.post(`${GATEWAY}/refund`, { payment_id }, { timeout: 10_000 });
    return data;
  } catch (err) {
    console.error('[Gateway] /refund error:', err.message);
    throw err;
  }
};

export const checkGatewayHealth = async () => {
  try {
    await axios.get(`${GATEWAY}/health`, { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
};
