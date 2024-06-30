import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import {gcsConfig, redisConfig} from "../config/config";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../config/redis"
import { PrismaClient, User } from '@prisma/client'
const gcs = require('@google-cloud/storage');

const prisma = new PrismaClient()

const videosRouter = express.Router();

const bucketName = gcsConfig.bucketName;
const storage = new gcs.Storage({ keyFilename: 'E:/Projects/gcs/analog-antler-425411-e6-b4766e9f647f.json' });

videosRouter.get("/details/:id", async (req, res)=>{

    const video = await prisma.video.findFirst({
        where:{
            id: req.params.id
        }
    })

    res.json(video);
});

videosRouter.get("/uploadedVideos/:userId", async (req, res)=>{

    const videos = await prisma.video.findMany({
        where:{
            channel: {
                userId: req.params.userId
            }
        },
        include: {
            likes: true
        }
    });

const videoIds = videos.map(video => video.id);

  const likesAggregate = await prisma.like.groupBy({
    by: ['videoId', 'type'],
    where: {
      videoId: { in: videoIds }
    },
    _count: {
      type: true
    }
  });

  const likeDislikeCounts = videoIds.reduce((acc:any, videoId) => {
    acc[videoId] = { likes: 0, dislikes: 0 };
    return acc;
  }, {});

  likesAggregate.forEach(item => {
    if (item.type === 'LIKE') {
      likeDislikeCounts[item.videoId].likes = item._count.type;
    } else if (item.type === 'DISLIKE') {
      likeDislikeCounts[item.videoId].dislikes = item._count.type;
    }
  });

  const videosWithCounts = videos.map(video => ({
    ...video,
    likeCount: likeDislikeCounts[video.id].likes,
    dislikeCount: likeDislikeCounts[video.id].dislikes
  }));


    res.json(videosWithCounts);
});

videosRouter.get("/allVideos", async (req, res)=>{

    const video = await prisma.video.findMany({})

    res.json(video);
});


videosRouter.post('/deleteFolder', async (req, res) => {
  const { videoId } = req.body;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId
    }
  })
  const prefix = video?.videoPath?.split("/")[0]
  console.log(prefix)
  try {
      const [files] = await storage.bucket(bucketName).getFiles({
          prefix: prefix,
      });

      if (files.length === 0) {
          return res.status(404).json({ message: 'No files found with the given prefix.' });
      }

      await storage.bucket(bucketName).deleteFiles({
          prefix: prefix,
      });

      await prisma.videoQueue.deleteMany({
        where: {
            videoId: videoId,
        },
    });


    const video = await prisma.video.delete({
        where: {
            id: videoId,
        },
    });

      res.json(video);
  } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ message: 'Error deleting folder' });
  }
});



export = videosRouter;