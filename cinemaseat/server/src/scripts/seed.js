/**
 * seed.js
 * Populates the database with initial data per 02 database.md spec.
 *
 * Creates:
 *  - 5 movies (Spider-Man: Brand New Day + 4 others)
 *  - 2 theatres × 2 halls = 4 halls
 *  - Each hall: 10×12 seat grid (rows A-J, seats 1-12) = 120 seats
 *    - Rows A-C: VIP (1.5×)  |  D-G: premium (1.2×)  |  H-J: standard (1.0×)
 *  - Showtimes: each movie × each hall × 4 slots (10:00, 14:00, 18:00, 23:59)
 *  - show_seats: one row per (show, seat) combination, status = 'available'
 *
 * Idempotent: skips if movies table already has rows.
 */

import { query } from '../db/postgres.js';

const MOVIES = [
  {
    title:       'Spider-Man: Brand New Day',
    description: 'The web-slinger faces his greatest challenge yet in a city that no longer remembers him.',
    genre:       ['Action', 'Adventure', 'Superhero'],
    duration:    148,
    language:    'English',
    poster_url:  'https://picsum.photos/seed/spiderman/400/600',
    rating:      8.4,
  },
  {
    title:       'Echoes of Tomorrow',
    description: 'A physicist discovers she can send messages to her past self — but every change unravels something else.',
    genre:       ['Sci-Fi', 'Thriller'],
    duration:    132,
    language:    'English',
    poster_url:  'https://picsum.photos/seed/echoes/400/600',
    rating:      7.9,
  },
  {
    title:       'The Last Symphony',
    description: 'A deaf composer races to finish her magnum opus before a degenerative condition claims the rest of her hearing.',
    genre:       ['Drama', 'Music'],
    duration:    118,
    language:    'English',
    poster_url:  'https://picsum.photos/seed/symphony/400/600',
    rating:      8.1,
  },
  {
    title:       'Dhaka Noir',
    description: 'A detective in near-future Dhaka untangles a conspiracy that reaches the highest levels of government.',
    genre:       ['Thriller', 'Crime'],
    duration:    125,
    language:    'Bengali',
    poster_url:  'https://picsum.photos/seed/dhaka/400/600',
    rating:      8.6,
  },
  {
    title:       "Gravity's Edge",
    description: 'The first crewed mission to Europa finds something that was not supposed to be there.',
    genre:       ['Sci-Fi', 'Horror'],
    duration:    141,
    language:    'English',
    poster_url:  'https://picsum.photos/seed/gravity/400/600',
    rating:      7.7,
  },
];

const THEATRES = [
  { name: 'Star Cineplex',       location: 'Bashundhara City, Dhaka' },
  { name: 'Blockbuster Cinemas', location: 'Jamuna Future Park, Dhaka' },
];

const ROWS       = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const COLS       = Array.from({ length: 12 }, (_, i) => i + 1);
const TIMESLOTS  = ['10:00', '14:00', '18:00', '23:59'];
const BASE_PRICE = 250.00; // BDT

const categoryFor   = (row) =>
  ['A', 'B', 'C'].includes(row) ? 'vip'
    : ['D', 'E', 'F', 'G'].includes(row) ? 'premium'
    : 'standard';

const multiplierFor = (cat) =>
  cat === 'vip' ? 1.5 : cat === 'premium' ? 1.2 : 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// seedDatabase — idempotent, called from app.js after runMigrations()
// ─────────────────────────────────────────────────────────────────────────────
export const seedDatabase = async () => {
  const { rows: existing } = await query('SELECT COUNT(*) FROM movies');
  if (parseInt(existing[0].count, 10) > 0) {
    console.log('[Seed] Database already seeded, skipping.');
    return;
  }

  console.log('[Seed] Seeding database...');

  // ── Movies ──────────────────────────────────────────────────────────────────
  const movieIds = [];
  for (const m of MOVIES) {
    const { rows } = await query(
      `INSERT INTO movies (title, description, genre, duration, language, poster_url, rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [m.title, m.description, m.genre, m.duration, m.language, m.poster_url, m.rating]
    );
    movieIds.push(rows[0].id);
  }
  console.log(`[Seed] ${movieIds.length} movies inserted`);

  // ── Theatres + Halls ─────────────────────────────────────────────────────────
  const hallIds = [];
  for (const th of THEATRES) {
    const { rows: tRows } = await query(
      `INSERT INTO theatres (name, location) VALUES ($1,$2) RETURNING id`,
      [th.name, th.location]
    );
    const theatreId = tRows[0].id;

    for (const hallName of ['Hall 1', 'Hall 2']) {
      const { rows: hRows } = await query(
        `INSERT INTO halls (theatre_id, name, total_seats) VALUES ($1,$2,$3) RETURNING id`,
        [theatreId, hallName, ROWS.length * COLS.length]
      );
      hallIds.push(hRows[0].id);
    }
  }
  console.log(`[Seed] ${hallIds.length} halls across ${THEATRES.length} theatres`);

  // ── Seats (physical layout — shared across all shows in that hall) ───────────
  // seatMap[hallId][ `${row}${col}` ] = { id, multiplier }
  const seatMap = {};
  for (const hallId of hallIds) {
    seatMap[hallId] = {};
    for (const row of ROWS) {
      for (const col of COLS) {
        const cat = categoryFor(row);
        const mul = multiplierFor(cat);
        const { rows: sRows } = await query(
          `INSERT INTO seats (hall_id, row_label, seat_number, category, price_multiplier)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [hallId, row, col, cat, mul]
        );
        seatMap[hallId][`${row}${col}`] = { id: sRows[0].id, multiplier: mul };
      }
    }
  }
  const totalSeats = Object.values(seatMap).reduce((s, m) => s + Object.keys(m).length, 0);
  console.log(`[Seed] ${totalSeats} seats inserted`);

  // ── Shows + show_seats ────────────────────────────────────────────────────────
  const today = new Date();
  let showCount     = 0;
  let showSeatCount = 0;

  for (const movieId of movieIds) {
    for (const hallId of hallIds) {
      for (const time of TIMESLOTS) {
        const [hour, min] = time.split(':').map(Number);
        const startsAt    = new Date(today);
        startsAt.setHours(hour, min, 0, 0);

        const { rows: shRows } = await query(
          `INSERT INTO shows (movie_id, hall_id, starts_at, base_price)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [movieId, hallId, startsAt, BASE_PRICE]
        );
        const showId = shRows[0].id;
        showCount++;

        // One show_seat per physical seat in this hall
        for (const [, seat] of Object.entries(seatMap[hallId])) {
          await query(
            `INSERT INTO show_seats (show_id, seat_id, status, price)
             VALUES ($1,$2,'available',$3)`,
            [showId, seat.id, BASE_PRICE * seat.multiplier]
          );
          showSeatCount++;
        }
      }
    }
  }

  console.log(`[Seed] ${showCount} shows inserted`);
  console.log(`[Seed] ${showSeatCount} show_seats inserted (all available)`);
  console.log('[Seed] Database seeded successfully.');
};
