import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const connectPostgres = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
  }
};

export const runMigrations = async () => {
  console.log('Running database migrations...');
  // Migrations will be implemented in database schema setup step
};

export default pool;
