/**
 * auth.routes.js
 * Phone-based OTP login + booking OTP verification.
 * Thin router — all logic lives in auth.service.js.
 *
 * Endpoints:
 *   POST /api/auth/otp/send             — send login OTP
 *   POST /api/auth/otp/verify           — verify login OTP, receive JWT
 *   POST /api/auth/otp/booking-verify   — verify booking OTP, confirm booking
 */

import { Router } from 'express';
import { sendOTP, verifyOTP, verifyBookingOTP } from './auth.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { otpLimiter } from '../../middleware/rateLimiter.js';
import { confirmBookingAfterOTP } from '../booking/booking.service.js';

const router = Router();

// POST /api/auth/otp/send
// Body: { phone: "+8801XXXXXXXXX" }
router.post('/otp/send', otpLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number', code: 'VALIDATION_ERROR' });
    }
    const result = await sendOTP(phone);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/otp/verify
// Body: { ref, code }
// Returns: { token, phone }
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { ref, code } = req.body;
    if (!ref || !code) return res.status(400).json({ error: 'ref and code required' });
    const result = await verifyOTP(ref, code);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/otp/booking-verify
// Body: { ref, code, booking_ref }
// Requires: Auth header (JWT)
// Returns: { booking, qr_data }
router.post('/otp/booking-verify', requireAuth, async (req, res, next) => {
  try {
    const { ref, code, booking_ref } = req.body;
    const phone = req.user.phone;

    await verifyBookingOTP(ref, code, booking_ref, phone);
    const booking = await confirmBookingAfterOTP(booking_ref, phone);
    res.json(booking);
  } catch (err) { next(err); }
});

export default router;
