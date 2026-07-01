import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to local bin folder
export const LOCAL_BIN_DIR = path.join(__dirname, 'bin');

/**
 * Checks if FFmpeg is installed globally or locally.
 * @returns {boolean} True if FFmpeg is available.
 */
export function checkFfmpeg() {
  // Check local bin directory first
  const localFfmpeg = path.join(LOCAL_BIN_DIR, 'ffmpeg.exe');
  if (fs.existsSync(localFfmpeg)) {
    return true;
  }

  // Check global PATH
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Returns the path to the local bin directory containing ffmpeg if present.
 * Otherwise returns null.
 * @returns {string|null}
 */
export function getLocalFfmpegDir() {
  const localFfmpeg = path.join(LOCAL_BIN_DIR, 'ffmpeg.exe');
  if (fs.existsSync(localFfmpeg)) {
    return LOCAL_BIN_DIR;
  }
  return null;
}

/**
 * Gets the default output directory for downloads.
 * Falls back to the user's home directory if Downloads isn't found.
 * Creates the 'SocialDownloads' subdirectory.
 * @returns {string} The default download directory path.
 */
export function getDefaultDownloadDir() {
  const homeDir = os.homedir();
  const downloadsDir = path.join(homeDir, 'Downloads');
  const targetDir = path.join(downloadsDir, 'SocialDownloads');

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  } catch (error) {
    return homeDir;
  }
}

/**
 * Normalizes and checks if a directory exists and is writeable.
 * @param {string} dirPath - The directory path to check.
 * @returns {boolean}
 */
export function isValidDirectory(dirPath) {
  if (!dirPath) return false;
  try {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      // Try to create it
      fs.mkdirSync(resolved, { recursive: true });
    }
    // Check if writeable
    fs.accessSync(resolved, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}
