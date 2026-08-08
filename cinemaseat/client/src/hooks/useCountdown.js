import { useState, useEffect } from 'react';

export const useCountdown = (expiresAt) => {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0
  );

  useEffect(() => {
    if (!expiresAt) return;
    setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));

    const interval = setInterval(() => {
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return {
    minutes: Math.floor(remaining / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
    isExpired: expiresAt ? remaining === 0 : false
  };
};
