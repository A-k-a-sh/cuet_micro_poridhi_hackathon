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
