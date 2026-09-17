import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/AstroSolution',
  options: {
    maxPoolSize: 45,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
}));
