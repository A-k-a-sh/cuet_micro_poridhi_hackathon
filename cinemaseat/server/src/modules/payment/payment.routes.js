import { Router } from 'express';
import { processPaymentCallback } from './payment.service.js';
import { broadcastToShow } from '../../websocket/wsServer.js';
import pool from '../../db/postgres.js';
import { sendOtp } from './gateway.client.js';

const router = Router();

router.post('/callback', async (req, res, next) => {
  try {
    const payload = req.body;
    
    // Process idempotently
    const result = await processPaymentCallback(payload);
    
    // Always return 200 per docs to stop the gateway from retrying
    res.status(200).json({ status: 'received' });
    
    // Post-processing: If successfully processed, trigger OTP and WebSockets
    if (result.status === 'processed') {
      const { booking_ref, status, amount } = payload;
      
      // We need the show_id to broadcast to the correct room. We should fetch it.
      const { rows } = await pool.query('SELECT show_id, seat_id FROM bookings WHERE booking_ref = $1', [booking_ref]);
      if (rows.length > 0) {
        const { show_id, seat_id } = rows[0];
        
        if (status === 'SUCCEEDED') {
          // Fire and forget the OTP sending
          sendOtp('user_phone', booking_ref).catch(err => console.error('OTP Send error:', err));
          
          broadcastToShow(show_id, {
            type: 'SEAT_UPDATE',
            show_id,
            seat_id,
            status: 'confirmed'
          });
          
          broadcastToShow(show_id, {
            type: 'BOOKING_CONFIRMED',
            booking_ref
          });
        } else if (status === 'FAILED') {
          broadcastToShow(show_id, {
            type: 'SEAT_UPDATE',
            show_id,
            seat_id,
            status: 'available'
          });
          
          broadcastToShow(show_id, {
            type: 'PAYMENT_FAILED',
            booking_ref,
            message: 'Payment failed'
          });
        }
      }
    }
  } catch (err) {
    console.error('Callback error:', err.message);
    // Even on error, if it's our internal fault, maybe we should return 500, 
    // but the doc says "Always return 200 from your callback handler, even for a duplicate."
    // We'll return 200 to acknowledge receipt and prevent infinite retries.
    res.status(200).json({ status: 'error_but_acknowledged' });
  }
});

export default router;
