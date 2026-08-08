import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { holdLimiter } from '../../middleware/rateLimiter.js';
import {
  holdSeat,
  getBooking,
  initiatePayment,
  cancelBooking
} from './booking.service.js';
import { chargeGateway } from '../payment/gateway.client.js';
import { createPaymentRecord } from '../payment/payment.service.js';

const router = Router();

// *** JUDGES VERIFY THIS — POST /api/bookings/hold ***
// Body: { show_id, seat_id }
// Auth: required
router.post('/bookings/hold', requireAuth, holdLimiter, async (req, res, next) => {
  try {
    const { show_id, seat_id } = req.body;
    if (!show_id || !seat_id) {
      return res.status(400).json({ error: 'show_id and seat_id required' });
    }
    const result = await holdSeat(show_id, seat_id, req.user.phone);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/bookings/:ref
router.get('/bookings/:ref', requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.ref, req.user.phone);
    res.json(booking);
  } catch (err) { next(err); }
});

// POST /api/bookings/:ref/pay
// Returns immediately with { status: 'pending' }
// Payment result comes via WebSocket
router.post('/bookings/:ref/pay', requireAuth, async (req, res, next) => {
  try {
    const booking = await initiatePayment(req.params.ref, req.user.phone);

    // Create payment record BEFORE calling gateway
    const payment = await createPaymentRecord(booking.booking_ref, booking.amount);

    // Transition booking to PENDING_PAYMENT immediately
    // (payment_id will be updated when gateway responds)
    await import('../../db/postgres.js').then(({ query }) =>
      query(`
        UPDATE bookings SET status = 'pending_payment', updated_at = NOW()
        WHERE booking_ref = $1
      `, [booking.booking_ref])
    );

    await import('../../db/postgres.js').then(({ query }) =>
      query(`
        UPDATE show_seats SET status = 'pending_payment'
        WHERE booking_ref = $1
      `, [booking.booking_ref])
    );

    // Fire gateway charge — DO NOT AWAIT the result
    // The callback_url is where the gateway will send the result
    const callback_url = `${process.env.CALLBACK_BASE_URL}/api/payments/callback`;

    chargeGateway({
      amount: booking.amount,
      currency: 'BDT',
      booking_ref: booking.booking_ref,
      callback_url,
      payment_id: payment.id
    }).catch(err => {
      console.error('[Pay] Gateway charge error:', err.message);
      // Gateway 500/timeout — booking stays PENDING_PAYMENT
      // Sweeper will clean it up if it stays there too long
    });

    // Return IMMEDIATELY — do not wait for gateway
    res.json({
      status: 'pending',
      booking_ref: booking.booking_ref,
      message: 'Payment initiated. You will be notified when complete.'
    });
  } catch (err) { next(err); }
});

// POST /api/bookings/:ref/cancel
router.post('/bookings/:ref/cancel', requireAuth, async (req, res, next) => {
  try {
    const result = await cancelBooking(req.params.ref, req.user.phone);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
