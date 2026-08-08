import { useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

export const useShowRoom = (showId, onSeatUpdate, onSystemEvent) => {
  const onSeatUpdateRef = useRef(onSeatUpdate);
  const onSystemEventRef = useRef(onSystemEvent);

  useEffect(() => { onSeatUpdateRef.current = onSeatUpdate; }, [onSeatUpdate]);
  useEffect(() => { onSystemEventRef.current = onSystemEvent; }, [onSystemEvent]);

  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'SEAT_UPDATE':
        if (message.show_id === showId) onSeatUpdateRef.current(message);
        break;
      case 'PAYMENT_SUCCEEDED':
      case 'BOOKING_CONFIRMED':
      case 'PAYMENT_FAILED':
      case 'HOLD_EXPIRED':
      case 'SYSTEM_METRICS':
        onSystemEventRef.current(message);
        break;
    }
  }, [showId]);

  const { send } = useWebSocket(handleMessage);

  useEffect(() => {
    if (!showId) return;
    send({ type: 'SUBSCRIBE_SHOW', show_id: showId });
    return () => send({ type: 'UNSUBSCRIBE_SHOW', show_id: showId });
  }, [showId, send]);
};
