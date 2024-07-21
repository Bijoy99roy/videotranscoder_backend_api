import { createClient } from 'redis';

const redisClient = createClient();
const redisSubscriber = createClient();

redisClient.on('connect', () => console.log('Redis client connected'));
redisSubscriber.on('connect', () => console.log('Redis Subscriber connected'));

redisClient.on('error', (err) => console.error('Redis client error:', err));
redisSubscriber.on('error', (err) => console.error('Redis subscriber error:', err));

redisClient.connect();
redisSubscriber.connect();


export { redisClient, redisSubscriber };
