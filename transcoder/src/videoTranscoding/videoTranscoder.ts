import { exec } from "child_process";
import fs from "fs";
import util from "util";

const execPromise = util.promisify(exec);
const copyFilePromise = util.promisify(fs.copyFile);

const linkFilePath = './videoLinks.txt'

const storeLink = (videoLink: string) => {
    const newLinkLine = `${videoLink}\n`
    fs.appendFileSync(linkFilePath, newLinkLine, 'utf-8');
    console.log(`[INFO] video URL: ${videoLink} stored successfully`);
}

export async function transcodeVideos(ffmpegCommand: string, outputPath: string, videoId: string){
    try {
        const { stdout, stderr } = await execPromise(ffmpegCommand);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        await copyFilePromise('./playlist.m3u8', `${outputPath}/playlist.m3u8`);

        const videoUrl = `http://localhost:8000/uploads/hls-videos/${videoId}/playlist.m3u8`;

        try {
            storeLink(videoUrl);
        } catch (error) {
            console.error(`[ERROR] error while storing video URL: ${error}`);
            return false;
        }

        // res.json({"message": "File uploaded successfully.", videoUrl: videoUrl, videoId: videoId})
        return videoUrl;
    } catch (error) {
        console.error(`[ERROR] exec error: ${error}`);
        return false;
    }
    
}