import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import {gcsConfig, redisConfig} from "../config/config";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../redis/redis"
import { PrismaClient, User } from '@prisma/client'
import { limitViewCount } from "../viewsHandler/views";
import { channelIdSchema, createChannelSchema, existsChannel, subscribedChannelsSchema, subscribeStatusSchema, subscribeUnsubscribeSchema } from "../schemas/channelSchema/schema";
const gcs = require('@google-cloud/storage');

const prisma = new PrismaClient()

const channelRouter = express.Router();

channelRouter.post("/create-channel", async (req, res)=>{
    try{

    
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

    const  payload  = req.body;
    const { success } = createChannelSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const { channelName, userId } = req.body;

    const channel = await prisma.channel.create({
        data: {
            userId: userId,
            channelName: channelName
        }
    })

    res.status(201).json({
        message: `Channel ${channel.channelName} created successfully`
    })
    } catch (error) {
        res.status(500).json({
            error: "Failed to create channel"
        });
    }
})

channelRouter.get("/:userId/channel-exists", async (req, res)=>{
    try{

    
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

    const  payload  = req.params;

    const { success } = existsChannel.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const { userId } = req.params;

    const channel = await prisma.channel.findUnique({
        where: {
            userId: userId,
        }
    })
    if (!channel)
    {
        res.status(200).json({
            channelExists: false
        })
    } else {
        res.status(200).json({
            channelExists: true
        })
    }
    } catch (error) {
        res.status(500).json({
            error: "Failed to retrieve channel existing status"
        });
    }
    
})

channelRouter.post('/subscribe-unsubscribe', async (req, res) => {
    
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

    const  payload  = req.body;

    const { success } = subscribeUnsubscribeSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const { userId, channelId } = req.body;

    try {

        const existingSubscription = await prisma.subscription.findUnique({
            where: {
                userId_channelId: {
                    userId: userId,
                    channelId: channelId,
                },
            },
        });

        if (!existingSubscription) {

            await prisma.subscription.create({
                data: {
                    userId: userId,
                    channelId: channelId,
                },
            });
        } else {
            await prisma.subscription.delete({
                where: {
                    userId_channelId: {
                        userId: userId,
                        channelId: channelId,
                    },
                },
            });
        }
        // const subscriberCount = await prisma.subscription.count({
        //     where: { channelId: channelId },
        // });

        res.status(201).json({ message: `User has successfully subscribed to channel: ${channelId}` });
    } catch (error) {

        res.status(500).json({ error: 'Failed to subscribe to channel' });
    }
});

channelRouter.get('/:channelId/subscriber-count', async (req, res) => {

    const {  channelId } = req.params;

    try {
        const subscriberCount = await prisma.subscription.count({
            where: {
                    channelId: channelId,      
            },
        });

        res.status(201).json({ channelId, subscriberCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get subscriber count of channel' });
    }
});




channelRouter.get('/subscribe-status', async (req, res) => {

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

    const  payload  = req.body;

    const { success } = subscribeStatusSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const { userId, channelId } = req.query;

    try {
        const subscribeStatus = await prisma.subscription.findUnique({
            where: {
                userId_channelId: {
                    userId: userId as string,
                    channelId: channelId as string,
                },
            },
        });


        res.status(200).json({
            channelId,
            subscribeStatus: subscribeStatus ? true : false
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subscriber status' });
    }
});

channelRouter.get("/channelVideos/:channelId", async (req, res)=>{
    try{

    
    const  payload  = req.params;

    const { success } = channelIdSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }

    const channelId = payload.channelId
    const videos = await prisma.channel.findMany({
        where:{
            id: channelId,
        },
        include: {
            user: true,
            videos: {
                where:{
                    published: true
                }
            }
        }
    });

    const subscriberCount = await prisma.subscription.count({
        where: {
                channelId: channelId,      
        },
    });


    res.json(videos);
    } catch (error) {
    res.status(500).json({
        error: "Failed to retrieve channel videos"
    });
}
});

channelRouter.get("/subscriptions/:userId", async (req, res) => {
    try{

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

    const  payload  = req.params;

    const { success } = subscribedChannelsSchema.safeParse(payload)
    
    if (!success) {
        return res.status(411).json({
            message: "Invalid inputs"
        });
    }
    const { userId } = payload;

    const subscribedChannels = await prisma.channel.findMany({
        where: {
          subscribers: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
            subscribers:{
                select:{
                    id: true
                }
            },
            _count: {
              select: {
                subscribers: true,
                videos: true,
              },
            },
          },
      });

      res.json(subscribedChannels)
    } catch (error) {
        res.status(500).json({
            error: "Failed to retrieve subscribed channels"
        });
    }
});


export = channelRouter;