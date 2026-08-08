import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const url = 'http://localhost:3000/api/holds';
  const payload = JSON.stringify({
    show_id: 'show_123',
    seat_id: 'seat_F12',
    user_id: 'user_abandon',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'hold successful': (r) => r.status === 200,
  });

  console.log('Holding seat and abandoning payment. Waiting for TTL expiration...');
  sleep(35); // Wait for TTL expiration
}
