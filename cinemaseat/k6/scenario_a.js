import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    burst_holds: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

export default function () {
  const url = 'http://localhost:3000/api/holds';
  const payload = JSON.stringify({
    show_id: 'show_123',
    seat_id: 'seat_F12',
    user_id: `user_${__VU}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
}
