import { createClient } from 'redis';

let client;

export const connectRedis = async () => {
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  console.log('Redis connected');
};

export const getRedis = () => client;

// Default export kept for backward compat
export default {
  get:    (...args) => client.get(...args),
  set:    (...args) => client.set(...args),
  del:    (...args) => client.del(...args),
  setNX:  (...args) => client.setNX(...args),
  expire: (...args) => client.expire(...args),
  incr:   (...args) => client.incr(...args),
  scan:   (...args) => client.scan(...args),
  get isOpen() { return client?.isOpen ?? false; },
};
