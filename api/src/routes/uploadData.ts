import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import redisConfig from "../config";
import { v4 as uuidv4 } from "uuid";

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const uploadRouter = express.Router();

const redisClient = createClient()
const redisSubscriber = createClient();

// Handle errors and connection events
redisSubscriber.on('error', (err) => console.error('Redis subscriber error:', err));
redisSubscriber.on('connect', () => console.log('Redis subscriber connected'));
redisSubscriber.on('ready', () => {
  console.log('Redis subscriber ready to subscribe');

  // Subscribe to the 'transcode_complete' channel
  redisSubscriber.subscribe('transcode_complete', (message: string) => {
    
      console.log(`Subscribed successfully to ${message} `);
    
  });
});

// Handle incoming messages
redisSubscriber.on('message', (channel, message) => {
  console.log(`Received message on channel ${channel}: ${message}`);
});
redisClient.on("error", (err) => {
    console.error("Redis client is not connected to the server: ", err)
});

redisClient.on("connect", () => {
    console.log("Redis client is connected to the server!!")
})

uploadRouter.post("/uploadfile", upload.single("videoFile"), async (req, res) => {
    // console.log(req.file)
    
    try{
        
        
        const user = await prisma.user.findFirst({
            where:{
                firstName: "Bijoy"
            },
            select: {
                id: true
            }
        })

        const video = await prisma.video.create({
            data: {
                title: "hello",
                description: "sdfdf",
                userId: user?.id as string
            }
        })

        const videoQueue = await prisma.videoQueue.create({
            data: {
                userId: user?.id as string,
                videoId: video.id
            }
        })

        const videoId = video.id;
        let payload = {
            fieldname: 'videoFile',
            originalname: 'lake.mp4',
            encoding: '7bit',
            mimetype: 'video/mp4',
            destination: './uploads',
            filename: 'a75094e0-d685-49be-8f36-b84db1b45329.mp4',
            videoPath: `E:\\Projects\\video_transcoder_backend_api\\api\\uploads\\${req.file?.filename}`,
            size: 42992636,
            outputPath:  `./uploads/hls-videos/${videoId}`,
            videoId: videoId,
            retries: 0
        }
        console.log(video);
        console.log(payload)
        await redisClient.lPush(redisConfig.queueName, JSON.stringify(payload))
        res.status(200).json({
            message: "File added to the processing queue"
        })
    } catch(error) {
        console.log("Failed to add file to the processing queue", error)
        res.status(500).json({
            error: "Failed to add file to processing queue"
        });
    }
});



async function startServer() {
    try {
        await redisClient.connect();
        await redisSubscriber.connect();
        console.log("Connected to Redis");

    } catch (error) {
        console.error("Failed to connect to Redis", error);
    }
}

startServer();

export = uploadRouter;