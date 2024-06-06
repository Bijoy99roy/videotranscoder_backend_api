import { createClient } from 'redis';

const redisClient = createClient();
const redisPublisher = createClient();

redisClient.on('connect', () => console.log('Redis client connected'));
redisPublisher.on('connect', () => console.log('Redis Publisher connected'));


redisClient.on('error', (err) => console.error('Redis client error:', err));
redisPublisher.on('error', (err) => console.error('Redis publisher error:', err));


redisClient.connect();
redisPublisher.connect();


export { redisClient, redisPublisher };
