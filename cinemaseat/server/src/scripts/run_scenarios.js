import axios from 'axios';
import { execSync } from 'child_process';
import { getJwtForPhone } from './get_jwt.js';

const BASE_URL = 'http://localhost:3001';
const DOCKER_BASE_URL = 'http://server:3000';

async function run() {
  console.log('=== Starting Test Scenario Runner ===');

  // 1. Get JWT tokens for two test users
  const token1 = await getJwtForPhone('+8801700000001');
  const token2 = await getJwtForPhone('+8801700000002');

  console.log(`Token 1: ${token1.substring(0, 15)}...`);
  console.log(`Token 2: ${token2.substring(0, 15)}...`);

  // 2. Fetch movies and pick a show
  console.log('\nFetching movies...');
  const moviesRes = await axios.get(`${BASE_URL}/api/movies`);
  const spiderman = moviesRes.data.find(m => m.title.includes('Spider-Man'));
  if (!spiderman) {
    throw new Error('Spider-Man movie not found in database');
  }
  console.log(`Found movie: ${spiderman.title} (ID: ${spiderman.id})`);

  console.log('\nFetching shows...');
  const showsRes = await axios.get(`${BASE_URL}/api/movies/${spiderman.id}/shows`);
  if (showsRes.data.length === 0) {
    throw new Error('No shows found for Spider-Man');
  }
  const show = showsRes.data[0];
  const showId = show.id;
  console.log(`Using show ID: ${showId} (starts at ${show.starts_at}, ${show.theatre_name})`);

  // 3. Fetch seats for the show and select two available seats
  console.log('\nFetching seats...');
  const seatsRes = await axios.get(`${BASE_URL}/api/shows/${showId}/seats`);
  const seatMap = seatsRes.data.seat_map;

  const availableSeats = [];
  for (const [row, seats] of Object.entries(seatMap)) {
    for (const seat of seats) {
      if (seat.status === 'available') {
        availableSeats.push(seat.seat_id);
      }
    }
  }

  if (availableSeats.length < 2) {
    throw new Error('Not enough available seats to run tests. Please restart/reset the DB.');
  }

  const seatA = availableSeats[0];
  const seatB = availableSeats[1];
  console.log(`Selected Seat A (for Scenario A): ${seatA}`);
  console.log(`Selected Seat B (for Scenario B): ${seatB}`);

  // 4. Run Scenario A
  console.log('\n=== RUNNING SCENARIO A: One seat, many buyers ===');
  const cmdA = `docker run --network cinemaseat_default \
    -e BASE_URL=${DOCKER_BASE_URL} \
    -e AUTH_TOKEN=${token1} \
    -e SHOW_ID=${showId} \
    -e SEAT_ID=${seatA} \
    --rm -i grafana/k6 run - < k6/scenario_a.js`;

  console.log(`Executing: ${cmdA.substring(0, 120)}...`);
  try {
    const outputA = execSync(cmdA, { cwd: '/Users/akash/All code/Hackathon/poridhi_micro_cuet/cinemaseat', encoding: 'utf8' });
    console.log(outputA);
  } catch (err) {
    console.error('Scenario A failed to execute:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout);
    if (err.stderr) console.error('Stderr:', err.stderr);
  }

  // 5. Run Scenario B
  console.log('\n=== RUNNING SCENARIO B: The abandoned hold ===');
  const serverHoldTtl = '15'; // since we updated docker-compose to 15
  const cmdB = `docker run --network cinemaseat_default \
    -e BASE_URL=${DOCKER_BASE_URL} \
    -e AUTH_TOKEN_1=${token1} \
    -e AUTH_TOKEN_2=${token2} \
    -e SHOW_ID=${showId} \
    -e SEAT_ID=${seatB} \
    -e HOLD_TTL_SECONDS=${serverHoldTtl} \
    --rm -i grafana/k6 run - < k6/scenario_b.js`;

  console.log(`Executing: ${cmdB.substring(0, 120)}...`);
  try {
    const outputB = execSync(cmdB, { cwd: '/Users/akash/All code/Hackathon/poridhi_micro_cuet/cinemaseat', encoding: 'utf8' });
    console.log(outputB);
  } catch (err) {
    console.error('Scenario B failed to execute:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout);
    if (err.stderr) console.error('Stderr:', err.stderr);
  }
}

run().catch(err => {
  console.error('Runner error:', err);
});
