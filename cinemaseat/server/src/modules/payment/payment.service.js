import { query, getClient } from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';
import { createError } from '../../middleware/errorHandler.js';
import { transitionToOTPPending } from '../booking/booking.service.js';
import { sendOTP } from '../auth/auth.service.js';
import { broadcast } from '../../websocket/wsServer.js';

export const createPaymentRecord = async (booking_ref, amount) => {
  const { rows } = await query(`
    INSERT INTO payments (booking_ref, amount, status)
    VALUES ($1, $2, 'initiated')
    RETURNING id
  `, [booking_ref, amount]);
  return rows[0];
};

// *** THIS IS THE MOST CRITICAL FUNCTION IN THE SYSTEM ***
// The gateway calls this endpoint. It may be called twice (8% of the time).
// It MUST return 200 no matter what happens internally.
// Any non-200 response triggers infinite gateway retries.
export const processCallback = async (payload) => {
  // event_id is the correct deduplication key per gateway spec.
  // A duplicate callback carries the SAME event_id as the original.
  // payment_id is NOT reliable for this — use event_id.
  const { event_id, payment_id, booking_ref, status, amount } = payload;
  const redis = getRedis();

  if (!event_id) {
    console.warn('[Callback] Missing event_id in payload — cannot deduplicate safely');
  }

  const idempotencyKey = `idem:${event_id || payment_id}`;
  const alreadyProcessed = await redis.get(idempotencyKey).catch(() => null);

  if (alreadyProcessed) {
    await redis.incr('metrics:duplicate_callbacks').catch(() => {});
    await query(`
      INSERT INTO metrics_log (event_type, booking_ref, metadata)
      VALUES ('duplicate_callback', $1, $2)
    `, [booking_ref, JSON.stringify({ event_id, payment_id, status })]).catch(() => {});

    console.log(`[Callback] Duplicate detected for event_id=${event_id || payment_id}. Swallowed.`);
    return { duplicate: true };
  }

  // Mark BEFORE doing work — prevents race on simultaneous duplicate delivery
  await redis.set(idempotencyKey, '1', { EX: 86400 });

  // --- PAYMENT RECORD VERIFICATION ---
  const { rows: payments } = await query(`
    SELECT p.*, b.status AS booking_status, b.phone
    FROM payments p
    JOIN bookings b ON b.booking_ref = p.booking_ref
    WHERE p.booking_ref = $1
    ORDER BY p.created_at DESC
    LIMIT 1
  `, [booking_ref]);

  if (!payments[0]) {
    console.error(`[Callback] No payment record for booking_ref=${booking_ref}`);
    return { error: 'unknown_booking' };
  }

  const payment = payments[0];

  // --- SUBTLE CASE: stale payment_id from a previous attempt ---
  // If the payment_id in callback doesn't match what we stored, ignore it.
  // This guards against a retried /charge from a previous attempt sneaking through.
  if (payment.payment_id && payment.payment_id !== payment_id) {
    console.warn(`[Callback] payment_id mismatch. Expected ${payment.payment_id}, got ${payment_id}. Ignoring.`);
    return { ignored: true };
  }

  // --- PROCESS BY STATUS ---
  if (status === 'SUCCEEDED') {
    await handleSucceeded(booking_ref, payment_id, amount, payload, payment.phone);
  } else if (status === 'FAILED') {
    await handleFailed(booking_ref, payment_id, payload);
  } else if (status === 'REFUNDED') {
    await handleRefunded(booking_ref, payment_id, payload);
  }

  return { processed: true, status };
};

