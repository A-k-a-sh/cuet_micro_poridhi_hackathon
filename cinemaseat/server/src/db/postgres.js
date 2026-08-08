/**
 * postgres.js
 * PostgreSQL connection pool + migrations.
 * Architecture spec: src/db/postgres.js
 * Database spec: 02 database.md — complete schema
 */

import pg from 'pg';
const { Pool } = pg;

let pool;

export const connectPostgres = async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('SELECT 1');
  console.log('PostgreSQL connected');
};

// Named exports used by every module (architecture spec)
export const query     = (text, params) => pool.query(text, params);
export const getClient = ()             => pool.connect();
export const getPool   = ()             => pool;

// Default export — backward compat shim
export default {
  query:   (text, params) => pool.query(text, params),
  connect: ()             => pool.connect(),
};

// ─────────────────────────────────────────────────────────────────────────────
// runMigrations — complete schema from 02 database.md
// Idempotent: all statements use IF NOT EXISTS
// ─────────────────────────────────────────────────────────────────────────────
export const runMigrations = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT NOT NULL,
      description TEXT,
      genre       TEXT[],
      duration    INTEGER NOT NULL,
      language    TEXT DEFAULT 'English',
      poster_url  TEXT,
      rating      NUMERIC(2,1),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS theatres (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      location    TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS halls (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      theatre_id  UUID NOT NULL REFERENCES theatres(id),
      name        TEXT NOT NULL,
      total_seats INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shows (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      movie_id    UUID NOT NULL REFERENCES movies(id),
      hall_id     UUID NOT NULL REFERENCES halls(id),
      starts_at   TIMESTAMPTZ NOT NULL,
      base_price  NUMERIC(10,2) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS seats (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hall_id          UUID NOT NULL REFERENCES halls(id),
      row_label        TEXT NOT NULL,
      seat_number      INTEGER NOT NULL,
      category         TEXT NOT NULL DEFAULT 'standard',
      price_multiplier NUMERIC(3,2) DEFAULT 1.0,
      UNIQUE(hall_id, row_label, seat_number)
    );

    CREATE TABLE IF NOT EXISTS show_seats (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      show_id     UUID NOT NULL REFERENCES shows(id),
      seat_id     UUID NOT NULL REFERENCES seats(id),
      status      TEXT NOT NULL DEFAULT 'available',
      held_by     TEXT,
      held_until  TIMESTAMPTZ,
      booking_ref TEXT UNIQUE,
      price       NUMERIC(10,2),
      UNIQUE(show_id, seat_id),
      CONSTRAINT valid_status CHECK (status IN (
        'available','held','pending_payment','otp_pending',
        'confirmed','refund_pending','refunded'
      ))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_ref  TEXT UNIQUE NOT NULL,
      show_seat_id UUID NOT NULL REFERENCES show_seats(id),
      phone        TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'held',
      amount       NUMERIC(10,2) NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT valid_booking_status CHECK (status IN (
        'held','pending_payment','otp_pending',
        'confirmed','refund_pending','refunded',
        'failed','expired'
      ))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_ref      TEXT NOT NULL REFERENCES bookings(booking_ref),
      payment_id       TEXT UNIQUE,
      status           TEXT NOT NULL DEFAULT 'initiated',
      amount           NUMERIC(10,2) NOT NULL,
      currency         TEXT DEFAULT 'BDT',
      gateway_response JSONB,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS metrics_log (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type  TEXT NOT NULL,
      booking_ref TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- ── Indexes for hot paths ──────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_show_seats_show_id   ON show_seats(show_id);
    CREATE INDEX IF NOT EXISTS idx_show_seats_status    ON show_seats(status);
    CREATE INDEX IF NOT EXISTS idx_show_seats_held_until
      ON show_seats(held_until) WHERE status = 'held';
    CREATE INDEX IF NOT EXISTS idx_bookings_booking_ref ON bookings(booking_ref);
    CREATE INDEX IF NOT EXISTS idx_bookings_phone       ON bookings(phone);
    CREATE INDEX IF NOT EXISTS idx_payments_payment_id  ON payments(payment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_booking_ref ON payments(booking_ref);
    CREATE INDEX IF NOT EXISTS idx_shows_starts_at      ON shows(starts_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_event_type   ON metrics_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_metrics_created_at   ON metrics_log(created_at);
  `);

  console.log('Migrations complete');
};
