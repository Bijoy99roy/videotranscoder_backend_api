const { spawn } = require('child_process');
const axios = require('axios');
const gcs = require('@google-cloud/storage');
const fs = require('fs');
const { PassThrough } = require('stream');
require('dotenv').config()
import { PrismaClient } from '@prisma/client'
import { getVideoMetadata, takeScreenshot } from "../ffmpegManager/ffmpegHandler";

const prisma = new PrismaClient()

const bucketName = 'transcode-1';
console.log(process.env.GCS_KEYFILE)
const storage = new gcs.Storage({ keyFilename: process.env.GCS_KEYFILE ?? "" });

async function generateSignedUrlWrite(filename:any, contentType:any) {
    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000, // 30 minutes
      contentType: contentType,
    };
  
    const [url] = await storage.bucket(bucketName).file(filename).getSignedUrl(options);
    return url;
  }

  async function generateSignedUrlRead(filename:any) {
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 60 minutes
    };
  
    const [url] = await storage.bucket(bucketName).file(filename).getSignedUrl(options);
  
    return url;
  }

  async function uploadSegment(segmentStream:any, segmentName:any) {
    const signedUrl = await generateSignedUrlWrite(segmentName, 'video/MP2T');
    try {
      await new Promise((resolve, reject) => {
        const passthrough = new PassThrough();
        segmentStream.pipe(passthrough);
        passthrough.on('end', resolve);
        passthrough.on('error', reject);
  
        axios.put(signedUrl, passthrough, {
          headers: {
            'Content-Type': 'video/MP2T',
          },
        }).catch(reject);
      });
  

      return true;
    } catch (error) {
      console.error(`Error uploading segment ${segmentName} to ${signedUrl}:`, error);
      return false;
    }
  }

  async function transcodeAndUpload(video_config:any, videoId:any) {
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'verbose',
      '-i', `${video_config.url}`,
      '-vf', `scale=w=${video_config.width}:h=${video_config.height}:force_original_aspect_ratio=decrease`,
      '-c:a', 'aac',
      '-ar', '48000',
      '-c:v', 'h264',
      '-profile:v', 'main',
      '-crf', '20',
      '-sc_threshold', '0',
      '-g', '48',
      '-keyint_min', '48',
      '-hls_time', '5',
      '-b:v', `${video_config.video_bitrate}`,
      '-maxrate', `${video_config.maxrate}`,
      '-bufsize', `${video_config.bufsize}`,
      '-b:a', `${video_config.audio_bitrate}`,
      '-f', 'hls',
      'pipe:1',
    ];
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let segmentIndex = 0;
    let segmentData = Buffer.alloc(0);
    let segmentStream = new PassThrough();
    let segmentNames:any = [];
  
    ffmpeg.stdout.on('data', async (data:any) => {
      segmentData = Buffer.concat([segmentData, data]);
  
      if (data.includes('#EXTINF')) {
        segmentStream.write(segmentData);
        segmentStream.end();
        const segmentName = `${videoId}/${video_config.width}x${video_config.height}/segment_${segmentIndex}.ts`;
        segmentIndex++;
        await uploadSegment(segmentStream, segmentName);
        segmentNames.push(segmentName);
        segmentData = Buffer.alloc(0);
        segmentStream = new PassThrough();
      }
    });
  
    ffmpeg.stderr.on('data', (data:any) => {
      // console.error(`FFmpeg err: ${data}`);
    });
  
    return new Promise((resolve, reject) => {
      ffmpeg.on('close', (code:any) => {
        console.log(code)
        if (code === 0) {
          console.log(`Transcoding for ${video_config.width}x${video_config.height} completed.`);
          resolve(segmentNames);
        } else {
          reject(`FFmpeg process exited with code ${code}`);
        }
      });
    });
  }

