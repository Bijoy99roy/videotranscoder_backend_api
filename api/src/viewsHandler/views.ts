import { PrismaClient } from "@prisma/client";
import { redisClient } from "../redis/redis";
import { broadcastViews } from "../sockets/wsHandler";

const prisma = new PrismaClient()

async function batchUpdateViews() {
    try {
      const keys = await redisClient.keys('video:*:views');
      const videoViews: { videoId: string; views: number }[] = [];
  
      for (const key of keys) {
        const videoId = key.split(':')[1]
  
        let success = false;
        while (!success) {
          try {
            await redisClient.watch(key); 
  
            const views = parseInt(await redisClient.get(key) || '0', 10);
            const pipeline = redisClient.multi(); 
            pipeline.set(key, '0'); 
  
            const results = await pipeline.exec();
            
            if (results) {
              videoViews.push({ videoId, views });
              success = true;
            } else {

              continue;
            }
          } catch (err) {
            console.error('Error during pipeline execution:', err);
          }
        }
      }
  
      for (const { videoId, views } of videoViews) {
        const videoExists = await prisma.video.findUnique({
          where: { id: videoId },
      });
      if (videoExists){
        const viewsCount = await prisma.video.update({
          where: { id: videoId },
          data: { views: { increment: views } },
          select: {
            views: true,
            id: true
          }
        });
        broadcastViews(videoId, viewsCount.views)
      } else {
        console.warn(`Video with ID ${videoId} not found.`);
    }
        
      }
    } catch (error) {
      console.error('Error updating views:', error);
    }
  }

export async function limitViewCount(userId: string, videoId: string, ip:string) {
  if (!userId) {
    userId = ip;
  }
    const keyname = `${userId}:${videoId}:daily-limit`;
    
    try {

        const current = await redisClient.get(keyname);

        if (current) {
            console.log(`view already counted for ${videoId}:${userId}`)
        } else {
            // 86400 seconds == 24 hours
            await redisClient.set(keyname, '1', { EX: 86400 });
            await incrementView(videoId)
        }
    } catch (error) {
        console.log("An error has occured while setting key for view")
    }
}

async function incrementView(videoId: string) {
    await redisClient.incr(`video:${videoId}:views`);
}

const intervalId = setInterval(batchUpdateViews, 1 * 60 * 1000);

// Ref: https://nodejs.org/api/process.html for below if forget.
process.on('SIGINT', () => {
  clearInterval(intervalId);
  process.exit();
});

process.on('SIGTERM', () => {
  clearInterval(intervalId);
  process.exit();
});