import { Clock } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';

export default function HoldTimer({ expiresAt, onExpire }) {
  const { minutes, seconds, isExpired } = useCountdown(expiresAt);

  if (isExpired && onExpire) {
    onExpire();
    return null;
  }

  const isUrgent = minutes === 0 && seconds < 30;

  return (
    <div className={`flex items-center justify-center gap-2 font-mono text-sm font-semibold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-[#F5A623]'}`}>
      <Clock className="w-4 h-4" />
      <span>
        ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} remaining to complete payment
      </span>
    </div>
  );
}
