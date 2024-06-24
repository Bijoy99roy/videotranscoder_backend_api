import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import redisConfig from "../config/config";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../config/redis"
import { PrismaClient, User } from '@prisma/client'
const gcs = require('@google-cloud/storage');

const prisma = new PrismaClient()

const videosRouter = express.Router();

videosRouter.get("/details/:id", async (req, res)=>{

    const video = await prisma.video.findFirst({
        where:{
            id: req.params.id
        }
    })

    res.json(video);
});

videosRouter.get("/allVideos", async (req, res)=>{

    const video = await prisma.video.findMany({})

    res.json(video);
});

export = videosRouter;