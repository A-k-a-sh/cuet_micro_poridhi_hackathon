import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metrics
const successfulHolds = new Counter('successful_holds');
const rejectedHolds = new Counter('rejected_holds');
const oversells = new Counter('oversells');  // MUST be 0

// *** CONFIGURE THESE BEFORE RUNNING ***
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;     // JWT for a logged-in user
const SHOW_ID = __ENV.SHOW_ID;           // The show to test
const SEAT_ID = __ENV.SEAT_ID;           // ONE specific seat — all 100 fight for this

export const options = {
  scenarios: {
    concurrent_holds: {
      executor: 'shared-iterations',
      vus: 100,            // 100 virtual users
      iterations: 100,     // 100 total requests
      maxDuration: '30s',
    }
  },
  thresholds: {
    'successful_holds': ['count == 1'],   // Exactly 1 must succeed
    'oversells': ['count == 0'],          // Zero tolerance
    http_req_failed: ['rate < 0.02'],     // <2% network errors
  }
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/bookings/hold`,
    JSON.stringify({ show_id: SHOW_ID, seat_id: SEAT_ID }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    }
  );

  if (res.status === 201) {
    successfulHolds.add(1);
    check(res, {
      'hold response has booking_ref': (r) => JSON.parse(r.body).booking_ref !== undefined,
      'hold response has expires_at': (r) => JSON.parse(r.body).expires_at !== undefined,
    });
  } else if (res.status === 409) {
    rejectedHolds.add(1);
    check(res, {
      'rejection has error message': (r) => JSON.parse(r.body).error !== undefined,
    });
  } else {
    // Any other status is unexpected
    oversells.add(1);
    console.error(`Unexpected status: ${res.status} — ${res.body}`);
  }
}

export function handleSummary(data) {
  const successful = data.metrics.successful_holds?.values?.count || 0;
  const rejected = data.metrics.rejected_holds?.values?.count || 0;
  const over = data.metrics.oversells?.values?.count || 0;

  console.log('\n========== SCENARIO A RESULTS ==========');
  console.log(`Requests sent:        100`);
  console.log(`Successful holds:     ${successful}  (must be exactly 1)`);
  console.log(`Cleanly rejected:     ${rejected}  (must be exactly 99)`);
  console.log(`Oversell count:       ${over}  (MUST BE ZERO)`);
  console.log(`Oversell check:       ${over === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Hold count check:     ${successful === 1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('=========================================\n');

  return {
    'scenario_a_results.json': JSON.stringify(data, null, 2)
  };
}
