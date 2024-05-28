import { redisConfig, MAX_RETRIES } from "./config";
import { generateTranscodingCommand } from "./ffmpegManager/ffmpeg";
import { initializeRedis } from "./queueManager/redis";
import { transcodeVideos } from "./videoTranscoding/videoTranscoder";
import fs from "fs";

const redisClient = initializeRedis()
async function startWorker(){
    try{
        await redisClient?.connect()
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
                    } else {
                        if(!fs.existsSync(outputPath)){
                            fs.mkdirSync(outputPath, {recursive: true});
                        }
                        const ffmpegCommand = generateTranscodingCommand(videoPath, outputPath)
                        const isCompleted = await transcodeVideos(ffmpegCommand, outputPath, videoId)
                        if (isCompleted) {
                            console.log(`Video with id: ${videoId} is transcribed`)
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