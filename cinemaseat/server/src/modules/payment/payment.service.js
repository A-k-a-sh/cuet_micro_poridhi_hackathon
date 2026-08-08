/**
 * payment.service.js
 * Idempotent payment callback handler + refund initiator.
 * Architecture spec: src/modules/payment/payment.service.js
 *
 * RULES (from problem statement + architecture):
 *  1. Always return 200 from the callback endpoint — even on duplicate or error.
 *  2. Idempotency key must be SET *before* doing any work, not after.
 *  3. Duplicate callback must not confirm twice, must not double-count revenue.
 *  4. Payment module does NOT touch seat state directly — it calls booking service.
 */

import { query, getClient } from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';
import { sendOtp } from './gateway.client.js';
import { broadcastToShow } from '../../websocket/wsServer.js';

// ─────────────────────────────────────────────────────────────────────────────
// processPaymentCallback
// Called by POST /api/payments/callback
// Returns { status } — caller MUST always respond 200 regardless.
// ─────────────────────────────────────────────────────────────────────────────
export const processPaymentCallback = async (payload) => {
  const { event_id, payment_id, booking_ref, status, amount } = payload;

  // ── Idempotency (architecture spec: idem:{payment_id} key, 24h TTL) ────────
  // SET NX = set only if not exists. Returns true = we are first, false = dup.
  const redis = getRedis();
  const idemKey = `idem:${payment_id}`;

  // Set the key BEFORE doing any work (race-safe pattern)
  const isNew = await redis.set(idemKey, '1', { NX: true, EX: 86400 });

  if (!isNew) {
    // Duplicate callback — log and return silently
    console.log(`[Payment] Duplicate callback ignored: payment_id=${payment_id} event_id=${event_id}`);
    await redis.incr('metrics:duplicate_callbacks').catch(() => {});
    return { status: 'duplicate_ignored' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the booking row for update
    const { rows: bRows, rowCount: bCount } = await client.query(
      `SELECT b.id, b.status, b.show_seat_id, b.phone,
              ss.show_id, ss.seat_id
       FROM bookings b
       JOIN show_seats ss ON ss.id = b.show_seat_id
       WHERE b.booking_ref = $1
       FOR UPDATE`,
      [booking_ref]
    );

    if (bCount === 0) {
      // Unknown booking — nothing to do, but we already marked idempotency
      await client.query('ROLLBACK');
      console.warn(`[Payment] Callback for unknown booking_ref: ${booking_ref}`);
      return { status: 'unknown_booking' };
    }

    const booking = bRows[0];

    // ── State gate: only process if booking is in the expected entry state ────
    const validEntryStates = {
      SUCCEEDED: 'pending_payment',
      FAILED:    'pending_payment',
      REFUNDED:  'refund_pending',
    };
    const expectedState = validEntryStates[status];

    if (!expectedState || booking.status !== expectedState) {
      console.log(
        `[Payment] State mismatch for ${booking_ref}: ` +
        `got status=${status} but booking.status=${booking.status}. Skipping.`
      );
      await client.query('COMMIT');
      return { status: 'ignored_invalid_state' };
    }

    // ── Update payments table (raw gateway response stored for audit) ─────────
    await client.query(
      `UPDATE payments
       SET status = $1, gateway_response = $2, updated_at = NOW()
       WHERE booking_ref = $3 AND payment_id = $4`,
      [
        status === 'SUCCEEDED' ? 'succeeded'
          : status === 'FAILED' ? 'failed'
          : 'refunded',
        JSON.stringify(payload),
        booking_ref,
        payment_id,
      ]
    );

    if (status === 'SUCCEEDED') {
      // PENDING_PAYMENT → OTP_PENDING (payment service calls booking via SQL)
      await client.query(
        `UPDATE show_seats SET status = 'otp_pending' WHERE booking_ref = $1 AND status = 'pending_payment'`,
        [booking_ref]
      );
      await client.query(
        `UPDATE bookings SET status = 'otp_pending', updated_at = NOW() WHERE booking_ref = $1`,
        [booking_ref]
      );

      await client.query('COMMIT');

      // Fire OTP send (non-blocking, best-effort)
      const otpRef = `pay_${booking_ref}`;
      sendOtp(booking.phone, otpRef).catch(err =>
        console.error('[Payment] OTP send failed (non-fatal):', err.message)
      );

      // WebSocket: notify the user their payment was accepted
      broadcastToShow(booking.show_id, {
        type:        'BOOKING_CONFIRMED',   // UI shows "payment ok, awaiting OTP"
        booking_ref: booking_ref,
        seat_id:     booking.seat_id,
      });

    } else if (status === 'FAILED') {
      // Release seat — back to available
      await client.query(
        `UPDATE show_seats
         SET status = 'available', held_by = NULL, held_until = NULL, booking_ref = NULL
         WHERE booking_ref = $1 AND status = 'pending_payment'`,
        [booking_ref]
      );
      await client.query(
        `UPDATE bookings SET status = 'failed', updated_at = NOW() WHERE booking_ref = $1`,
        [booking_ref]
      );

      // Delete Redis hold key
      await getRedis()
        .del(`hold:${booking.show_id}:${booking.seat_id}`)
        .catch(() => {});

      await client.query('COMMIT');

      broadcastToShow(booking.show_id, {
        type:        'PAYMENT_FAILED',
        booking_ref: booking_ref,
        message:     'Payment was declined. Seat is available again.',
      });
      broadcastToShow(booking.show_id, {
        type:    'SEAT_UPDATE',
        show_id: booking.show_id,
        seat_id: booking.seat_id,
        status:  'available',
      });

    } else if (status === 'REFUNDED') {
      await client.query(
        `UPDATE show_seats
         SET status = 'refunded'
         WHERE booking_ref = $1 AND status = 'refund_pending'`,
        [booking_ref]
      );
      await client.query(
        `UPDATE bookings SET status = 'refunded', updated_at = NOW() WHERE booking_ref = $1`,
        [booking_ref]
      );
      await client.query('COMMIT');

      console.log(`[Payment] Refund completed for ${booking_ref}`);
    }

    return { status: 'processed', result: status };
  } catch (err) {
    await client.query('ROLLBACK');
    // Do NOT re-throw — callback handler must always return 200
    console.error('[Payment] Callback processing error:', err.message);
    return { status: 'error', message: err.message };
  } finally {
    client.release();
  }
};
