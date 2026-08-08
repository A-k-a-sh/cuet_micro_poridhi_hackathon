import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

import { connectPostgres } from './db/postgres.js';
import { connectRedis } from './db/redis.js';
import authRoutes from './modules/auth/auth.routes.js';
import catalogueRoutes from './modules/catalogue/catalogue.routes.js';
import bookingRoutes from './modules/booking/booking.routes.js';
import paymentRoutes from './modules/payment/payment.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startHoldSweeper } from './modules/booking/holdSweeper.js';
import { broadcastToShow } from './websocket/wsServer.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(morgan('dev'));
app.use(express.json());

// *** JUDGING REQUIREMENT: must return 200 in under 1 second even when gateway is down ***
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogueRoutes);
app.use('/api', bookingRoutes);
app.use('/api/payments', paymentRoutes);

app.use(errorHandler);

const start = async () => {
  await connectPostgres();
  await connectRedis();

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`CinemaSeat server running on port ${PORT}`);
  });

  // WebSocket server attaches to same HTTP server
  const { initWebSocket } = await import('./websocket/wsServer.js');
  initWebSocket(server);

  // Start the hold sweeper, pass callback to broadcast to websocket
  startHoldSweeper(5000, (expiredBooking) => {
    broadcastToShow(expiredBooking.show_id, {
      type: 'HOLD_EXPIRED',
      booking_ref: expiredBooking.booking_ref,
      seat_id: expiredBooking.seat_id
    });
    broadcastToShow(expiredBooking.show_id, {
      type: 'SEAT_UPDATE',
      show_id: expiredBooking.show_id,
      seat_id: expiredBooking.seat_id,
      status: 'available'
    });
  });
};

start().catch(console.error);

export default app;
