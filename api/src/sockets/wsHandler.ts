import { WebSocket } from "ws";
import { redisClient, redisSubscriber } from "../redis/redis"
import { PrismaClient } from '@prisma/client'
import { wss } from "..";

const prisma = new PrismaClient()

export let clients = new Map<string, WebSocket>();

export const handleWebSocket = async (ws: WebSocket) => {
    let registeredUserId: string | null = null;
    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message.toString());

        if (parsedMessage.type === "register") {
            const userId = parsedMessage.userId;

            const webSocket = clients.get(userId);
            if (!webSocket){
                clients.set(userId,  ws);
                registeredUserId = userId;

            } else {
                console.log(`UserId: ${userId} is already registered`)
            }
            
        } else if (parsedMessage.type === "connect"){
            const userId = parsedMessage.userId;
            const webSocket = clients.get(userId);
            if (!webSocket){
                clients.set(userId,  ws );
            }
        }
    });

    ws.on('close', async () => {
        
        if (registeredUserId) {
            clients.delete(registeredUserId);
        }
    })
}

export function broadcastViews(videoId: string, views: number){
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {     
          client.send(JSON.stringify({ type:"views", videoId, views }));
        }
    })

}

redisSubscriber.subscribe("transcode_complete", async (message) => {

    const {  videoId, userId, status, thumbnailUrl } = JSON.parse(message);

    const webSocket = clients.get(userId);

    if (webSocket) {
        webSocket.send(JSON.stringify({ type:"videoInfo",  videoId, status, thumbnailUrl }));
    } else {
        console.error("Websocket not found") 
    }

})