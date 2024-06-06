import { WebSocket } from "ws";
import { redisClient, redisSubscriber } from "../config/redis"

interface ClientInfo1 {
    userId: string;
    ws: WebSocket
}

interface ClientInfo {
    jobId: string;
    ws: WebSocket
}

let clients = new Map<string, ClientInfo>();

export const handleWebSocket = (ws: WebSocket) => {
    let registeredUserId: string | null = null;

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message.toString());

        if (parsedMessage.type === "register") {
            const userId = parsedMessage.userId;
            const jobId = parsedMessage.jobId;
            // replace jobId to userId to be able to connect to the same user after disconnect
            clients.set(userId, { jobId , ws });
            registeredUserId = userId;

            await redisClient.hSet("clients", jobId, JSON.stringify({ userId }));
            console.log(`User registered with ID: ${userId} for job ID: ${jobId}`);
        }
    });

    ws.on('close', async () => {
        if (registeredUserId) {
            for (const [userId, clientInf] of clients.entries()) {
                const { jobId, ws } = clientInf;
                const clientInfo = await redisClient.hGet('clients', jobId);
       
                    if (userId === registeredUserId) {
                        clients.delete(userId);
                        await redisClient.hDel('clients', jobId);
                        console.log(`Client disconnected: ${registeredUserId} for job ID: ${jobId}`);
                    }
                
            }
        }
    })
}


redisSubscriber.subscribe("transcode_complete", async (message) => {
    const { jobId, videoId, userId, status } = JSON.parse(message);
    await redisClient.set(jobId, JSON.stringify({ videoId, userId, status }));
    const clientInfoStr = await redisClient.hGet('clients', jobId);

    if (clientInfoStr) {
        const clientInfo = JSON.parse(clientInfoStr);
        const client = clients.get(clientInfo.userId);

        if (client?.ws) {
            client.ws.send(JSON.stringify({ jobId, videoId, status }));
        }
    }
})