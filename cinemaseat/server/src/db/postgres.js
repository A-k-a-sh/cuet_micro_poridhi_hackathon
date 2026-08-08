import pg from 'pg';
const { Pool } = pg;

let pool;

export const connectPostgres = async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('SELECT 1');
  console.log('PostgreSQL connected');
};

// Named exports used by every module
export const query      = (text, params) => pool.query(text, params);
export const getClient  = ()             => pool.connect();
export const getPool    = ()             => pool;

// Default export kept for backward compat
export default {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
};
