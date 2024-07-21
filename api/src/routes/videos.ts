import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import {gcsConfig, redisConfig} from "../config/config";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../redis/redis"
import { PrismaClient, User } from '@prisma/client'
import { limitViewCount } from "../viewsHandler/views";
import { addViewSchema, deleteFolderSchema, likedVideoSchema, likeStatusSchema, likeVideoSchema, uploadedVideosSchema, videoDetailsSchema } from "../schemas/videosSchema/schema";

const gcs = require('@google-cloud/storage');

const prisma = new PrismaClient()

const videosRouter = express.Router();

const bucketName = gcsConfig.bucketName;
const storage = new gcs.Storage({ keyFilename: 'E:/Projects/gcs/analog-antler-425411-e6-b4766e9f647f.json' });

videosRouter.get("/details/:videoId", async (req, res)=>{
    try{

    const  payload  = req.params;

    const { success } = videoDetailsSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const videoId = payload.videoId
    const video = await prisma.video.findFirst({
        where:{
            id: req.params.videoId
        },
        include:{
            channel:{
                include: {
                    user: {
                        select: {
                            id: true
                        }
                    }
                }
            },
            videoQueue: {
                select:{
                    status: true
                }
            }
        }
    })
    const likeCount = await prisma.like.count({
      where: { videoId: videoId, type: 'LIKE' },
  });

  const dislikeCount = await prisma.like.count({
      where: { videoId: videoId, type: 'DISLIKE' },
  });
  const videosWithCounts = {
    ...video,
    likeCount: likeCount,
    dislikeCount: dislikeCount

  }
    res.json(videosWithCounts);
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch video details"
        });
    }
});

videosRouter.get("/uploadedVideos/:userId", async (req, res)=>{
    try{

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    const  payload  = req.params;

    const { success } = uploadedVideosSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }

    const userId = payload.userId
    const videos = await prisma.video.findMany({
        where:{
            channel: {
                userId: userId
            }
        },
        include: {
            likes: true,
            videoQueue: {
                select:{
                    status: true
                }
            }
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

    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch uploaded videos for user"
        });
    }
});



videosRouter.get("/allVideos", async (req, res)=>{
    try{
    const video = await prisma.video.findMany({include:{
        channel:true
    }})

    res.json(video);
    } catch (error) {
        res.status(500).json({
            error: "Failed to retrieve all videos"
        });
    }
});

videosRouter.get("/published-videos", async (req, res)=>{
    try{
    const video = await prisma.video.findMany({
        where:{
            published: true
        },
        include:{
        channel:true
    }})

    res.json(video);
} catch (error) {
    res.status(500).json({
        error: "Error while fetching published videos"
    });
}
});


videosRouter.post('/deleteFolder', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const  payload  = req.body;

        const { success } = deleteFolderSchema.safeParse(payload)
        
        if (!success) {
            return res.status(411).json({
                message: "Invalid inputs"
            });
        }
    const { videoId } = req.body;

    const videoData = await prisma.video.findFirst({
        where: {
        id: videoId
        }
    })
    const videoQueue = await prisma.videoQueue.findFirst({
        where:{
            videoId: videoId
        }
    })
    if (videoQueue) {
        const prefix = videoData?.videoPath?.split("/")[0]
        
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
    }
    


    const video = await prisma.video.delete({
        where: {
            id: videoId,
        },
    });

        res.json(video);
  } catch (error) {
      res.status(500).json({ message: 'Error deleting folder' });
  }
});

videosRouter.post("/addView", async (req, res) => {
    try{

    const  payload  = req.body;

    const { success } = addViewSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    
    const {videoId, userId} = payload;
    let ip = req.ip as string;

    if (ip === '::1' || ip === '127.0.0.1') {
        ip =  'localhost';
    }
    await limitViewCount(userId, videoId, ip)

    res.json({
        message: "View updated"
  })
    } catch (error) {
        res.status(500).json({ message: 'Error occured while counting views' });
    }
})

videosRouter.post('/like', async (req, res) => {

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    const  payload  = req.body;

    const { success } = likeVideoSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
  const { userId, type, videoId } = req.body;

  try {
      const existingLike = await prisma.like.findUnique({
        where: {
            userId_videoId: {
                userId: userId,
                videoId: videoId,
            },
        },
    });

    const videoDetails = await prisma.video.findUnique({
            where: {
                    id: videoId,
            },
        });

    if (existingLike) {

        if (existingLike.type === type) {
            await prisma.like.delete({
                where: {
                    id: existingLike.id,
                },
            });
        } else {

            await prisma.like.update({
                where: {
                    id: existingLike.id,
                },
                data: { type: type },
            });
        }
    } else {

        await prisma.like.create({
            data: {
                userId: userId,
                videoId: videoId,
                type: type,
            },
        });
    }


    const likeCount = await prisma.like.count({
        where: { videoId: videoId, type: 'LIKE' },
    });

    const dislikeCount = await prisma.like.count({
        where: { videoId: videoId, type: 'DISLIKE' },
    });

    
    res.status(200).json({ videoId, likeCount, dislikeCount });
  } catch (error) {
      res.status(500).json({ error: 'Failed to like/dislike video' });
  }
});

videosRouter.post('/like-status', async (req, res) => {
    try {
    const  payload  = req.body;

    const { success } = likeStatusSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }

    const { userId, videoId } = req.body;

  
      const likeStatus = await prisma.like.findUnique({
          where: {
              userId_videoId: {
                  userId: userId as string,
                  videoId: videoId,
              },
          },
      });

      const likeCount = await prisma.like.count({
          where: { videoId: videoId, type: 'LIKE' },
      });

      const dislikeCount = await prisma.like.count({
          where: { videoId: videoId, type: 'DISLIKE' },
      });

      res.status(200).json({
          videoId,
          likeStatus: likeStatus ? likeStatus.type : null,
          likeCount,
          dislikeCount,
      });
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch like status' });
  }
});

videosRouter.get("/liked-viodeos/:userId", async (req, res)=>{
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = req.params
      const { success } = likedVideoSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
      const { userId } = payload
    const likedVideos = await prisma.video.findMany({
        where: {
          likes: {
            some: {
              userId: userId,
              type: 'LIKE',  
            },
          },
        },
        include: {
          likes: true, 
          channel: true, 
        },
      });

      res.json(likedVideos);
})



export = videosRouter;