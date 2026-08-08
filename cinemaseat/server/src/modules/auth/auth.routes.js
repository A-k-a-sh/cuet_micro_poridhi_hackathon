/**
 * auth.routes.js
 * Phone-based OTP login + booking OTP verification.
 * Architecture spec: auth module
 *  - Does NOT touch: bookings, payments, seats
 *  - OTP coordination delegated to notification module
 *
 * Endpoints:
 *   POST /api/auth/otp/send             — send login OTP
 *   POST /api/auth/otp/verify           — verify login OTP, receive JWT
 *   POST /api/auth/otp/booking-verify   — verify booking OTP, get QR ticket
 */

import { Router }  from 'express';
import jwt         from 'jsonwebtoken';
import QRCode      from 'qrcode';
import { query }   from '../../db/postgres.js';
import { getRedis } from '../../db/redis.js';
import { dispatchOtp, checkOtp } from '../notification/notification.service.js';
import { confirmBooking, getBooking } from '../booking/booking.service.js';

const router = Router();
const JWT_SECRET    = process.env.JWT_SECRET    || 'super-secret-key';
const JWT_EXPIRES   = process.env.JWT_EXPIRES_IN || '24h';
const OTP_TTL       = 300; // 5 minutes — matches Redis otp:{ref} pattern in architecture spec

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/send
// Body: { phone }
// Sends an OTP to the phone number via the gateway.
// Stores the ref in Redis with a 5-min TTL (otp:{ref} key pattern from spec).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/otp/send', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const ref = `login_${phone}_${Date.now()}`;

    // Store the ref so verify can validate it came from us
    const redis = getRedis();
    await redis.set(`otp:${ref}`, phone, { EX: OTP_TTL });

    // Dispatch OTP via notification module (delegates to gateway)
    await dispatchOtp(phone, ref);

    res.status(202).json({ ref });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/verify
// Body: { ref, code, phone }
// Returns: { token: JWT }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { ref, code, phone } = req.body;
    if (!ref || !code) return res.status(400).json({ error: 'ref and code are required' });

    // Validate ref exists in Redis (proves we issued it)
    const redis = getRedis();
    const storedPhone = await redis.get(`otp:${ref}`);
    if (!storedPhone) {
      return res.status(400).json({ error: 'OTP reference expired or invalid' });
    }

    const isValid = await checkOtp(ref, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Clean up OTP ref
    await redis.del(`otp:${ref}`);

    // Issue JWT — sub is phone number
    const userPhone = phone || storedPhone;
    const token = jwt.sign(
      { id: userPhone, phone: userPhone },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/otp/booking-verify
// Body: { ref, code, booking_ref }
// Verifies OTP, confirms booking (OTP_PENDING → CONFIRMED), returns QR ticket.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/otp/booking-verify', async (req, res, next) => {
  try {
    const { ref, code, booking_ref } = req.body;
    if (!ref || !code || !booking_ref) {
      return res.status(400).json({ error: 'ref, code, and booking_ref are required' });
    }

    const isValid = await checkOtp(ref, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Transition OTP_PENDING → CONFIRMED (atomic via booking service)
    const booking = await confirmBooking(booking_ref);
    if (!booking) {
      return res.status(409).json({ error: 'Booking not in otp_pending state' });
    }

    // Generate QR code data URL (PNG base64) — qrcode package
    const qrPayload = JSON.stringify({
      booking_ref: booking_ref,
      phone:       booking.phone,
      confirmed_at: new Date().toISOString(),
    });
    const qrData = await QRCode.toDataURL(qrPayload);

    // Full booking detail for the client
    const fullBooking = await getBooking(booking_ref);

    res.json({
      booking:     fullBooking,
      qr_data:     qrData,       // base64 PNG data URL ready for <img src=...>
      booking_ref: booking_ref,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
