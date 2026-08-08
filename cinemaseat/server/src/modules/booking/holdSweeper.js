/**
 * holdSweeper.js
 * Background job: sweeps expired holds from show_seats and releases Redis keys.
 * Architecture spec: src/modules/booking/holdSweeper.js
 *
 * Runs every `intervalMs` (default 30 000 ms per spec).
 * For each expired hold it:
 *   1. Resets show_seats back to 'available' in Postgres
 *   2. DELetes the Redis hold key so the seat map fast-path is consistent
 *   3. Calls onExpired(row) so wsServer can broadcast HOLD_EXPIRED + SEAT_UPDATE
 */

import { query } from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';

// ─────────────────────────────────────────────────────────────────────────────
// sweepExpiredHolds
// SQL from architecture/database spec — single atomic UPDATE.
// Returns array of { show_id, seat_id, booking_ref } for broadcast.
// ─────────────────────────────────────────────────────────────────────────────
export const sweepExpiredHolds = async () => {
  try {
    const { rows, rowCount } = await query(`
      UPDATE show_seats
      SET
        status      = 'available',
        held_by     = NULL,
        held_until  = NULL,
        booking_ref = NULL
      WHERE
        status     = 'held'
        AND held_until < NOW()
      RETURNING show_id, seat_id, booking_ref
    `);

    if (rowCount === 0) return [];

    console.log(`[Sweeper] Released ${rowCount} expired hold(s).`);

    // Also expire their bookings row so the state is consistent
    const refs = rows.map(r => r.booking_ref).filter(Boolean);
    if (refs.length > 0) {
      // Parameterised IN-list: UPDATE bookings SET status='expired' WHERE booking_ref = ANY($1)
      await query(
        `UPDATE bookings SET status = 'expired', updated_at = NOW()
         WHERE booking_ref = ANY($1::text[])`,
        [refs]
      );
    }

    // DEL Redis hold keys so seat-map fast-path matches Postgres truth
    const redis = getRedis();
    if (redis) {
      const delKeys = rows.map(r => `hold:${r.show_id}:${r.seat_id}`);
      if (delKeys.length > 0) {
        await redis.del(delKeys).catch(err =>
          console.error('[Sweeper] Redis DEL failed (non-fatal):', err.message)
        );
      }
    }

    return rows; // caller (app.js) uses these to broadcast
  } catch (err) {
    console.error('[Sweeper] Error during sweep:', err.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// startHoldSweeper
// Called once from app.js. onExpired(row) fires for each released seat.
// ─────────────────────────────────────────────────────────────────────────────
export const startHoldSweeper = (intervalMs = 30_000, onExpired) => {
  const sweep = async () => {
    const expired = await sweepExpiredHolds();
    if (typeof onExpired === 'function') {
      expired.forEach(row => onExpired(row));
    }
  };

  setInterval(sweep, intervalMs);
  console.log(`[Sweeper] Hold sweeper started (every ${intervalMs / 1000}s)`);
};
