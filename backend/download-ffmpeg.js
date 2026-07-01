import https from 'https';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.join(__dirname, 'bin');
const FFMPEG_ZIP = path.join(BIN_DIR, 'ffmpeg.zip');
const FFPROBE_ZIP = path.join(BIN_DIR, 'ffprobe.zip');

const FFMPEG_URL = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip';
const FFPROBE_URL = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-win-64.zip';

// Helper to log progress to stdout so the parent server can parse it
function logProgress(stage, percent, details = '') {
  console.log(`[FFMPEG-INSTALL] STAGE:${stage} PERCENT:${percent.toFixed(1)} DETAILS:${details}`);
}

async function downloadFile(url, destPath, name) {
  return new Promise((resolve, reject) => {
    logProgress('download', 0, `Starting download of ${name}...`);

    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        downloadFile(response.headers.location, destPath, name).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = (downloadedSize / totalSize) * 100;
          logProgress('download', percent, `Downloading ${name}: ${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
        }
      });

      fileStream.on('finish', () => {
        fileStream.close();
        logProgress('download', 100, `Finished downloading ${name}`);
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function unzipFile(zipPath, destDir, name) {
  return new Promise((resolve, reject) => {
    logProgress('extract', 0, `Extracting ${name}...`);
    
    // Use PowerShell's built-in Expand-Archive on Windows
    const cmd = 'powershell';
    const args = [
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`
    ];

    const child = spawn(cmd, args);
    
    child.on('close', (code) => {
      if (code === 0) {
        logProgress('extract', 100, `Extracted ${name} successfully.`);
        resolve();
      } else {
        reject(new Error(`Extraction failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  try {
    // Create bin directory if it doesn't exist
    if (!fs.existsSync(BIN_DIR)) {
      fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    // Step 1: Download FFmpeg
    await downloadFile(FFMPEG_URL, FFMPEG_ZIP, 'ffmpeg');

    // Step 2: Download FFprobe
    await downloadFile(FFPROBE_URL, FFPROBE_ZIP, 'ffprobe');

    // Step 3: Extract FFmpeg
    await unzipFile(FFMPEG_ZIP, BIN_DIR, 'ffmpeg');

    // Step 4: Extract FFprobe
    await unzipFile(FFPROBE_ZIP, BIN_DIR, 'ffprobe');

    // Step 5: Cleanup zip files
    logProgress('cleanup', 50, 'Cleaning up temporary files...');
    if (fs.existsSync(FFMPEG_ZIP)) fs.unlinkSync(FFMPEG_ZIP);
    if (fs.existsSync(FFPROBE_ZIP)) fs.unlinkSync(FFPROBE_ZIP);

    logProgress('complete', 100, 'FFmpeg installation complete!');
    process.exit(0);
  } catch (error) {
    console.error(`\n[FFMPEG-INSTALL] ERROR: ${error.message}`);
    // Cleanup on error
    if (fs.existsSync(FFMPEG_ZIP)) fs.unlinkSync(FFMPEG_ZIP);
    if (fs.existsSync(FFPROBE_ZIP)) fs.unlinkSync(FFPROBE_ZIP);
    process.exit(1);
  }
}

run();
