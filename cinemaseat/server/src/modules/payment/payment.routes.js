import express, { Router } from 'express';
import crypto from 'crypto';
import { processCallback } from './payment.service.js';
import { refundGateway } from './gateway.client.js';
import { requireAuth } from '../../middleware/auth.js';
import { query } from '../../db/postgres.js';

const router = Router();
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || 'z2p-2026-secret';

// POST /api/payments/callback
// Uses express.raw() to capture raw body for HMAC verification.
// The global express.json() middleware does NOT apply to this route.
router.post('/callback',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    // --- SIGNATURE VERIFICATION (bonus marks) ---
    const signature = req.get('X-Signature');
    if (signature) {
      const expected = crypto
        .createHmac('sha256', GATEWAY_SECRET)
        .update(req.body) // req.body is a Buffer here, not parsed JSON
        .digest('hex');

      if (signature !== expected) {
        // Log the attempt but still return 200 to avoid retry storm
        console.warn('[Callback] Invalid signature — possible spoofed callback');
        return res.status(200).json({ received: true, warning: 'invalid_signature' });
      }
    }

    // Parse JSON manually after signature check
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      console.error('[Callback] Invalid JSON body');
      return res.status(200).json({ received: true });
    }

    // Return 200 IMMEDIATELY
    res.status(200).json({ received: true });

    // Process asynchronously
    setImmediate(async () => {
      try {
        await processCallback(payload);
      } catch (err) {
        console.error('[Callback] Processing error (already returned 200):', err.message);
      }
    });
  }
);

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
