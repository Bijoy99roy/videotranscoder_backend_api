import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import {redisConfig, gcsConfig} from "../config/config";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../config/redis"
import { PrismaClient, User } from '@prisma/client'
const gcs = require('@google-cloud/storage');

const prisma = new PrismaClient()

const uploadRouter = express.Router();

// const redisClient = createClient()
// const redisSubscriber = createClient();

const bucketName = gcsConfig.bucketName;
const storage = new gcs.Storage({ keyFilename: 'E:/Projects/gcs/analog-antler-425411-e6-b4766e9f647f.json' });


function getGCSUrl(segmentName:any) {
    return `https://storage.googleapis.com/${bucketName}/${segmentName}`;
  }

  uploadRouter.put("/updateDetails", async (req, res) => {
    const videoId = req.body.videoId
    const title = req.body.title
    const description = req.body.description


    const video = await prisma.video.update({
      where:{
        id: videoId
      },
      data:{
        title: title,
        description: description
      }
    })

    res.json(video)
});

uploadRouter.get("/generateSignedUrlWrite", async (req, res) =>{
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    const fileName = req.query.fileName
    const contentType  = req.query.contentType;
    const type = req.query.type
    try {


        await storage.bucket(bucketName).setCorsConfiguration([
            {
              maxAgeSeconds: 3600,
              method: ["GET", "PUT"],
              origin: ["*"],
              responseHeader: ["Content-Type"],
            },
          ]);
        const options = {
          version: 'v4',
          action: 'write',
          expires: Date.now() + 30 * 60 * 1000, 
          contentType: contentType,
        };

        const user = await prisma.user.findFirst({
            where:{
                googleId: (req.user as User).googleId
            },
            select: {
                id: true
            }
        })

        let filePath;
        let videoId = null;

        if (type === "video") {

        

        const channel = await prisma.channel.findFirst({
            where:{
                userId: user?.id
            }
        })

        const video = await prisma.video.create({
            data: {
                title: fileName as string,
                description: "",
                channelId: channel?.id as string,
            }
        })
        
        const extension = (fileName as string).split(".").pop()
        filePath = `${video.id}/${video.id}.${extension}`
        console.log(filePath)
        videoId = video.id;

        await prisma.video.update({
            where:{
                id: video.id
            },
            data: {
                videoPath: filePath
            }
        })
    } else {
        const existingVideoId = req.query.videoId;
        const extension = (fileName as string).split(".").pop();
        filePath = `${existingVideoId}/sample_thumbnail.${extension}`;
        videoId = existingVideoId;
        const thumbnailUrl = getGCSUrl(filePath)
        await prisma.video.update({
            where:{
                id: videoId as string
            },
            data:{
                thumbnailUrl: thumbnailUrl
            }
        })
    }
        
        console.log(`Full Path: ${filePath}`)
        const [url] = await storage.bucket(bucketName).file(filePath).getSignedUrl(options);
        res.status(200).send({ signedUrl:url, videoId: videoId });
      } catch (error) {
        console.error('Error generating signed URL:', error);
        res.status(500).send('Error generating signed URL');
      }
})

uploadRouter.get("/generateSignedUrlRead", async (req, res) =>{
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    const  filename  = req.query.fileName;
    try {
        const options = {
          version: 'v4',
          action: 'read',
          expires: Date.now() + 30 * 60 * 1000, 
        };

        const user = await prisma.user.findFirst({
            where:{
                googleId: (req.user as User).googleId
            },
            select: {
                id: true
            }
        })

        const channel = await prisma.channel.findFirst({
            where:{
                userId: user?.id
            }
        })

        const video = await prisma.video.create({
            data: {
                title: filename as string,
                description: "",
                channelId: channel?.id as string,
            }
        })
        
        const new_filename = `${video.id}/filename`
        const [url] = await storage.bucket(bucketName).file(new_filename).getSignedUrl(options);

        res.status(200).send({ url, video: video.id });
      } catch (error) {
        console.error('Error generating signed URL:', error);
        res.status(500).send('Error generating signed URL');
      }
})

uploadRouter.post("/queueTranscoding", async (req, res) => {
    // console.log(req.file)
    
    try{
        const videoId = req.body.videoId;
        const  url = req.body.url;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
        
          const user = await prisma.user.findFirst({
            where:{
                googleId: (req.user as User).googleId
            },
            select: {
                id: true
            }
        })

        const video = await prisma.video.findFirst({
            where: {
                id: videoId as string
            }
        })

        const videoQueue = await prisma.videoQueue.create({
            data: {
                channelId: video?.channelId as string,
                videoId: videoId as string
            }
        })

        // const videoId = video.id;
        const jobId = videoQueue.id;
        let payload = {
            jobId: jobId,
            fieldname: 'videoFile',
            originalname: 'lake.mp4',
            encoding: '7bit',
            mimetype: 'video/mp4',
            destination: './uploads',
            filename: 'a75094e0-d685-49be-8f36-b84db1b45329.mp4',
            videoPath: url,
            size: 42992636,
            outputPath:  `./uploads/hls-videos/${videoId}`,
            videoId: videoId,
            retries: 0
        }
        console.log(video);
        console.log(payload)
        // await redisClient.set()
        await redisClient.lPush(redisConfig.queueName, JSON.stringify(payload))
        res.status(200).json({
            message: "File added to the processing queue",
            userId: user?.id,
            jobId: jobId
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
        // await redisClient.connect();
        // await redisSubscriber.connect();
        console.log("Connected to Redis");

    } catch (error) {
        console.error("Failed to connect to Redis", error);
    }
}

startServer();

export = uploadRouter;