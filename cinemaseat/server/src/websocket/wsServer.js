import { WebSocketServer } from 'ws';

let wss;

export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Track which show this client is currently viewing
    ws.subscribedShowId = null;

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        
        // Handle explicit client actions
        if (message.type === 'SUBSCRIBE_SHOW') {
          ws.subscribedShowId = String(message.show_id);
          console.log(`Client subscribed to show: ${ws.subscribedShowId}`);
        } else if (message.type === 'UNSUBSCRIBE_SHOW') {
          if (ws.subscribedShowId === String(message.show_id)) {
            ws.subscribedShowId = null;
            console.log(`Client unsubscribed from show: ${message.show_id}`);
          }
        }
      } catch (err) {
        console.error('WebSocket parsing error:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      ws.subscribedShowId = null;
    });
  });

  console.log('WebSocket server initialized');
};

/**
 * Broadcasts an event to all clients globally
 */
export const broadcast = (data) => {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
};

/**
 * Broadcasts an event strictly to clients viewing a specific show
 */
export const broadcastToShow = (showId, data) => {
  if (!wss) return;
  const payload = JSON.stringify(data);
  const targetShowId = String(showId);
  
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.subscribedShowId === targetShowId) {
      client.send(payload);
      count++;
    }
  });
  console.log(`[WebSocket] Broadcasted ${data.type} for show ${showId} to ${count} clients.`);
};

/**
 * Starts a periodic loop that pushes SYSTEM_METRICS to all connected clients.
 * Matches the architecture spec: { type: 'SYSTEM_METRICS', active_holds,
 * bookings_last_60s, gateway_status, duplicate_callbacks_intercepted }
 */
export const startMetricsBroadcast = (pool, redisClient, intervalMs = 10000) => {
  const gatherAndBroadcast = async () => {
    if (!wss || wss.clients.size === 0) return; // no-op if nobody is connected

    try {
      const [holdsRes, recentRes] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM bookings WHERE status = 'HELD' AND expires_at > NOW()"),
        pool.query("SELECT COUNT(*) FROM bookings WHERE created_at > NOW() - interval '60 seconds'"),
      ]);

      // Count idempotency keys in Redis as a proxy for duplicate callbacks seen
      let duplicateCallbacksIntercepted = 0;
      try {
        let cursor = 0;
        do {
          const reply = await redisClient.scan(cursor, { MATCH: 'callback:*', COUNT: 100 });
          cursor = reply.cursor;
          duplicateCallbacksIntercepted += reply.keys.length;
        } while (cursor !== 0);
      } catch (_) { /* best-effort */ }

      // Gateway health with a short timeout so it never blocks the loop
      let gatewayStatus = 'unknown';
      try {
        const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:9000';
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1000);
        const resp = await fetch(`${gatewayUrl}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        gatewayStatus = resp.ok ? 'healthy' : 'degraded';
      } catch {
        gatewayStatus = 'down';
      }

      broadcast({
        type: 'SYSTEM_METRICS',
        active_holds: parseInt(holdsRes.rows[0].count, 10),
        bookings_last_60s: parseInt(recentRes.rows[0].count, 10),
        gateway_status: gatewayStatus,
        duplicate_callbacks_intercepted: duplicateCallbacksIntercepted,
      });
    } catch (err) {
      console.error('[WS Metrics] Failed to gather metrics:', err.message);
    }
  };

  setInterval(gatherAndBroadcast, intervalMs);
  console.log(`[WebSocket] SYSTEM_METRICS broadcast started (every ${intervalMs / 1000}s)`);
};