const handleSucceeded = async (booking_ref, payment_id, amount, rawPayload, phone) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Update payment record
    await client.query(`
      UPDATE payments
      SET payment_id = $1, status = 'succeeded', gateway_response = $2, updated_at = NOW()
      WHERE booking_ref = $3
    `, [payment_id, JSON.stringify(rawPayload), booking_ref]);

    // Transition booking: pending_payment → otp_pending
    await client.query(`
      UPDATE bookings
      SET status = 'otp_pending', updated_at = NOW()
      WHERE booking_ref = $1 AND status = 'pending_payment'
    `, [booking_ref]);

    const { rows: seatRows } = await client.query(`
      UPDATE show_seats SET status = 'otp_pending' WHERE booking_ref = $1
      RETURNING show_id, seat_id
    `, [booking_ref]);

    await client.query('COMMIT');

    // Send booking confirmation OTP to the user's phone
    try {
      await sendOTP(phone); // Reuse same sendOTP, ref stored in Redis
    } catch (err) {
      console.warn('[Callback] OTP send failed, user can request resend:', err.message);
    }

    // Notify user via WebSocket
    broadcast({
      type: 'PAYMENT_SUCCEEDED',
      booking_ref,
      message: 'Payment confirmed! Check your phone for the confirmation OTP.'
    });

    if (seatRows[0]) {
      broadcast({
        type: 'SEAT_UPDATE',
        show_id: seatRows[0].show_id,
        seat_id: seatRows[0].seat_id,
        status: 'otp_pending',
        expires_at: null
      });
    }

    await import('../../db/postgres.js').then(({ query }) =>
      query(`
        INSERT INTO metrics_log (event_type, booking_ref)
        VALUES ('payment_succeeded', $1)
      `, [booking_ref])
    );

    console.log(`[Callback] Payment SUCCEEDED for ${booking_ref}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Callback] Error processing SUCCEEDED:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

const handleFailed = async (booking_ref, payment_id, rawPayload) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE payments
      SET payment_id = $1, status = 'failed', gateway_response = $2, updated_at = NOW()
      WHERE booking_ref = $3
    `, [payment_id, JSON.stringify(rawPayload), booking_ref]);

    // Release the seat back to available
    const { rows } = await client.query(`
      UPDATE show_seats
      SET status = 'available', held_by = NULL, held_until = NULL, booking_ref = NULL
      WHERE booking_ref = $1
      RETURNING show_id, seat_id
    `, [booking_ref]);

    await client.query(`
      UPDATE bookings
      SET status = 'refunded', updated_at = NOW()
      WHERE booking_ref = $1
    `, [booking_ref]);

    await client.query('COMMIT');

    if (rows[0]) {
      const redis = getRedis();
      await redis.del(`hold:${rows[0].show_id}:${rows[0].seat_id}`).catch(() => {});
      await redis.decr('metrics:active_holds').catch(() => {});

      broadcast({
        type: 'SEAT_UPDATE',
        show_id: rows[0].show_id,
        seat_id: rows[0].seat_id,
        status: 'available',
        expires_at: null
      });
    }

    broadcast({
      type: 'PAYMENT_FAILED',
      booking_ref,
      message: 'Payment failed. The seat has been released. Please try again.'
    });

    await import('../../db/postgres.js').then(({ query }) =>
      query(`
        INSERT INTO metrics_log (event_type, booking_ref)
        VALUES ('payment_failed', $1)
      `, [booking_ref])
    );

    console.log(`[Callback] Payment FAILED for ${booking_ref}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const handleRefunded = async (booking_ref, payment_id, rawPayload) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE payments
      SET status = 'refunded', gateway_response = $1, updated_at = NOW()
      WHERE booking_ref = $2
    `, [JSON.stringify(rawPayload), booking_ref]);

    const { rows } = await client.query(`
      UPDATE show_seats
      SET status = 'available', held_by = NULL, held_until = NULL, booking_ref = NULL
      WHERE booking_ref = $1
      RETURNING show_id, seat_id
    `, [booking_ref]);

    await client.query(`
      UPDATE bookings SET status = 'refunded', updated_at = NOW()
      WHERE booking_ref = $1
    `, [booking_ref]);

    await client.query('COMMIT');

    if (rows[0]) {
      broadcast({
        type: 'SEAT_UPDATE',
        show_id: rows[0].show_id,
        seat_id: rows[0].seat_id,
        status: 'available',
        expires_at: null
      });
    }

    console.log(`[Callback] Refund processed for ${booking_ref}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
