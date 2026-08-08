import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getJwtForPhone(phone) {
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    console.log(`[JWT Getter] Requesting OTP for ${phone} (Attempt ${attempts})...`);
    try {
      const sendRes = await axios.post(`${BASE_URL}/api/auth/otp/send`, { phone });
      const { ref } = sendRes.data;
      console.log(`[JWT Getter] Got ref ${ref}. Polling for code...`);

      // Poll for code
      let code = null;
      for (let i = 0; i < 15; i++) {
        await delay(2000);
        try {
          const codeRes = await axios.get(`${BASE_URL}/api/auth/otp/code/${ref}`);
          if (codeRes.data && codeRes.data.code) {
            code = codeRes.data.code;
            break;
          }
        } catch (err) {
          // 404 is expected while waiting
        }
      }

      if (code) {
        console.log(`[JWT Getter] Found code: ${code}. Verifying...`);
        const verifyRes = await axios.post(`${BASE_URL}/api/auth/otp/verify`, { ref, code });
        const token = verifyRes.data.token;
        console.log(`[JWT Getter] Verification successful! JWT obtained.`);
        return token;
      } else {
        console.log(`[JWT Getter] OTP timed out or was not delivered. Retrying...`);
      }
    } catch (err) {
      console.error(`[JWT Getter] Error during OTP flow:`, err.message);
      await delay(2000);
    }
  }
  throw new Error(`Failed to get JWT for ${phone} after multiple attempts`);
}

// If run directly
if (process.argv[1].endsWith('get_jwt.js')) {
  const phone = process.argv[2] || '+8801700000000';
  getJwtForPhone(phone).then(token => {
    console.log(`JWT_TOKEN=${token}`);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
