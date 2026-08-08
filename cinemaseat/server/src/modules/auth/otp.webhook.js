import { getRedis } from '../../db/redis.js';

// Gateway POSTs here when it has generated an OTP code.
// We store it temporarily so the user can retrieve it (or in prod, send SMS).
// In this hackathon context, we store it in Redis and expose it
// via a dev-only endpoint so the frontend can display it during demo.
export const handleOTPCallback = async (req, res) => {
  // Always return 200 immediately
  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      const { ref, code, phone } = req.body;
      if (!ref || !code) return;

      const redis = getRedis();

      // Store the actual OTP code temporarily (5 min TTL)
      // Key: otp_code:{ref} → code
      await redis.set(`otp_code:${ref}`, code, { EX: 300 });

      console.log(`[OTP Callback] Code received for ref=${ref}`);
      // In production: trigger SMS send here
    } catch (err) {
      console.error('[OTP Callback] Error:', err.message);
    }
  });
};

// DEV ONLY — exposes the OTP code for demo purposes
// Remove or gate behind NODE_ENV check in production
export const getOTPCode = async (req, res) => {
  try {
    const { ref } = req.params;
    const redis = getRedis();
    const code = await redis.get(`otp_code:${ref}`);

    if (!code) {
      return res.status(404).json({ error: 'Code not yet delivered or expired' });
    }

    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
};
