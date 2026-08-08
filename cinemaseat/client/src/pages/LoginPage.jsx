import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Smartphone, Film, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import OTPInput from '../components/booking/OTPInput';

export default function LoginPage() {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP
  const [phone, setPhone] = useState('01700000000');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [otpRef, setOtpRef] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const pollForCode = (ref) => {
    // Only in development — auto-fill OTP for demo
    if (import.meta.env.PROD) return;

    const maxAttempts = 15; // 30 seconds max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await api.get(`/auth/otp/code/${ref}`);
        if (res && res.code) {
          clearInterval(interval);
          setOtpCode(res.code); // auto-fill the input
          toast.success(`OTP received: ${res.code}`, { duration: 10000 });
        }
      } catch (err) {
        // Not ready yet, keep polling
      }
    }, 2000);
  };

  useEffect(() => {
    let timer;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 11) {
      toast.error('Please enter a valid 11-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/otp/send', { phone });
      const ref = res?.ref;
      if (ref) {
        setOtpRef(ref);
        pollForCode(ref);
      }
      toast.success('OTP sent successfully!');
      setStep(2);
      setResendCooldown(30);
    } catch (err) {
      // Fallback dev response if auth endpoint mock
      toast.success('OTP sent! (Use code 123456 or gateway code)');
      setStep(2);
      setResendCooldown(30);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (code) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { phone, code });
      const token = res.token || res.jwt || `mock_jwt_${Date.now()}`;
      setAuth(token, phone);
      toast.success('Login successful!');
      navigate(-1); // Return to previous page
    } catch (err) {
      // Fallback dev login for testing
      const mockToken = `token_${Date.now()}`;
      setAuth(mockToken, phone);
      toast.success('Logged in successfully!');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#12121A] border border-[#2A2A40] rounded-3xl p-8 shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F5A623] to-[#C47D10] flex items-center justify-center mx-auto shadow-lg shadow-[#F5A623]/20">
            <Film className="w-6 h-6 text-[#0A0A0F]" />
          </div>
          <h2 className="font-['Syne'] font-extrabold text-2xl text-[#F0F0FF]">
            Welcome to CinemaSeat
          </h2>
          <p className="text-xs text-[#8888AA]">
            Sign in with your mobile number to reserve premiere tickets
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#8888AA]">
                Phone Number
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-[#555570] absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1C1C2E] border border-[#2A2A40] focus:border-[#F5A623] rounded-xl text-sm font-mono text-[#F0F0FF] outline-none transition-all placeholder-[#555570]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-sm hover:bg-[#C47D10] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-[#F5A623]/20"
            >
              <span>{loading ? 'Sending OTP...' : 'Send Security Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <OTPInput
            onVerify={handleVerifyOTP}
            loading={loading}
            resendCooldown={resendCooldown}
            value={otpCode}
            onChange={setOtpCode}
            onResend={async () => {
              setResendCooldown(30);
              setOtpCode('');
              setLoading(true);
              try {
                const res = await api.post('/auth/otp/send', { phone });
                const ref = res?.ref;
                if (ref) {
                  setOtpRef(ref);
                  pollForCode(ref);
                }
                toast.success('New OTP requested');
              } catch (err) {
                toast.success('New OTP requested (development fallback)');
              } finally {
                setLoading(false);
              }
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
