import { WebSocket } from "ws";
import { redisClient, redisSubscriber } from "../config/redis"
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ClientInfo1 {
    userId: string;
    ws: WebSocket
}

interface ClientInfo {
    jobId: string;
    ws: WebSocket
}

let clients = new Map<string, WebSocket>();

export const handleWebSocket = async (ws: WebSocket) => {
    let registeredUserId: string | null = null;
    

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message.toString());

        if (parsedMessage.type === "register") {
            const userId = parsedMessage.userId;
            const jobId = parsedMessage.jobId;
            // replace jobId to userId to be able to connect to the same user after disconnect
            const webSocket = clients.get(userId);
            if (!webSocket){
                clients.set(userId,  ws );
                registeredUserId = userId;

                await redisClient.hSet("clients", userId, JSON.stringify({ jobId }));
                console.log(`User registered with ID: ${userId} for job ID: ${jobId}, ${clients.get(userId)}`);
            } else {
                console.log(`UserId: ${userId} is an active connetion in different browser/device`)
            }
            
        } else if (parsedMessage.type === "connect") {
            const userId = parsedMessage.userId;
            const webSocket = clients.get(userId);
            if (!webSocket){
                const jobs = await prisma.videoQueue.findFirst({
                    where: {
                        userId: userId,
                        OR: [
                            {
                                status: "IN_PROCESS"
                            },
                            {
                                status: "QUEUED"
                            }
                        ]
                    }
                });
                console.log(jobs)
                if (jobs) {
                    clients.set(userId, ws);
                    registeredUserId = userId;
                }
            } else {
                console.log(`UserId: ${userId} is an active connetion in different browser/device`)
            }
            
        }
    });

    ws.on('close', async () => {
        if (registeredUserId) {
            // for (const [userId, clientInf] of clients.entries()) {
                // const { jobId, ws } = clientInf;
                const clientInfo = await redisClient.hGet('clients', registeredUserId);
                if (clientInfo) {
                    const { jobId } = JSON.parse(clientInfo)
                    clients.delete(registeredUserId);
                    await redisClient.hDel('clients', registeredUserId);
                    console.log(`Client disconnected: ${registeredUserId} for job ID: ${jobId}`);
                
                }
                    
                
            // }
        }
    })
}


redisSubscriber.subscribe("transcode_complete", async (message) => {
    // console.log("Entered")
    const { jobId, videoId, userId, status } = JSON.parse(message);
    // console.log("Entered1")
    await redisClient.set(jobId, JSON.stringify({ videoId, userId, status }));
    // console.log("Entered2")
    // const clientInfoStr = await redisClient.hGet('clients', userId);
    // console.log("Entere3")
    // if (clientInfoStr) {
        // const clientInfo = JSON.parse(clientInfoStr);
    console.log(status)
    const webSocket = clients.get(userId);
    // console.log("Entered4")
    if (webSocket) {
        webSocket.send(JSON.stringify({ type:"videoInfo", jobId, videoId, status }));
    } else {
        console.log("Websocket not found") 
    }
    // }
})