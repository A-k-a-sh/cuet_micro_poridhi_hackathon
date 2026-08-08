import { query } from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';
import { broadcast } from '../../websocket/wsServer.js';

export const startHoldSweeper = () => {
  const SWEEP_INTERVAL = parseInt(process.env.SWEEP_INTERVAL_MS || '30000', 10);

  const sweep = async () => {
    try {
      // Find holds that have passed their held_until timestamp
      const { rows: expiredHolds } = await query(`
        UPDATE show_seats
        SET
          status = 'available',
          held_by = NULL,
          held_until = NULL,
          booking_ref = NULL
        WHERE
          status = 'held'
          AND held_until < NOW()
        RETURNING show_id, seat_id, booking_ref
      `);

      if (expiredHolds.length === 0) return;

      console.log(`[Sweeper] Released ${expiredHolds.length} expired holds`);

      const redis = getRedis();

      for (const hold of expiredHolds) {
        // Update booking status
        await query(`
          UPDATE bookings
          SET status = 'refunded', updated_at = NOW()
          WHERE booking_ref = $1 AND status = 'held'
        `, [hold.booking_ref]);

        // Clean Redis key (may already be gone)
        await redis.del(`hold:${hold.show_id}:${hold.seat_id}`).catch(() => {});

        // Update metrics
        await redis.decr('metrics:active_holds').catch(() => {});

        // Log metric
        await query(`
          INSERT INTO metrics_log (event_type, booking_ref, metadata)
          VALUES ('hold_expired', $1, $2)
        `, [hold.booking_ref, JSON.stringify({ show_id: hold.show_id, seat_id: hold.seat_id })]);

        // Broadcast: seat is available again
        broadcast({
          type: 'SEAT_UPDATE',
          show_id: hold.show_id,
          seat_id: hold.seat_id,
          status: 'available',
          expires_at: null
        });

        // Broadcast: hold expired (notify the holding user if connected)
        broadcast({
          type: 'HOLD_EXPIRED',
          booking_ref: hold.booking_ref,
          seat_id: hold.seat_id
        });
      }
    } catch (err) {
      console.error('[Sweeper] Error:', err.message);
    }
  };

  // Run immediately then on interval
  sweep();
  setInterval(sweep, SWEEP_INTERVAL);
  console.log(`[Sweeper] Started (interval: ${SWEEP_INTERVAL / 1000}s)`);
};
