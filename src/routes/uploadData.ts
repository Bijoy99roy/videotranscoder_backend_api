import express from "express";
import upload from "../middleware/uploadMiddleware";
import {createClient} from "redis";
import redisConfig from "../config";

const uploadRouter = express.Router();

const redisClient = createClient()

redisClient.on("error", (err) => {
    console.error("Redis client is not connected to the server: ", err)
});

redisClient.on("connect", () => {
    console.log("Redis client is connected to the server!!")
})

uploadRouter.post("/uploadfile", upload.single("videoFile"), async (req, res) => {
    console.log(req.file)
    
    try{
        await redisClient.rPush(redisConfig.queueName, JSON.stringify(req.file))
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
        console.log("Connected to Redis");

    } catch (error) {
        console.error("Failed to connect to Redis", error);
    }
}

startServer();

export = uploadRouter;