/**
 * payment.routes.js
 * POST /api/payments/callback  — gateway webhook receiver.
 *
 * CRITICAL RULE (problem statement + architecture):
 *   Always return 200, even for duplicates, even on processing errors.
 *   A non-200 tells the gateway delivery failed and it will retry forever.
 *
 * All WS broadcasts and OTP sends happen inside payment.service.js.
 */

import { Router } from 'express';
import { processPaymentCallback } from './payment.service.js';

const router = Router();

router.post('/callback', async (req, res) => {
  // Respond 200 FIRST before any async work — satisfies the rule
  // even if processing errors out below.
  res.status(200).json({ status: 'received' });

  // Process asynchronously after response is sent
  try {
    const result = await processPaymentCallback(req.body);
    console.log('[Callback]', result.status, '— booking_ref:', req.body.booking_ref);
  } catch (err) {
    // Should never reach here (service swallows errors), but log just in case
    console.error('[Callback] Unexpected error (already responded 200):', err.message);
  }
});

export default router;
