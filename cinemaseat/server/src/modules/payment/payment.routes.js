import { Router } from 'express';
import { processCallback } from './payment.service.js';
import { refundGateway } from './gateway.client.js';
import { requireAuth } from '../../middleware/auth.js';
import { query } from '../../db/postgres.js';

const router = Router();

// POST /api/payments/callback
// Called BY the gateway — no auth middleware.
// MUST always return 200. Never throw to the client.
router.post('/callback', async (req, res) => {
  // Return 200 IMMEDIATELY before doing any processing
  // This prevents the gateway from retrying due to slow processing
  res.status(200).json({ received: true });

  // Process asynchronously after response is sent
  setImmediate(async () => {
    try {
      await processCallback(req.body);
    } catch (err) {
      console.error('[Callback] Processing error (already returned 200):', err.message);
    }
  });
});

// POST /api/payments/:booking_ref/refund
router.post('/:booking_ref/refund', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.payment_id, b.phone
      FROM payments p
      JOIN bookings b ON b.booking_ref = p.booking_ref
      WHERE p.booking_ref = $1 AND p.status = 'succeeded'
    `, [req.params.booking_ref]);

    if (!rows[0] || rows[0].phone !== req.user.phone) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await refundGateway(rows[0].payment_id);
    res.json({ status: 'refund_initiated' });
  } catch (err) { next(err); }
});

export default router;
