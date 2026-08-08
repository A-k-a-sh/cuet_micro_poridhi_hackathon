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
    
    // Idempotency: If booking is already confirmed or failed, do not process again
    if (booking.status !== 'PENDING_PAYMENT') {
      console.log(`[Payment] Booking ${booking_ref} is already in state ${booking.status}. Ignoring callback.`);
      await client.query('COMMIT');
      return { status: 'ignored_invalid_state' };
    }

    if (status === 'SUCCEEDED') {
      // Update booking to OTP_PENDING (or CONFIRMED depending on OTP flow requirement)
      await client.query(
        "UPDATE bookings SET status = 'OTP_PENDING' WHERE booking_ref = $1",
        [booking_ref]
      );
      
      // Update seat status to confirmed
      await client.query(
        "UPDATE seats SET status = 'confirmed' WHERE id = $1",
        [booking.seat_id]
      );
    } else if (status === 'FAILED') {
      // Payment failed, release the seat
      await client.query(
        "UPDATE bookings SET status = 'FAILED' WHERE booking_ref = $1",
        [booking_ref]
      );
      
      await client.query(
        "UPDATE seats SET status = 'available' WHERE id = $1",
        [booking.seat_id]
      );
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
