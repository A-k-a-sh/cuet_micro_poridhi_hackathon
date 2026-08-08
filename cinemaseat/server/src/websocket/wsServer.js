/**
 * wsServer.js
 * WebSocket server — room subscriptions and broadcast helpers.
 * Architecture spec: src/websocket/wsServer.js
 *
 * WebSocket events (Server → Client):
 *   { type: 'SEAT_UPDATE',     show_id, seat_id, status, expires_at }
 *   { type: 'BOOKING_CONFIRMED', booking_ref, qr_data }
 *   { type: 'PAYMENT_FAILED',    booking_ref, message }
 *   { type: 'HOLD_EXPIRED',      booking_ref, seat_id }
 *   { type: 'SYSTEM_METRICS',    active_holds, bookings_last_60s, gateway_status, duplicate_callbacks_intercepted }
 *
 * WebSocket events (Client → Server):
 *   { type: 'SUBSCRIBE_SHOW',   show_id }
 *   { type: 'UNSUBSCRIBE_SHOW', show_id }
 */

import { WebSocketServer } from 'ws';
import { query } from '../db/postgres.js';
import { getRedis } from '../db/redis.js';
import { checkGatewayHealth } from '../modules/payment/gateway.client.js';

let wss;

// ─────────────────────────────────────────────────────────────────────────────
// initWebSocket — called once from app.js with the HTTP server
// ─────────────────────────────────────────────────────────────────────────────
export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.subscribedShowId = null;

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'SUBSCRIBE_SHOW') {
          ws.subscribedShowId = String(msg.show_id);
          console.log(`[WS] Client subscribed to show: ${ws.subscribedShowId}`);
        } else if (msg.type === 'UNSUBSCRIBE_SHOW') {
          if (ws.subscribedShowId === String(msg.show_id)) {
            ws.subscribedShowId = null;
          }
        }
      } catch (err) {
        console.error('[WS] Parse error:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      ws.subscribedShowId = null;
    });
  });

  console.log('[WS] WebSocket server initialized');
};

// ─────────────────────────────────────────────────────────────────────────────
// broadcast — send to ALL connected clients
// ─────────────────────────────────────────────────────────────────────────────
export const broadcast = (data) => {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// broadcastToShow — send only to clients subscribed to a specific show
// ─────────────────────────────────────────────────────────────────────────────
export const broadcastToShow = (showId, data) => {
  if (!wss) return;
  const payload     = JSON.stringify(data);
  const targetId    = String(showId);
  let   count       = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.subscribedShowId === targetId) {
      client.send(payload);
      count++;
    }
  });

  console.log(`[WS] ${data.type} → show ${showId} (${count} client(s))`);
};

// ─────────────────────────────────────────────────────────────────────────────
// startMetricsBroadcast — push SYSTEM_METRICS to all clients periodically
// Architecture spec: { type: 'SYSTEM_METRICS', active_holds, bookings_last_60s,
//                       gateway_status, duplicate_callbacks_intercepted }
// ─────────────────────────────────────────────────────────────────────────────
export const startMetricsBroadcast = (intervalMs = 10_000) => {
  const gatherAndBroadcast = async () => {
    if (!wss || wss.clients.size === 0) return; // no-op if nobody connected

    try {
      const [holdsRes, recentRes] = await Promise.all([
        query(`SELECT COUNT(*) FROM show_seats WHERE status = 'held' AND held_until > NOW()`),
        query(`SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND updated_at > NOW() - INTERVAL '60 seconds'`),
      ]);

      let duplicates = 0;
      try {
        const redis = getRedis();
        if (redis) {
          const val = await redis.get('metrics:duplicate_callbacks');
          duplicates = parseInt(val || '0', 10);
        }
      } catch (_) { /* best-effort */ }

      const gatewayStatus = await checkGatewayHealth();

      broadcast({
        type:                            'SYSTEM_METRICS',
        active_holds:                    parseInt(holdsRes.rows[0].count, 10),
        bookings_last_60s:               parseInt(recentRes.rows[0].count, 10),
        gateway_status:                  gatewayStatus,
        duplicate_callbacks_intercepted: duplicates,
      });
    } catch (err) {
      console.error('[WS Metrics] Gather error:', err.message);
    }
  };

  setInterval(gatherAndBroadcast, intervalMs);
  console.log(`[WS] SYSTEM_METRICS broadcast started (every ${intervalMs / 1000}s)`);
};
