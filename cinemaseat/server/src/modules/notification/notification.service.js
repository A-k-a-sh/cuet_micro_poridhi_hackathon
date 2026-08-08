/**
 * notification.service.js
 * Architecture spec: notification module
 *
 * Responsibilities (strict boundary):
 *  - WebSocket event broadcasting (delegates to wsServer)
 *  - OTP send/verify coordination (delegates to gateway.client)
 *  - Does NOT touch the database directly
 *
 * Other modules (booking, payment) call this instead of touching
 * wsServer or gateway.client directly, keeping module boundaries clean.
 */

import { broadcast } from '../../websocket/wsServer.js';
import { sendOTP as sendOtp, verifyOTP as verifyOtp } from '../auth/auth.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket notification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify all clients on a show that a seat's status changed.
 * { type: 'SEAT_UPDATE', show_id, seat_id, status, expires_at? }
 */
export const notifySeatUpdate = (showId, seatId, status, expiresAt = null) => {
  broadcast({
    type:       'SEAT_UPDATE',
    show_id:    showId,
    seat_id:    seatId,
    status,
    ...(expiresAt && { expires_at: expiresAt }),
  });
};

/**
 * Notify the user their booking is confirmed (payment accepted, awaiting OTP).
 * { type: 'BOOKING_CONFIRMED', booking_ref, qr_data? }
 */
export const notifyBookingConfirmed = (showId, bookingRef, qrData = null) => {
  broadcast({
    type:        'BOOKING_CONFIRMED',
    show_id:     showId,
    booking_ref: bookingRef,
    ...(qrData && { qr_data: qrData }),
  });
};

/**
 * Notify the user their payment failed.
 * { type: 'PAYMENT_FAILED', booking_ref, message }
 */
export const notifyPaymentFailed = (showId, bookingRef, message = 'Payment was declined.') => {
  broadcast({
    type:        'PAYMENT_FAILED',
    show_id:     showId,
    booking_ref: bookingRef,
    message,
  });
};

/**
 * Notify all clients on a show that a held seat has expired.
 * { type: 'HOLD_EXPIRED', booking_ref, seat_id }
 */
export const notifyHoldExpired = (showId, bookingRef, seatId) => {
  broadcast({
    type:        'HOLD_EXPIRED',
    show_id:     showId,
    booking_ref: bookingRef,
    seat_id:     seatId,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP coordination — delegates to gateway, does NOT store OTP state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an OTP to a phone number via the gateway.
 * Best-effort — caller decides whether to await or fire-and-forget.
 */
export const dispatchOtp = async (phone, ref) => {
  await sendOtp(phone, ref);
};

/**
 * Verify an OTP code via the gateway.
 * Returns true (valid) or false (invalid/expired).
 */
export const checkOtp = async (ref, code) => {
  return verifyOtp(ref, code);
};
