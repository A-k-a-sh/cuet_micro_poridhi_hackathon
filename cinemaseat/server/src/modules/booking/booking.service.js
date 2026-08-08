import pool from '../../db/postgres.js';
import redisClient from '../../db/redis.js';

export const holdSeat = async (showId, seatId, userId) => {
  const ttlSeconds = parseInt(process.env.HOLD_TTL_SECONDS || '60', 10);
  
  // 1. Atomic update in Postgres to acquire lock
  const result = await pool.query(
    "UPDATE seats SET status='held' WHERE id=$1 AND status='available' RETURNING id",
    [seatId]
  );
  
  if (result.rowCount === 0) {
    throw new Error('Seat is not available or already taken');
  }
  
  // 2. Set hold TTL in Redis
  const holdKey = `hold:${seatId}:${showId}`;
  await redisClient.set(holdKey, 'held', { EX: ttlSeconds });
  
  // Generate a unique booking reference
  const bookingRef = `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  
  // 3. Create booking record in Postgres
  await pool.query(
    "INSERT INTO bookings (booking_ref, show_id, seat_id, user_id, status, expires_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [bookingRef, showId, seatId, userId, 'HELD', expiresAt]
  );
  
  return { booking_ref: bookingRef, expires_at: expiresAt };
};

export const transitionToPendingPayment = async (bookingRef, paymentId) => {
  // HELD -> PENDING_PAYMENT: Set payment_id in the same UPDATE. Never two separate writes.
  const result = await pool.query(
    "UPDATE bookings SET status='PENDING_PAYMENT', payment_id=$1 WHERE booking_ref=$2 AND status='HELD' RETURNING *",
    [paymentId, bookingRef]
  );
  
  if (result.rowCount === 0) {
    throw new Error('Invalid state transition or booking reference');
  }
  
  return result.rows[0];
};
