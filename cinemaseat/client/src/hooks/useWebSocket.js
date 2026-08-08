import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const RECONNECT_DELAY = 3000;

export const useWebSocket = (onMessage) => {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const token = useAuthStore(s => s.token);

  const connect = useCallback(() => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('[WS] Connected');
      clearTimeout(reconnectTimer.current);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {}
    };

    ws.current.onclose = () => {
      console.log('[WS] Disconnected, reconnecting...');
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.current.onerror = () => {
      ws.current.close();
    };
  }, [token, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
};
