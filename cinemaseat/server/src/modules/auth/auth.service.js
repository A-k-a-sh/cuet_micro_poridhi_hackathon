import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../../db/redis.js';
import axios from 'axios';
import { createError } from '../../middleware/errorHandler.js';

const GATEWAY = process.env.GATEWAY_URL;

export const sendOTP = async (phone) => {
  const ref = uuidv4();
  const redis = getRedis();

  // Store ref → phone mapping in Redis for 5 minutes
  await redis.set(`otp:${ref}`, phone, { EX: 300 });

  try {
    // Update gateway status
    await redis.set('metrics:gateway_status', 'up', { EX: 30 });
    await axios.post(`${GATEWAY}/otp/send`, {
      phone,
      ref,
      callback_url: `${process.env.CALLBACK_BASE_URL}/api/auth/webhooks/otp`
    });
  } catch (err) {
    await redis.set('metrics:gateway_status', 'down', { EX: 30 });
    // Still return ref — OTP may be delayed (per spec: 10% delay or never delivered)
    // Frontend will show "resend" option
    console.warn('[OTP] Gateway error on send:', err.message);
  }

  return { ref, message: 'OTP sent. It may take up to 30 seconds to arrive.' };
};

export const verifyOTP = async (ref, code) => {
  const redis = getRedis();
  const phone = await redis.get(`otp:${ref}`);
  if (!phone) throw createError('OTP expired or invalid reference', 'VALIDATION_ERROR');

  try {
    const { data } = await axios.post(`${GATEWAY}/otp/verify`, { ref, code });
    if (!data || data.error) throw createError('Invalid OTP', 'VALIDATION_ERROR');
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') throw err;
    throw createError('OTP verification failed', 'VALIDATION_ERROR');
  }

  // Clean up OTP
  await redis.del(`otp:${ref}`);

  // Issue JWT
  const session_id = uuidv4();
  const token = jwt.sign(
    { phone, session_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  await redis.set(`session:${phone}`, session_id, { EX: 86400 });
  return { token, phone };
};

export const verifyBookingOTP = async (ref, code, booking_ref, phone) => {
  // Same OTP verify flow but returns booking details after success
  const redis = getRedis();
  const storedPhone = await redis.get(`otp:${ref}`);
  if (!storedPhone || storedPhone !== phone) {
    throw createError('OTP expired or phone mismatch', 'VALIDATION_ERROR');
  }

  try {
    await axios.post(`${GATEWAY}/otp/verify`, { ref, code });
  } catch {
    throw createError('Invalid OTP', 'VALIDATION_ERROR');
  }

  await redis.del(`otp:${ref}`);
  return { verified: true };
};
