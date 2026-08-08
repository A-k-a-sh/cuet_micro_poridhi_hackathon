/**
 * gateway.client.js
 * Thin HTTP client for the mock payment gateway.
 * Architecture spec: src/modules/payment/gateway.client.js
 *
 * The gateway misbehaves by design (problem statement):
 *  - /charge returns 500 or times out 2% of the time
 *  - Callbacks delayed 2–15 s, always
 *  - 10% payment failure, 8% duplicate callbacks
 *
 * This client wraps every call so callers never await an unbounded promise.
 * Timeout: 10 s on /charge (generous for the 2% case), 5 s on others.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:9000';

const fetchWithTimeout = async (url, options, timeoutMs = 10_000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// initiateCharge
// Returns { payment_id, status: 'PENDING' } on 202.
// Throws on network error or non-2xx — caller handles gracefully.
// ─────────────────────────────────────────────────────────────────────────────
export const initiateCharge = async (amount, currency, bookingRef, callbackUrl, extraHeaders = {}) => {
  const resp = await fetchWithTimeout(
    `${GATEWAY_URL}/charge`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body:    JSON.stringify({ amount, currency, booking_ref: bookingRef, callback_url: callbackUrl }),
    },
    10_000
  );

  if (!resp.ok) {
    const err = new Error(`Gateway /charge returned ${resp.status}`);
    err.statusCode = 502;
    throw err;
  }

  return resp.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// initiateRefund
// ─────────────────────────────────────────────────────────────────────────────
export const initiateRefund = async (paymentId) => {
  const resp = await fetchWithTimeout(
    `${GATEWAY_URL}/refund`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payment_id: paymentId }),
    },
    10_000
  );

  if (!resp.ok) {
    throw new Error(`Gateway /refund returned ${resp.status}`);
  }
  return resp.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// sendOtp — POST /otp/send → 202, no response body
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtp = async (phone, ref) => {
  await fetchWithTimeout(
    `${GATEWAY_URL}/otp/send`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, ref }),
    },
    5_000
  );
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyOtp — POST /otp/verify → 200 = valid, 400 = invalid
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtp = async (ref, code) => {
  const resp = await fetchWithTimeout(
    `${GATEWAY_URL}/otp/verify`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ref, code }),
    },
    5_000
  );
  return resp.ok; // 400 = invalid OTP per spec
};

// ─────────────────────────────────────────────────────────────────────────────
// checkGatewayHealth — used by /api/metrics and startMetricsBroadcast
// ─────────────────────────────────────────────────────────────────────────────
export const checkGatewayHealth = async () => {
  try {
    const resp = await fetchWithTimeout(`${GATEWAY_URL}/health`, {}, 1_000);
    return resp.ok ? 'up' : 'degraded';
  } catch {
    return 'down';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// chargeGateway — object-style wrapper used by booking.routes.js
// Spec: booking.routes.js calls chargeGateway({ amount, currency, booking_ref, callback_url, payment_id })
// ─────────────────────────────────────────────────────────────────────────────
export const chargeGateway = ({ amount, currency, booking_ref, callback_url }) => {
  return initiateCharge(amount, currency, booking_ref, callback_url);
};

