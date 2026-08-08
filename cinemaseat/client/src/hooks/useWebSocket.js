import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};
const WS_URL = getWsUrl();
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
