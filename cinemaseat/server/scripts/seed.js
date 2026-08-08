import dotenv from 'dotenv';
dotenv.config();

export const seedDatabase = async () => {
  console.log('Seeding movies and theatres database...');
};

if (process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
