import { createClient, RedisClientType } from "redis";

export function initializeRedis() {
    try{
        const redicClient = createClient();
        return redicClient;
    } catch(error) {
        console.error("Failed to initalize redis client");
    }
    
}

export async function connectRedis(){
    try{
        const client = initializeRedis();
        if (client) {
            await client.connect();
        } else {
            console.error("Client not found");
        }
    } catch (error) {
        console.error("Errpr occured connecting redis client");
    }
}