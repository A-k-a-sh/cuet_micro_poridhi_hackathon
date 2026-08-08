import pool from '../../db/postgres.js';
import redisClient from '../../db/redis.js';

/**
 * Idempotent payment callback handler
 */
export const processPaymentCallback = async (payload) => {
  const { event_id, payment_id, booking_ref, status, amount } = payload;
  
  // 1. Idempotency check with Redis (optional but good for duplicate events quickly)
  const idempotencyKey = `callback:${event_id}`;
  const isDuplicate = await redisClient.setNX(idempotencyKey, 'processed');
  if (!isDuplicate) {
    console.log(`[Payment] Duplicate callback intercepted: ${event_id}`);
    return { status: 'duplicate_ignored' };
  }
  
  // Set expiry on idempotency key to avoid leaking memory, 24 hours is safe
  await redisClient.expire(idempotencyKey, 86400);

  // 2. Validate current booking state inside transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const bookingQuery = await client.query(
      "SELECT status, payment_id, seat_id FROM bookings WHERE booking_ref = $1 FOR UPDATE",
      [booking_ref]
    );
    
    if (bookingQuery.rowCount === 0) {
      throw new Error(`Booking not found: ${booking_ref}`);
    }
    
    const booking = bookingQuery.rows[0];
    
    // Check if the payment_id matches what we recorded during /pay
    if (booking.payment_id !== payment_id) {
      throw new Error(`Payment ID mismatch for booking ${booking_ref}`);
    }
    
    // Idempotency: valid entry states per event type
    const validEntryStates = {
      SUCCEEDED: 'PENDING_PAYMENT',
      FAILED:    'PENDING_PAYMENT',
      REFUNDED:  'REFUND_PENDING',
    };
    const expectedState = validEntryStates[status];
    if (!expectedState || booking.status !== expectedState) {
      console.log(`[Payment] Booking ${booking_ref} in state ${booking.status}, expected ${expectedState} for event ${status}. Ignoring.`);
      await client.query('COMMIT');
      return { status: 'ignored_invalid_state' };
    }

    if (status === 'SUCCEEDED') {
      // PENDING_PAYMENT → OTP_PENDING (user must verify OTP to fully confirm)
      await client.query(
        "UPDATE bookings SET status = 'OTP_PENDING' WHERE booking_ref = $1",
        [booking_ref]
      );
      // Seat is now logically confirmed — lock it down
      await client.query(
        "UPDATE seats SET status = 'confirmed' WHERE id = $1",
        [booking.seat_id]
      );
    } else if (status === 'FAILED') {
      // PENDING_PAYMENT → FAILED, release the seat
      await client.query(
        "UPDATE bookings SET status = 'FAILED' WHERE booking_ref = $1",
        [booking_ref]
      );
      await client.query(
        "UPDATE seats SET status = 'available' WHERE id = $1",
        [booking.seat_id]
      );
    } else if (status === 'REFUNDED') {
      // REFUND_PENDING → REFUNDED, seat goes back to available
      await client.query(
        "UPDATE bookings SET status = 'REFUNDED' WHERE booking_ref = $1",
        [booking_ref]
      );
      await client.query(
        "UPDATE seats SET status = 'available' WHERE id = $1",
        [booking.seat_id]
      );
      console.log(`[Payment] Refund completed for booking ${booking_ref}. Seat released.`);
    }
    
    await client.query('COMMIT');
    return { status: 'processed', result: status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
