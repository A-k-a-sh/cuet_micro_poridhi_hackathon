import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

// rooms: Map<show_id, Set<WebSocket>>
const rooms = new Map();

// All connected clients (for system-wide broadcasts)
const allClients = new Set();

let wss;

export const initWebSocket = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    // Optionally authenticate via token in query string
    // ws://localhost:3000?token=JWT
    const url = new URL(req.url, 'ws://localhost');
    const token = url.searchParams.get('token');
    let phone = null;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        phone = payload.phone;
        ws.phone = phone;
      } catch {
        // Unauthenticated connection is fine — can still receive seat updates
      }
    }

    allClients.add(ws);
    ws.subscribedShows = new Set();

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      allClients.delete(ws);
      // Remove from all show rooms
      for (const show_id of ws.subscribedShows) {
        const room = rooms.get(show_id);
        if (room) room.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });

    // Send initial connected acknowledgement
    safeSend(ws, { type: 'CONNECTED', timestamp: new Date().toISOString() });
  });

  // Push system metrics to all clients every 5 seconds
  startMetricsPush();

  console.log('[WS] WebSocket server initialized');
};

const handleClientMessage = (ws, message) => {
  switch (message.type) {
    case 'SUBSCRIBE_SHOW': {
      const { show_id } = message;
      if (!show_id) return;

      if (!rooms.has(show_id)) rooms.set(show_id, new Set());
      rooms.get(show_id).add(ws);
      ws.subscribedShows.add(show_id);

      safeSend(ws, { type: 'SUBSCRIBED', show_id });
      break;
    }
    case 'UNSUBSCRIBE_SHOW': {
      const { show_id } = message;
      if (!show_id) return;

      const room = rooms.get(show_id);
      if (room) room.delete(ws);
      ws.subscribedShows.delete(show_id);
      break;
    }
    case 'PING': {
      safeSend(ws, { type: 'PONG' });
      break;
    }
  }
};

// Broadcast to all clients subscribed to a specific show
// Also broadcasts to the specific user if they're watching their booking
export const broadcast = (event) => {
  const { show_id, booking_ref } = event;
  const payload = JSON.stringify(event);

  if (show_id) {
    const room = rooms.get(show_id);
    if (room) {
      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    }
  }

  // For booking-specific events (BOOKING_CONFIRMED, PAYMENT_FAILED, HOLD_EXPIRED),
  // also send to the booking owner if they're connected (any room)
  if (booking_ref) {
    for (const client of allClients) {
      if (client.readyState === WebSocket.OPEN && client.phone) {
        // We can't easily filter by booking_ref here without a lookup,
        // so broadcast BOOKING_* events to authenticated users broadly.
        // The frontend filters by booking_ref.
        client.send(payload);
      }
    }
  }
};

// Broadcast to ALL clients regardless of show subscription
export const broadcastAll = (event) => {
  const payload = JSON.stringify(event);
  for (const client of allClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const safeSend = (ws, data) => {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch {
    // Ignore send errors
  }
};

// Push live metrics to all clients every 5 seconds
const startMetricsPush = () => {
  setInterval(async () => {
    if (allClients.size === 0) return;

    try {
      const { getRedis } = await import('../db/redis.js');
      const { query } = await import('../db/postgres.js');
      const { checkGatewayHealth } = await import('../modules/payment/gateway.client.js');
      const redis = getRedis();

      let gatewayStatus = await redis.get('metrics:gateway_status').catch(() => null);
      if (!gatewayStatus) {
        const healthy = await checkGatewayHealth();
        gatewayStatus = healthy ? 'up' : 'down';
        await redis.set('metrics:gateway_status', gatewayStatus, { EX: 30 });
      }

      const [activeHolds, duplicates, recentBookings] = await Promise.all([
        redis.get('metrics:active_holds').catch(() => '0'),
        redis.get('metrics:duplicate_callbacks').catch(() => '0'),
        query(`
          SELECT COUNT(*) FROM bookings
          WHERE status = 'confirmed' AND updated_at > NOW() - INTERVAL '60 seconds'
        `).catch(() => ({ rows: [{ count: '0' }] }))
      ]);

      broadcastAll({
        type: 'SYSTEM_METRICS',
        active_holds: parseInt(activeHolds || 0),
        bookings_last_60s: parseInt(recentBookings.rows[0].count),
        duplicate_callbacks_intercepted: parseInt(duplicates || 0),
        gateway_status: gatewayStatus || 'unknown',
        connected_clients: allClients.size,
        timestamp: new Date().toISOString()
      });
    } catch {
      // Ignore metrics push errors
    }
  }, 5_000);
};
