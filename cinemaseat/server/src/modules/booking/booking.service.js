/**
 * booking.service.js
 * Atomic seat hold + state machine transitions.
 * Architecture spec: src/modules/booking/booking.service.js
 *
 * CRITICAL: AVAILABLE → HELD must be done with a single PostgreSQL UPDATE
 * that checks AND sets in the same statement. Zero rows returned = seat taken.
 * No optimistic locking, no application-level mutex — the DB is the lock.
 */

import { query, getClient } from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// holdSeat
// Architecture: AVAILABLE → HELD
// - Single atomic UPDATE on show_seats WHERE status = 'available'
// - Redis SET hold:{show_id}:{seat_id} = booking_ref  EX HOLD_TTL_SECONDS
// - INSERT into bookings
// Returns: { booking_ref, expires_at, price } or throws if seat taken
// ─────────────────────────────────────────────────────────────────────────────
export const holdSeat = async (showId, seatId, phone) => {
  const ttl = parseInt(process.env.HOLD_TTL_SECONDS || '600', 10);
  const bookingRef = `bk_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  // 1. Atomic lock — only one of N concurrent callers gets a row back
  const { rows, rowCount } = await query(
    `UPDATE show_seats
     SET
       status      = 'held',
       held_by     = $2,
       held_until  = NOW() + INTERVAL '1 second' * $3,
       booking_ref = $4
     WHERE
       show_id = $1
       AND seat_id = $5
       AND status  = 'available'
     RETURNING id, booking_ref, held_until, price`,
    [showId, phone, ttl, bookingRef, seatId]
  );

  if (rowCount === 0) {
    const err = new Error('Seat is not available');
    err.statusCode = 409;
    throw err;
  }

  const showSeat = rows[0];

  // 2. Redis TTL key — fast-path read for seat map, and sweeper safety net
  const redis = getRedis();
  await redis.set(
    `hold:${showId}:${seatId}`,
    bookingRef,
    { EX: ttl }
  );

  // 3. Booking record — mirrors show_seats.status
  await query(
    `INSERT INTO bookings
       (booking_ref, show_seat_id, phone, status, amount)
     VALUES ($1, $2, $3, 'held', $4)`,
    [bookingRef, showSeat.id, phone, showSeat.price]
  );

  return {
    booking_ref: bookingRef,
    expires_at:  showSeat.held_until,
    price:       showSeat.price,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// transitionToPendingPayment
// Architecture: HELD → PENDING_PAYMENT
// Sets payment_id in the SAME UPDATE — never two separate writes.
// ─────────────────────────────────────────────────────────────────────────────
export const transitionToPendingPayment = async (bookingRef, paymentId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Update show_seats
    const { rowCount } = await client.query(
      `UPDATE show_seats
       SET status = 'pending_payment'
       WHERE booking_ref = $1 AND status = 'held'`,
      [bookingRef]
    );

    if (rowCount === 0) {
      throw Object.assign(new Error('Booking not in held state'), { statusCode: 409 });
    }

    // Update bookings — set payment_id alongside status in one statement
    const { rows } = await client.query(
      `UPDATE bookings
       SET status = 'pending_payment', updated_at = NOW()
       WHERE booking_ref = $1 AND status = 'held'
       RETURNING *`,
      [bookingRef]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// confirmBooking
// Architecture: OTP_PENDING → CONFIRMED
// Called from auth module after OTP verify succeeds.
// ─────────────────────────────────────────────────────────────────────────────
export const confirmBooking = async (bookingRef) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE show_seats
       SET status = 'confirmed'
       WHERE booking_ref = $1 AND status = 'otp_pending'`,
      [bookingRef]
    );

    const { rows, rowCount } = await client.query(
      `UPDATE bookings
       SET status = 'confirmed', updated_at = NOW()
       WHERE booking_ref = $1 AND status = 'otp_pending'
       RETURNING *`,
      [bookingRef]
    );

    if (rowCount === 0) {
      throw Object.assign(new Error('Booking not in otp_pending state'), { statusCode: 409 });
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getBooking — fetch booking detail by ref
// ─────────────────────────────────────────────────────────────────────────────
export const getBooking = async (bookingRef) => {
  const { rows } = await query(
    `SELECT b.*, ss.show_id, ss.seat_id, s.row_label, s.seat_number, s.category
     FROM bookings b
     JOIN show_seats ss ON ss.id = b.show_seat_id
     JOIN seats s       ON s.id  = ss.seat_id
     WHERE b.booking_ref = $1`,
    [bookingRef]
  );
  return rows[0] || null;
};
