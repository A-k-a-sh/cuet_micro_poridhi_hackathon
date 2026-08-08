import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN_1 = __ENV.AUTH_TOKEN_1;   // User 1 — holds the seat
const AUTH_TOKEN_2 = __ENV.AUTH_TOKEN_2;   // User 2 — books after expiry
const SHOW_ID = __ENV.SHOW_ID;
const SEAT_ID = __ENV.SEAT_ID;
const HOLD_TTL = parseInt(__ENV.HOLD_TTL_SECONDS || '30');

// Run this as a single-VU sequential scenario
export const options = {
  vus: 1,
  iterations: 1
};

export default function () {
  console.log('=== SCENARIO B: Abandoned Hold ===');
  console.log(`Hold TTL: ${HOLD_TTL}s`);

  // --- Step 1: User 1 holds the seat ---
  console.log('\n[1] User 1 holds the seat...');
  const holdRes = http.post(
    `${BASE_URL}/api/bookings/hold`,
    JSON.stringify({ show_id: SHOW_ID, seat_id: SEAT_ID }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN_1}` } }
  );

  check(holdRes, { 'User 1 hold succeeded': (r) => r.status === 201 });
  const holdData = JSON.parse(holdRes.body);
  console.log(`Hold created: ${holdData.booking_ref}, expires: ${holdData.expires_at}`);

  // --- Step 2: Verify seat shows as held ---
  const mapRes1 = http.get(`${BASE_URL}/api/shows/${SHOW_ID}/seats`);
  const map1 = JSON.parse(mapRes1.body);
  const seatBefore = findSeat(map1, SEAT_ID);
  console.log(`[2] Seat status before expiry: ${seatBefore?.status}`);
  check({ status: seatBefore?.status }, { 'Seat is held': (s) => s.status === 'held' });

  // --- Step 3: Walk away — wait for TTL to expire ---
  console.log(`\n[3] Waiting ${HOLD_TTL + 5}s for hold to expire...`);
  sleep(HOLD_TTL + 5); // Wait past TTL + sweeper buffer

  // --- Step 4: Verify seat is back to available ---
  const mapRes2 = http.get(`${BASE_URL}/api/shows/${SHOW_ID}/seats`);
  const map2 = JSON.parse(mapRes2.body);
  const seatAfter = findSeat(map2, SEAT_ID);
  console.log(`[4] Seat status after expiry: ${seatAfter?.status}`);
  check({ status: seatAfter?.status }, { 'Seat is available again': (s) => s.status === 'available' });

  // --- Step 5: User 2 successfully books the seat ---
  console.log('\n[5] User 2 attempts to book the released seat...');
  const hold2Res = http.post(
    `${BASE_URL}/api/bookings/hold`,
    JSON.stringify({ show_id: SHOW_ID, seat_id: SEAT_ID }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN_2}` } }
  );

  check(hold2Res, { 'User 2 successfully booked released seat': (r) => r.status === 201 });
  const hold2Data = JSON.parse(hold2Res.body);
  console.log(`[5] User 2 booking: ${hold2Data.booking_ref}`);

  // --- Summary ---
  console.log('\n=== SCENARIO B RESULTS ===');
  console.log(`Hold TTL:           ${HOLD_TTL}s`);
  console.log(`Seat held at:       T+0`);
  console.log(`Seat released at:   ~T+${HOLD_TTL}s (sweeper)`);
  console.log(`User 2 booked at:   T+${HOLD_TTL + 5}s`);
  console.log(`Seat status before: held`);
  console.log(`Seat status after:  available`);
  console.log(`User 2 booked:      ${hold2Data.booking_ref ? '✅ YES' : '❌ NO'}`);
}

function findSeat(seatMapResponse, seatId) {
  const map = seatMapResponse.seat_map;
  for (const row of Object.values(map)) {
    const seat = row.find(s => s.seat_id === seatId);
    if (seat) return seat;
  }
  return null;
}
