import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { checkFfmpeg, getDefaultDownloadDir, isValidDirectory } from './utils.js';
import { DownloadQueue } from './queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Persistent Settings File
const settingsFilePath = path.join(__dirname, 'settings.json');
let settings = {
  outputDir: getDefaultDownloadDir(),
  concurrency: 2,
};

// Load settings from disk if available
if (fs.existsSync(settingsFilePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    if (data.outputDir && isValidDirectory(data.outputDir)) {
      settings.outputDir = data.outputDir;
    }
    if (data.concurrency) {
      settings.concurrency = parseInt(data.concurrency, 10) || 2;
    }
  } catch (error) {
    console.error('Error loading settings, using defaults:', error);
  }
}

// SSE Clients Registry
let sseClients = [];

// Broadcast task updates to all SSE clients
const broadcastUpdate = () => {
  const data = JSON.stringify({ type: 'tasks', tasks: queue.getTasks() });
  sseClients.forEach((client) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      // client connection might be broken
    }
  });
};

// Initialize download queue
const queue = new DownloadQueue(broadcastUpdate);
const ffmpegAvailable = checkFfmpeg();
queue.setFfmpegAvailable(ffmpegAvailable);
queue.setConcurrency(settings.concurrency);

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// SSE Connection Endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial data
  const initialData = JSON.stringify({ type: 'tasks', tasks: queue.getTasks() });
  res.write(`data: ${initialData}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

// App / System Status check
app.get('/api/status', (req, res) => {
  res.json({
    ffmpegAvailable: checkFfmpeg(),
    defaultDir: getDefaultDownloadDir(),
  });
});

// Settings Endpoints
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const { outputDir, concurrency } = req.body;

  if (outputDir) {
    if (!isValidDirectory(outputDir)) {
      return res.status(400).json({ error: 'Invalid or unwritable directory path.' });
    }
    settings.outputDir = path.resolve(outputDir);
  }

  if (concurrency) {
    const val = parseInt(concurrency, 10);
    if (!isNaN(val) && val > 0) {
      settings.concurrency = val;
      queue.setConcurrency(val);
    }
  }

  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings to disk.' });
  }
});

// Helper: Parse a single URL using yt-dlp -J
const parseUrlMetadata = (url) => {
  return new Promise((resolve) => {
    const args = [
      '-m', 'yt_dlp',
      url,
      '-J',
      '--no-playlist',
      '--flat-playlist'
    ];

    const child = spawn('python', args);
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        let errorMsg = 'Failed to extract video metadata.';
        if (stderrBuffer.includes('ERROR:')) {
          const lines = stderrBuffer.split('\n');
          const errorLine = lines.find(l => l.includes('ERROR:'));
          if (errorLine) {
            errorMsg = errorLine.replace('ERROR:', '').trim();
          }
        }
        resolve({
          url,
          success: false,
          error: errorMsg
        });
        return;
      }

      try {
        const info = JSON.parse(stdoutBuffer);
        resolve({
          url,
          success: true,
          title: info.title || 'Untitled Video',
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
          duration: info.duration || 0,
          platform: info.extractor_key || info.extractor || 'Unknown',
        });
      } catch (err) {
        resolve({
          url,
          success: false,
          error: 'Failed to parse metadata response.'
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        url,
        success: false,
        error: err.message || 'Failed to start parsing process.'
      });
    });
  });
};

// Link Parsing Endpoint (Bulk parsing support)
app.post('/api/parse', async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required.' });
  }

  // Parse up to 5 URLs in parallel to be nice on CPU and avoid IP bans
  const results = [];
  const chunkSize = 5;
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(url => parseUrlMetadata(url.trim()));
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  res.json({ results });
});

// Enqueue downloads endpoint
app.post('/api/enqueue', (req, res) => {
  const { items } = req.body; // Array of { url, metadata, formatId }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  const enqueuedIds = [];
  items.forEach((item) => {
    const id = queue.enqueue(
      item.url,
      item.metadata,
      item.formatId,
      settings.outputDir
    );
    enqueuedIds.push(id);
  });

  res.json({ success: true, count: enqueuedIds.length, ids: enqueuedIds });
});

// Cancel a download
app.post('/api/downloads/cancel', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Task ID is required.' });
  }

  const success = queue.cancelTask(id);
  res.json({ success });
});

// Remove a download (removes from list, cancels if running)
app.post('/api/downloads/remove', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Array of Task IDs is required.' });
  }

  let count = 0;
  ids.forEach((id) => {
    if (queue.removeTask(id)) {
      count++;
    }
  });

  res.json({ success: true, count });
});

// Clear completed, failed, and cancelled downloads
app.post('/api/downloads/clear', (req, res) => {
  queue.clearCompleted();
  res.json({ success: true });
});

let ffmpegInstallState = { status: 'idle', progress: 0, details: '' };

app.post('/api/ffmpeg/install', (req, res) => {
  if (ffmpegInstallState.status === 'installing') {
    return res.status(400).json({ error: 'FFmpeg installation is already in progress.' });
  }

  ffmpegInstallState = { status: 'installing', progress: 0, details: 'Starting installer...' };
  
  const broadcastInstallUpdate = () => {
    const data = JSON.stringify({ type: 'ffmpeg-install', ...ffmpegInstallState });
    sseClients.forEach(client => {
      try { client.write(`data: ${data}\n\n`); } catch(e) {}
    });
  };
  
  broadcastInstallUpdate();

  const installerPath = path.join(__dirname, 'download-ffmpeg.js');
  const child = spawn('node', [installerPath]);

  child.stdout.on('data', (data) => {
    const output = data.toString();
    const match = output.match(/\[FFMPEG-INSTALL\]\s+STAGE:(\w+)\s+PERCENT:([0-9.]+)\s+DETAILS:(.+)/);
    if (match) {
      const stage = match[1];
      const percent = parseFloat(match[2]);
      const details = match[3].trim();

      ffmpegInstallState.progress = percent;
      ffmpegInstallState.details = `${stage === 'download' ? 'Downloading' : stage === 'extract' ? 'Extracting' : 'Processing'}: ${details}`;
      broadcastInstallUpdate();
    }
  });

  child.stderr.on('data', (data) => {
    console.error('FFmpeg Installer Error:', data.toString());
  });

  child.on('close', (code) => {
    if (code === 0) {
      ffmpegInstallState = { status: 'complete', progress: 100, details: 'FFmpeg installed successfully!' };
      queue.setFfmpegAvailable(true);
    } else {
      ffmpegInstallState = { status: 'failed', progress: 0, details: 'FFmpeg installation failed.' };
    }
    broadcastInstallUpdate();
  });

  res.json({ success: true, message: 'FFmpeg installation started.' });
});

app.get('/api/ffmpeg/status', (req, res) => {
  res.json({
    installed: checkFfmpeg(),
    installState: ffmpegInstallState
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
