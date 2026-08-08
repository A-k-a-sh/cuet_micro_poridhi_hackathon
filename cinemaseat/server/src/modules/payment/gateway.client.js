const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:9000';

export const initiateCharge = async (amount, currency, bookingRef, callbackUrl) => {
  const response = await fetch(`${GATEWAY_URL}/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, booking_ref: bookingRef, callback_url: callbackUrl })
  });
  if (!response.ok) {
    throw new Error(`Charge initiation failed: ${response.status}`);
  }
  return response.json();
};

export const initiateRefund = async (paymentId) => {
  const response = await fetch(`${GATEWAY_URL}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId })
  });
  if (!response.ok) {
    throw new Error(`Refund initiation failed: ${response.status}`);
  }
  return response.json();
};

export const sendOtp = async (phone, ref) => {
  const response = await fetch(`${GATEWAY_URL}/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, ref })
  });
  if (!response.ok) {
    throw new Error(`Failed to send OTP: ${response.status}`);
  }
  // No JSON response body for /otp/send per docs, just 202 status.
  return true; 
};

export const verifyOtp = async (ref, code) => {
  const response = await fetch(`${GATEWAY_URL}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, code })
  });
  if (!response.ok) {
    return false; // 400 means invalid OTP per docs
  }
  return true;
};
