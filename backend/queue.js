import { spawn } from 'child_process';
import path from 'path';
import { getLocalFfmpegDir } from './utils.js';

export class DownloadQueue {
  constructor(onUpdateCallback) {
    this.tasks = [];
    this.concurrency = 2;
    this.onUpdate = onUpdateCallback || (() => {});
    this.ffmpegAvailable = false;
  }

  setFfmpegAvailable(available) {
    this.ffmpegAvailable = available;
  }

  setConcurrency(limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      this.concurrency = parsed;
      this.processNext();
    }
  }

  getTasks() {
    // Return tasks without the process object (which is circular and complex)
    return this.tasks.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      thumbnail: t.thumbnail,
      duration: t.duration,
      platform: t.platform,
      formatId: t.formatId,
      outputDir: t.outputDir,
      status: t.status,
      progress: t.progress,
      speed: t.speed,
      eta: t.eta,
      error: t.error,
      fileName: t.fileName
    }));
  }

  enqueue(url, metadata, formatId, outputDir) {
    const task = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      url: url,
      title: metadata.title || 'Unknown Video',
      thumbnail: metadata.thumbnail || '',
      duration: metadata.duration || 0,
      platform: metadata.platform || 'Unknown',
      formatId: formatId || 'best',
      outputDir: outputDir,
      status: 'queued',
      progress: 0,
      speed: '0 B/s',
      eta: '--:--',
      error: null,
      fileName: null,
      process: null
    };

    this.tasks.push(task);
    this.notify();
    this.processNext();
    return task.id;
  }

  cancelTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;

    if (task.status === 'downloading' && task.process) {
      task.status = 'cancelled';
      task.speed = '0 B/s';
      task.eta = '--:--';
      
      // Kill the process tree on Windows using taskkill
      try {
        spawn('taskkill', ['/pid', task.process.pid, '/f', '/t']);
      } catch (e) {
        try {
          task.process.kill();
        } catch (err) {
          // ignore
        }
      }
    } else if (task.status === 'queued') {
      task.status = 'cancelled';
    }
    
    this.notify();
    this.processNext();
    return true;
  }

  removeTask(taskId) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    const task = this.tasks[index];
    // If running, cancel it first
    if (task.status === 'downloading') {
      this.cancelTask(taskId);
    }

    this.tasks.splice(index, 1);
    this.notify();
    return true;
  }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled');
    this.notify();
  }

  notify() {
    this.onUpdate();
  }

  processNext() {
    const activeCount = this.tasks.filter(t => t.status === 'downloading').length;
    if (activeCount >= this.concurrency) {
      return;
    }

    const nextTask = this.tasks.find(t => t.status === 'queued');
    if (!nextTask) {
      return;
    }

    this.startDownload(nextTask);
    // Try to run more if concurrency limit allows
    this.processNext();
  }

  startDownload(task) {
    task.status = 'downloading';
    task.progress = 0;
    task.error = null;
    this.notify();

    // Build arguments for yt-dlp
    const args = [
      '-m', 'yt_dlp',
      '--newline',
      '--progress',
      '--no-playlist'
    ];

    // If local FFmpeg is installed, specify its path for yt-dlp
    const localFfmpegDir = getLocalFfmpegDir();
    if (localFfmpegDir) {
      args.push('--ffmpeg-location', localFfmpegDir);
    }

    // Determine output file template
    const outputTemplate = path.join(task.outputDir, '%(title)s.%(ext)s');
    args.push('-o', outputTemplate);

    // Format selection
    // Safe fallback configuration when FFmpeg is not available
    if (task.formatId === 'audioonly') {
      if (this.ffmpegAvailable) {
        args.push('-x', '--audio-format', 'mp3');
      } else {
        // Native audio format (usually m4a or webm), no transcoding
        args.push('-f', 'ba/b');
      }
    } else if (task.formatId === 'videoonly') {
      args.push('-f', 'bv*');
    } else {
      // 'best' quality (video + audio merged if possible, otherwise best single-file)
      if (this.ffmpegAvailable) {
        args.push('-f', 'bv*+ba/b');
      } else {
        // Without ffmpeg, we MUST download a format that contains BOTH video and audio
        // yt-dlp flag 'b' stands for best pre-merged format.
        args.push('-f', 'b');
      }
    }

    // Safe argument positioning to prevent options injection via URLs
    args.push('--', task.url);

    // Spawn Python running yt-dlp
    const child = spawn('python', args);
    task.process = child;

    let errorBuffer = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Parse progress: e.g., "[download]  10.5% of ~15.20MiB at  2.12MiB/s ETA 00:06"
      // or "[download]   1.2% of 4.50MiB at 800.00KiB/s ETA 00:05"
      const progressRegex = /\[download\]\s+([0-9.]+)%\s+of\s+(?:\S+|~\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/i;
      const match = output.match(progressRegex);

      if (match) {
        const percent = parseFloat(match[1]);
        const speed = match[2];
        const eta = match[3];

        if (!isNaN(percent)) {
          task.progress = percent;
          task.speed = speed;
          task.eta = eta;
          this.notify();
        }
      }

      // Parse file destination filename
      // e.g. "[download] Destination: C:\Users\sodavid.sin\Downloads\SocialDownloads\video.mp4"
      const destRegex = /\[download\]\s+Destination:\s+(.+)/i;
      const destMatch = output.match(destRegex);
      if (destMatch) {
        task.fileName = path.basename(destMatch[1].trim());
        this.notify();
      }
    });

    child.stderr.on('data', (data) => {
      errorBuffer += data.toString();
    });

    child.on('close', (code) => {
      task.process = null;
      if (task.status === 'cancelled') {
        // Was already set to cancelled
        return;
      }

      if (code === 0) {
        task.status = 'completed';
        task.progress = 100;
        task.speed = '0 B/s';
        task.eta = '00:00';
      } else {
        task.status = 'failed';
        // Extract clean error message
        let errMsg = 'Download failed.';
        if (errorBuffer.includes('ERROR:')) {
          const lines = errorBuffer.split('\n');
          const errorLine = lines.find(l => l.includes('ERROR:'));
          if (errorLine) {
            errMsg = errorLine.replace('ERROR:', '').trim();
          }
        } else if (errorBuffer.trim()) {
          errMsg = errorBuffer.trim().split('\n')[0];
        }
        task.error = errMsg;
        task.speed = '0 B/s';
        task.eta = '--:--';
      }

      this.notify();
      this.processNext();
    });

    child.on('error', (err) => {
      task.process = null;
      task.status = 'failed';
      task.error = err.message || 'Failed to start download process';
      task.speed = '0 B/s';
      task.eta = '--:--';
      this.notify();
      this.processNext();
    });
  }
}
