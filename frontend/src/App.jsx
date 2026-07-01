import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import LinkInput from './components/LinkInput.jsx';
import ParseResults from './components/ParseResults.jsx';
import DownloadQueue from './components/DownloadQueue.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false);
  const [ffmpegInstallState, setFfmpegInstallState] = useState({ status: 'idle', progress: 0, details: '' });
  const [settings, setSettings] = useState(null);
  const [parsedResults, setParsedResults] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Theme state - light by default (localStorage default: light)
  const [darkTheme, setDarkTheme] = useState(() => localStorage.getItem('theme') === 'dark');

  // Toast notifications state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Sync darkTheme changes to document.body
  useEffect(() => {
    if (darkTheme) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkTheme]);

  // Fetch initial environment status and settings
  useEffect(() => {
    const fetchStatusAndSettings = async () => {
      try {
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();
        setFfmpegAvailable(statusData.ffmpegAvailable);

        const ffmpegStatusRes = await fetch('/api/ffmpeg/status');
        const ffmpegStatusData = await ffmpegStatusRes.json();
        setFfmpegInstallState(ffmpegStatusData.installState);

        const settingsRes = await fetch('/api/settings');
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      } catch (err) {
        showToast('Failed to connect to backend server', 'error');
      }
    };

    fetchStatusAndSettings();

    // Setup SSE connection
    let eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'tasks') {
          setTasks(data.tasks);
        } else if (data.type === 'ffmpeg-install') {
          setFfmpegInstallState({
            status: data.status,
            progress: data.progress,
            details: data.details
          });
          if (data.status === 'complete') {
            setFfmpegAvailable(true);
            showToast('FFmpeg successfully installed!', 'success');
          } else if (data.status === 'failed') {
            showToast('FFmpeg installation failed.', 'error');
          }
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
      
      // Try to reconnect in 5 seconds
      setTimeout(() => {
        eventSource = new EventSource('/api/events');
      }, 5000);
    };

    return () => {
      eventSource.close();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Handle parsing multiple links
  const handleParse = async (urls) => {
    setIsParsing(true);
    showToast(`Parsing ${urls.length} link(s)...`, 'info');
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse links');
      }

      setParsedResults(prev => [...prev, ...data.results]);
      
      const successCount = data.results.filter(r => r.success).length;
      if (successCount > 0) {
        showToast(`Successfully parsed ${successCount} video(s)!`, 'success');
      } else {
        showToast('Failed to parse links. Check format/connection.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error occurred while parsing.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Remove elements from parsed list by index array
  const handleRemoveParsed = (indicesToRemove) => {
    setParsedResults(prev => prev.filter((_, index) => !indicesToRemove.includes(index)));
  };

  // Enqueue selected parsed results to the download queue
  const handleDownload = async (itemsToEnqueue) => {
    showToast(`Adding ${itemsToEnqueue.length} video(s) to queue...`, 'info');
    try {
      const response = await fetch('/api/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToEnqueue }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enqueue items');
      }

      showToast(`Enqueued ${data.count} items! Starting downloads...`, 'success');
    } catch (err) {
      showToast(err.message || 'Error enqueuing downloads.', 'error');
    }
  };

  // Cancel an active downloading process
  const handleCancelTask = async (taskId) => {
    try {
      const response = await fetch('/api/downloads/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      });

      const data = await response.json();
      if (data.success) {
        showToast('Download cancelled.', 'info');
      }
    } catch (err) {
      showToast('Failed to cancel download.', 'error');
    }
  };

  // Delete/remove tasks (finished or cancelled) from queue list
  const handleRemoveTasks = async (taskIds) => {
    try {
      const response = await fetch('/api/downloads/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: taskIds }),
      });

      const data = await response.json();
      if (data.success) {
        showToast(`Removed ${data.count} item(s) from history.`, 'info');
      }
    } catch (err) {
      showToast('Failed to remove item(s).', 'error');
    }
  };

  // Clear completed, failed, and cancelled logs
  const handleClearCompleted = async () => {
    try {
      const response = await fetch('/api/downloads/clear', {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        showToast('Cleared downloads history.', 'info');
      }
    } catch (err) {
      showToast('Failed to clear history.', 'error');
    }
  };

  // Trigger automatic download and installation of FFmpeg
  const handleInstallFfmpeg = async () => {
    try {
      const response = await fetch('/api/ffmpeg/install', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start installation');
      }
      showToast('Starting FFmpeg installation...', 'info');
    } catch (err) {
      showToast(err.message || 'Error starting installation.', 'error');
    }
  };

  return (
    <div className="app-container">
      <Header
        ffmpegAvailable={ffmpegAvailable}
        ffmpegInstallState={ffmpegInstallState}
        onInstallFfmpeg={handleInstallFfmpeg}
        darkTheme={darkTheme}
        onToggleTheme={() => setDarkTheme(prev => !prev)}
      />
      
      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <LinkInput onParse={handleParse} isParsing={isParsing} />
        
        <ParseResults
          results={parsedResults}
          onDownload={handleDownload}
          onRemove={handleRemoveParsed}
        />
        
        <DownloadQueue
          tasks={tasks}
          onCancel={handleCancelTask}
          onRemove={handleRemoveTasks}
          onClearCompleted={handleClearCompleted}
        />
        
        <Settings
          currentSettings={settings}
          onSaveSettings={setSettings}
        />
      </main>

      {/* Floating Toast Notification */}
      <div className={`toast toast-${toast.type} ${toast.show ? 'show' : ''}`}>
        <span>
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '❌'}
          {toast.type === 'info' && 'ℹ️'}
        </span>
        <div>{toast.message}</div>
      </div>
    </div>
  );
}
