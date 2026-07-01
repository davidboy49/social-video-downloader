import React, { useState } from 'react';

export default function DownloadQueue({ tasks, onCancel, onRemove, onClearCompleted }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelectToggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === tasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map(t => t.id));
    }
  };

  const handleRemoveSelected = () => {
    if (selectedIds.length === 0) return;
    onRemove(selectedIds);
    setSelectedIds([]);
  };

  const getFormatBadgeLabel = (formatId) => {
    if (formatId === 'audioonly') return 'Audio';
    if (formatId === 'videoonly') return 'Video';
    return 'Video+Audio';
  };

  return (
    <section className="glass-panel">
      <div className="section-title-row">
        <h2 className="section-title">
          Download Queue
          <span className="badge-count">{tasks.length}</span>
        </h2>
        
        <div className="controls-row">
          {tasks.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleSelectAll}>
              {selectedIds.length === tasks.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedIds.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleRemoveSelected}>
              Remove Selected ({selectedIds.length})
            </button>
          )}
          {tasks.some(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') && (
            <button className="btn btn-secondary btn-sm" onClick={onClearCompleted}>
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ fontSize: '3rem' }}>📥</div>
          <h3>Queue is Empty</h3>
          <p>Parse links and add videos to the download queue to start downloading.</p>
        </div>
      ) : (
        <div className="queue-list">
          {tasks.map((task) => {
            const isSelected = selectedIds.includes(task.id);
            const isDownloading = task.status === 'downloading';
            
            return (
              <div key={task.id} className={`queue-item ${task.status} ${isDownloading ? 'downloading' : ''}`}>
                <div className="queue-item-header">
                  <label className="checkbox-custom">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectToggle(task.id)}
                    />
                    <span className="checkmark"></span>
                  </label>

                  <div className="video-thumbnail-container" style={{ width: '80px', height: '45px' }}>
                    {task.thumbnail ? (
                      <img src={task.thumbnail} alt={task.title} className="video-thumbnail" />
                    ) : (
                      <div className="video-thumbnail" style={{ display: 'flex', alignItems: 'center', justify: 'center', background: 'rgba(255,255,255,0.05)' }}>
                        🎬
                      </div>
                    )}
                  </div>

                  <div className="video-details" style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`queue-status-tag ${task.status}`}>{task.status}</span>
                      <span className="platform-tag" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)' }}>
                        {task.platform}
                      </span>
                      <span className="platform-tag" style={{ fontSize: '0.65rem' }}>
                        {getFormatBadgeLabel(task.formatId)}
                      </span>
                    </div>
                    <h3 className="video-title" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }} title={task.title}>
                      {task.title}
                    </h3>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isDownloading ? (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => onCancel(task.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem' }}
                        onClick={() => onRemove([task.id])}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="queue-item-body">
                  <div className="progress-container">
                    <div className="progress-bar-bg">
                      <div
                        className={`progress-bar-fill ${task.status}`}
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    
                    <div className="progress-info">
                      <span>{task.progress.toFixed(1)}%</span>
                      {isDownloading && (
                        <div className="metrics">
                          <div className="metric-item">
                            <span className="metric-label">Speed:</span>
                            <span className="metric-value">{task.speed || '0 B/s'}</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-label">ETA:</span>
                            <span className="metric-value">{task.eta || '--:--'}</span>
                          </div>
                        </div>
                      )}
                      {task.status === 'completed' && task.fileName && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                          Saved as: {task.fileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {task.status === 'failed' && task.error && (
                    <div className="error-text" style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                      <strong>Error:</strong> {task.error}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
