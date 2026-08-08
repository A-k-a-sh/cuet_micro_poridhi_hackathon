import { useState } from 'react';
import { KeyRound } from 'lucide-react';

export default function OTPInput({ onVerify, loading, resendCooldown = 30, onResend }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length === 6) {
      onVerify(code);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto space-y-4">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-full bg-[#F5A623]/10 text-[#F5A623] mx-auto flex items-center justify-center border border-[#F5A623]/20">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="font-['Syne'] font-bold text-lg text-[#F0F0FF]">Enter OTP Verification</h3>
        <p className="text-xs text-[#8888AA]">
          Enter the 6-digit security code sent to your phone. (Note: OTP delivery may take up to 30s)
        </p>
      </div>

      <div>
        <input
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="0 0 0 0 0 0"
          className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3 bg-[#12121A] border border-[#2A2A40] focus:border-[#F5A623] rounded-xl text-[#F0F0FF] outline-none transition-all placeholder-[#555570]"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={code.length !== 6 || loading}
        className="w-full py-3 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-sm hover:bg-[#C47D10] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-[#F5A623]/20"
      >
        {loading ? 'Verifying...' : 'Verify OTP & Confirm'}
      </button>

      {onResend && (
        <div className="text-center">
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0}
            className="text-xs text-[#8888AA] hover:text-[#F5A623] disabled:opacity-50 transition-colors"
          >
            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
          </button>
        </div>
      )}
    </form>
  );
}
