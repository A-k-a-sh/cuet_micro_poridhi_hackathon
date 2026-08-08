import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cinemaseat',
});

const runSeed = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting database seed...');

    // 1. Create Tables
    await client.query(`
      DROP TABLE IF EXISTS bookings, seats, shows, theatres, movies CASCADE;

      CREATE TABLE movies (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        duration_minutes INT NOT NULL
      );

      CREATE TABLE theatres (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL
      );

      CREATE TABLE shows (
        id SERIAL PRIMARY KEY,
        movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
        theatre_id INT REFERENCES theatres(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        price_cents INT NOT NULL
      );

      CREATE TYPE seat_status AS ENUM ('available', 'held', 'confirmed');
      
      CREATE TABLE seats (
        id SERIAL PRIMARY KEY,
        show_id INT REFERENCES shows(id) ON DELETE CASCADE,
        row_identifier VARCHAR(5) NOT NULL,
        seat_number INT NOT NULL,
        status seat_status DEFAULT 'available' NOT NULL,
        UNIQUE(show_id, row_identifier, seat_number)
      );

      CREATE TABLE bookings (
        booking_ref VARCHAR(255) PRIMARY KEY,
        show_id INT REFERENCES shows(id),
        seat_id INT REFERENCES seats(id),
        user_id VARCHAR(255),
        payment_id VARCHAR(255),
        status VARCHAR(50) NOT NULL, -- 'HELD', 'PENDING_PAYMENT', 'OTP_PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED'
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tables created.');

    // 2. Seed Data
    const movieRes = await client.query(`
      INSERT INTO movies (title, description, duration_minutes) 
      VALUES ('Spider-Man: Brand New Day', 'Midnight premiere of the highly anticipated sequel.', 148)
      RETURNING id;
    `);
    const movieId = movieRes.rows[0].id;

    const theatreRes = await client.query(`
      INSERT INTO theatres (name, location) 
      VALUES ('Star Cineplex', 'Bashundhara City')
      RETURNING id;
    `);
    const theatreId = theatreRes.rows[0].id;

    const showRes = await client.query(`
      INSERT INTO shows (movie_id, theatre_id, start_time, price_cents)
      VALUES ($1, $2, NOW() + interval '1 day', 45000)
      RETURNING id;
    `, [movieId, theatreId]);
    const showId = showRes.rows[0].id;

    // Seed 100 seats for this show (Rows A-J, Seats 1-10)
    let seatParams = [];
    let seatValues = [];
    let count = 1;
    for (let row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
      for (let num = 1; num <= 10; num++) {
        seatValues.push(`($${count++}, $${count++}, $${count++})`);
        seatParams.push(showId, row, num);
      }
    }

    await client.query(`
      INSERT INTO seats (show_id, row_identifier, seat_number)
      VALUES ${seatValues.join(', ')}
    `, seatParams);
    
    console.log(`Seeded 1 movie, 1 theatre, 1 show, and 100 seats.`);
    console.log(`Database seed completed successfully.`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    client.release();
    pool.end();
  }
};

runSeed();
