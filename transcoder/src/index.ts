import { redisConfig, MAX_RETRIES } from "./config";
import { generateTranscodingCommand } from "./ffmpegManager/ffmpeg";
import { initializeRedis } from "./queueManager/redis";
import { transcodeVideos } from "./videoTranscoding/videoTranscoder";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const redisClient = initializeRedis()
const redisPublisher = initializeRedis()
const prisma = new PrismaClient()

async function startWorker(){
    try{
        await redisClient?.connect()
        await redisPublisher?.connect()
        console.log("Worker connected to Redis.");
        while (true) {
            try {
                const submission: any = await redisClient?.brPop(redisConfig.processingQueueName, 0);
                console.log(submission)
                if (submission){
                    const { videoPath, outputPath, videoId, retries } = JSON.parse(submission?.element)
                    if (retries > MAX_RETRIES){
                        await redisClient?.rPush(redisConfig.fallbackQueueName, submission?.element)
                        console.log(`MAX RETRY EXCEEDED: For videoId ${videoId}. Pushed to ${redisConfig.fallbackQueueName} queue.`)
                        const video = await prisma.video.findFirst({
                            where: {
                                id: videoId
                            }
                        })
                        await prisma.videoQueue.update({
                            where: {
                                videoId: video?.id
                            },
                            data: {
                                status: "FAILED"
                            }
                        })
                    } else {
                        if(!fs.existsSync(outputPath)){
                            fs.mkdirSync(outputPath, {recursive: true});
                        }
                        const ffmpegCommand = generateTranscodingCommand(videoPath, outputPath)
                        const video = await prisma.video.findFirst({
                            where: {
                                id: videoId
                            }
                        })
                        await prisma.videoQueue.update({
                            where: {
                                videoId: video?.id
                            },
                            data: {
                                status: "IN_PROCESS"
                            }
                        })
                        const videoUrl = await transcodeVideos(ffmpegCommand, outputPath, videoId)
                        
                        if (videoUrl) {
                            console.log(`Video with id: ${videoId} is transcribed`)
                            const video = await prisma.video.update({
                                where: {
                                    id: videoId
                                },
                                data: {
                                    playlistPath: videoUrl
                                }
                            })
                            await prisma.videoQueue.update({
                                where: {
                                    videoId: video.id
                                },
                                data: {
                                    status: "PROCESSED",
                                    playlistPath: videoUrl
                                }
                            })
                            redisPublisher?.publish('transcode_complete', `Video ID: ${videoId} processing complete`);
                            
                        } else {
                            console.error(`Video with id: ${videoId} failed to transcribe`)
                            fs.rmdirSync(outputPath)
                            console.error(`Deleted folder: ${outputPath}`)
                            const payload =  JSON.parse(submission?.element)
                            payload.retries += 1
                            await redisClient?.rPush(redisConfig.processingQueueName, JSON.stringify(payload))
                            console.error(`Pushed the videoId: ${videoId} to ${redisConfig.processingQueueName} for retry.`)

                        }
                    }
                    
                }
                
            } catch (error) {
                console.error("Error processing submission:", error);
                // Implement your error handling logic here. For example, you might want to push
                // the submission back onto the queue or log the error to a file.
            }
        }
        
    } catch(error) {
        console.error("Failed to connect to Redis", error);
    }
}

startWorker()