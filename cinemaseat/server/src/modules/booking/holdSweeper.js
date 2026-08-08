import pool from '../../db/postgres.js';

export const sweepExpiredHolds = async () => {
  try {
    // Atomically release expired holds:
    // 1. Find HELD bookings past their expiry
    // 2. Mark them as EXPIRED
    // 3. Mark the corresponding seat as 'available'
    const result = await pool.query(`
      WITH expired_bookings AS (
        UPDATE bookings 
        SET status = 'EXPIRED' 
        WHERE status = 'HELD' AND expires_at <= NOW() 
        RETURNING seat_id, booking_ref, show_id
      )
      UPDATE seats 
      SET status = 'available' 
      FROM expired_bookings 
      WHERE seats.id = expired_bookings.seat_id
      RETURNING seats.id as seat_id, expired_bookings.show_id, expired_bookings.booking_ref;
    `);
    
    if (result.rowCount > 0) {
      console.log(`[Sweeper] Cleaned up ${result.rowCount} expired holds.`);
      return result.rows;
    }
    return [];
  } catch (err) {
    console.error('[Sweeper] Error cleaning up expired holds:', err.message);
    return [];
  }
};

export const startHoldSweeper = (intervalMs = 10000, onExpired) => {
  setInterval(async () => {
    const expired = await sweepExpiredHolds();
    if (expired.length > 0 && typeof onExpired === 'function') {
      expired.forEach(e => onExpired(e));
    }
  }, intervalMs);
};
