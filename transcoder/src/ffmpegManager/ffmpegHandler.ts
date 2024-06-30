const { exec, execSync } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

export function formatTimestamp(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(6, '0')}`;
}

export async function takeScreenshot(inputVideo: string, percentage: number, outputImage: string, duration: number, height:number) {
    try {
        let command;
        const targetSeconds = (percentage / 100) * duration;
        const timestamp = formatTimestamp(targetSeconds);
        console.log(timestamp)
        if (height < 720){
             command = `ffmpeg -ss ${timestamp} -i "${inputVideo}" -vframes 1 -q:v 20 -vf scale=${height}:-1 -update 1 ${outputImage}`;
        } else {
             command = `ffmpeg -ss ${timestamp} -i "${inputVideo}" -vframes 1 -q:v 20 -vf scale=720:-1 -update 1 ${outputImage}`;
        }
        
        try {
            const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 }); // Increase buffer size if needed
            if (stderr) {
                // throw new Error(`Error: ${stderr}`);
                console.log(stderr)
            }
            console.log(`Screenshot saved to ${outputImage}`);
            // const metadata = JSON.parse(stdout);
            return true;
        } catch (error) {
            // throw new Error(`Failed to get video metadata: ${error}`);
            return false
        }
    } catch (error) {
        console.error('Error taking screenshot:', error);
        return false
    }
}


const inputVideo = "C:/Users/bijoy/Videos/Valorant/Valorant.mp4";
const outputImage = 'screenshot2.png';
const percentage = 2;  

export async function getVideoMetadata(url: string) {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${url}"`;
    
    try {
        const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });
        if (stderr) {
            throw new Error(`Error: ${stderr}`);
        }

        const metadata = JSON.parse(stdout);
        const videoMeta = metadata.streams[0];
        const meta = {
            "width": videoMeta.width,
            "height": videoMeta.height,
            "duration": videoMeta.duration,
            "size": metadata.format.size
        }
        console.log(meta)
        return meta
    } catch (error) {
        throw new Error(`Failed to get video metadata: ${error}`);
    }
}

// export function getVideoMetadata(filePath: string) {
//     const command = `ffprobe -v quiet -print_format json -show_format -show_streams ${filePath}`;
//     const output = execSync(command, { encoding: 'utf-8' });
//     const metadata = JSON.parse(output);
//     console.log(metadata)
//     const videoMeta = metadata.streams[0];
//     const meta = {
//         "width": videoMeta.width,
//         "height": videoMeta.height,
//         "duration": videoMeta.duration,
//         "size": metadata.format.size
//     }
//     console.log(meta)
//     return meta
// }

// getVideoMetadata(inputVideo)