export async function uploadHLSContentToGCS(videoId: string) {
  const video = await prisma.video.findFirst({
    where:{
      id: videoId
    }
  })
  const readSignedUrl = await generateSignedUrlRead(video?.videoPath)

  const metaData = await getVideoMetadata(readSignedUrl as string)
  const transcoding_config_list = [
    { width: 426, height: 240, video_bitrate: '400k', maxrate: '428k', bufsize: '600k', audio_bitrate: '64k', url: readSignedUrl },
    { width: 640, height: 360, video_bitrate: '800k', maxrate: '856k', bufsize: '1200k', audio_bitrate: '96k', url: readSignedUrl },
    { width: 842, height: 480, video_bitrate: '1400k', maxrate: '1498k', bufsize: '2100k', audio_bitrate: '128k', url: readSignedUrl },
    { width: 1280, height: 720, video_bitrate: '2800k', maxrate: '2996k', bufsize: '4200k', audio_bitrate: '128k', url: readSignedUrl },
    { width: 1920, height: 1080, video_bitrate: '5000k', maxrate: '5350k', bufsize: '7500k', audio_bitrate: '192k', url: readSignedUrl },
    
  ];

  const transcoding_config = transcoding_config_list.filter((config:any)=>{
    return config.height <= metaData.height
  });

  const transcodePromises = transcoding_config.map(video_config => transcodeAndUpload(video_config, videoId));
  const hasThumbnail:boolean = await takeScreenshot(readSignedUrl as string, 20, `${videoId}screenshot.png`, metaData.duration, metaData.height)
  // await convertImageToWebP("./screenshot.png", "./screenshot.webp")
  let thumbnailPath;
  if(hasThumbnail){
    thumbnailPath = await uploadThumbnail(`${videoId}/sample_thumbnail.png`, `./${videoId}screenshot.png`)
  }
  
  try {
    const allSegmentNames = await Promise.all(transcodePromises);
    console.log(`wprked`);
    const playlistPromises = allSegmentNames.map((segmentNames, index) => {
      const resolution = transcoding_config[index];
      const playlistContent = generateM3U8Playlist(segmentNames);
      const playlistFilePath = `./${videoId}_playlist_${resolution.width}x${resolution.height}.m3u8`;
      fs.writeFileSync(playlistFilePath, playlistContent);
      console.log(`Playlist file ${playlistFilePath} created.`);

      return uploadPlaylistToGCS(`${videoId}/${resolution.width}x${resolution.height}/${resolution.height}p.m3u8`, playlistFilePath);
    });

    await Promise.all(playlistPromises);

    const playlistContent = generateMasterPlaylist(videoId)
    const playlistFilePath = `./${videoId}playlist.m3u8`;
    fs.writeFileSync(playlistFilePath, playlistContent);
    console.log(`Playlist file ${playlistFilePath} created.`);
    const playlistPath = await uploadMasterPlaylist(`${videoId}/playlist.m3u8`, playlistFilePath)
    console.log('All playlists uploaded successfully.');
    return {playlistPath, thumbnailPath}
  } catch (error) {
    console.error('Error processing resolutions:', error);
    return false
  }
}

async function uploadThumbnail(destinationPath:string, localFilePath:any){
  const thumbnailSignedUrl = await generateSignedUrlWrite(destinationPath, 'image/png');

    try {
        await axios.put(thumbnailSignedUrl, fs.readFileSync(localFilePath), {
          headers: {
            'Content-Type': 'image/png',
          },
        });
        fs.unlinkSync(localFilePath);
        console.log(`Local thumbnail file ${localFilePath} deleted.`);
        return getGCSUrl(destinationPath)
      } catch (error) {
        console.error(`Error uploading thumbnail file to ${thumbnailSignedUrl}:`, error);
        throw error; 
      }
}

async function uploadMasterPlaylist(destinationPath:string, localFilePath:any){
    const playlistSignedUrl = await generateSignedUrlWrite(destinationPath, 'application/x-mpegURL');

    try {
        await axios.put(playlistSignedUrl, fs.readFileSync(localFilePath), {
          headers: {
            'Content-Type': 'application/x-mpegURL',
          },
        });
        fs.unlinkSync(localFilePath);
        console.log(`Local playlist file ${localFilePath} deleted.`);
        return getGCSUrl(destinationPath)
      } catch (error) {
        console.error(`Error uploading playlist file to ${playlistSignedUrl}:`, error);
        throw error; 
      }
}

function generateMasterPlaylist(videoId:any) {
    let playlistContent = `#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240\n${getGCSUrl(`${videoId}/426x240`)}/240p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n${getGCSUrl(`${videoId}/640x360`)}/360p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480\n${getGCSUrl(`${videoId}/842x480`)}/480p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\n${getGCSUrl(`${videoId}/1280x720`)}/720p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n${getGCSUrl(`${videoId}/1920x1080`)}/1080p.m3u8\n`;
    return playlistContent
}
async function uploadPlaylistToGCS(destinationPath:any, localFilePath:any) {
  const playlistSignedUrl = await generateSignedUrlWrite(destinationPath, 'application/x-mpegURL');
  try {
    await axios.put(playlistSignedUrl, fs.readFileSync(localFilePath), {
      headers: {
        'Content-Type': 'application/x-mpegURL',
      },
    });
    fs.unlinkSync(localFilePath);
    console.log(`Local playlist file ${localFilePath} deleted.`);
  } catch (error) {
    console.error(`Error uploading playlist file to ${playlistSignedUrl}:`, error);
    throw error; 
  }
}
function getGCSUrl(segmentName:any) {
    return `https://storage.googleapis.com/${bucketName}/${segmentName}`;
  }
function generateM3U8Playlist(segmentNames:any) {
  let playlistContent = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXT-X-MEDIA-SEQUENCE:0\n`;

  segmentNames.forEach((segmentName:any, index:any) => {
    const duration =  5; 
    playlistContent += `#EXTINF:${duration.toFixed(6)},\n${getGCSUrl(segmentName)}\n`;
  });

  playlistContent += `#EXT-X-ENDLIST`;

  return playlistContent;
}

