import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { sendOtp, verifyOtp } from '../payment/gateway.client.js';
import pool from '../../db/postgres.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

router.post('/otp/send', async (req, res, next) => {
  try {
    const { phone } = req.body;
    // Generate a temporary reference for this OTP session
    const ref = `login_${Date.now()}`;
    await sendOtp(phone, ref);
    res.status(202).json({ ref });
  } catch (err) {
    next(err);
  }
});

router.post('/otp/verify', async (req, res, next) => {
  try {
    const { ref, code, phone } = req.body;
    const isValid = await verifyOtp(ref, code);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    // In a real app we'd upsert a user here. For the hackathon we can just sign the JWT
    const token = jwt.sign({ id: phone || ref }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

router.post('/otp/booking-verify', async (req, res, next) => {
  try {
    const { ref, code, booking_ref } = req.body;
    const isValid = await verifyOtp(ref, code);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    // Update booking status to CONFIRMED
    const { rowCount } = await pool.query(
      "UPDATE bookings SET status = 'CONFIRMED' WHERE booking_ref = $1 AND status = 'OTP_PENDING'",
      [booking_ref]
    );
    
    if (rowCount === 0) {
      return res.status(400).json({ error: 'Booking not pending OTP verification' });
    }
    
    res.json({ qr_data: `QR_DATA_${booking_ref}`, booking_ref });
  } catch (err) {
    next(err);
  }
});

export default router;
