import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

export const useShowRoom = (showId, onSeatUpdate, onSystemEvent) => {
  const { send } = useWebSocket((message) => {
    switch (message.type) {
      case 'SEAT_UPDATE':
        if (message.show_id === showId) onSeatUpdate(message);
        break;
      case 'PAYMENT_SUCCEEDED':
      case 'BOOKING_CONFIRMED':
      case 'PAYMENT_FAILED':
      case 'HOLD_EXPIRED':
      case 'SYSTEM_METRICS':
        onSystemEvent(message);
        break;
    }
  });

  useEffect(() => {
    if (!showId) return;
    send({ type: 'SUBSCRIBE_SHOW', show_id: showId });
    return () => send({ type: 'UNSUBSCRIBE_SHOW', show_id: showId });
  }, [showId, send]);
};
