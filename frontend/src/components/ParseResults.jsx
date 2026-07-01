import React, { useState, useEffect } from 'react';

export default function ParseResults({ results, onDownload, onRemove }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [formats, setFormats] = useState({}); // itemId -> formatId ('best', 'videoonly', 'audioonly')

  // Keep selected list in sync when results change
  useEffect(() => {
    // Select all successful ones by default when new items are added
    const successfulItems = results.filter(r => r.success);
    setSelectedIds(successfulItems.map((_, index) => index));
    
    // Initialize default formats
    const initialFormats = {};
    results.forEach((_, index) => {
      initialFormats[index] = 'best';
    });
    setFormats(initialFormats);
  }, [results]);

  if (results.length === 0) return null;

  const handleSelectToggle = (index) => {
    setSelectedIds(prev =>
      prev.includes(index)
        ? prev.filter(id => id !== index)
        : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    const successfulIndices = results
      .map((item, index) => ({ item, index }))
      .filter(x => x.item.success)
      .map(x => x.index);

    if (selectedIds.length === successfulIndices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(successfulIndices);
    }
  };

  const handleFormatChange = (index, format) => {
    setFormats(prev => ({ ...prev, [index]: format }));
  };

  const handleRemoveSelected = () => {
    // Remove selected indices
    onRemove(selectedIds);
    setSelectedIds([]);
  };

  const handleDownloadSelected = () => {
    if (selectedIds.length === 0) return;

    const itemsToDownload = selectedIds.map(index => {
      const item = results[index];
      return {
        url: item.url,
        metadata: {
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration,
          platform: item.platform
        },
        formatId: formats[index] || 'best'
      };
    });

    onDownload(itemsToDownload);
    // Remove the downloaded items from the parsed results
    onRemove(selectedIds);
    setSelectedIds([]);
  };

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    
    const parts = [];
    if (h > 0) parts.push(h);
    parts.push(h > 0 ? String(m).padStart(2, '0') : m);
    parts.push(String(s).padStart(2, '0'));
    return parts.join(':');
  };

  const successfulCount = results.filter(r => r.success).length;

  return (
    <section className="glass-panel">
      <div className="section-title-row">
        <h2 className="section-title">
          Parsed Videos
          <span className="badge-count">{results.length}</span>
        </h2>
        <div className="controls-row">
          {successfulCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleSelectAll}>
              {selectedIds.length === successfulCount ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-danger btn-sm" onClick={handleRemoveSelected}>
                Remove Selected ({selectedIds.length})
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadSelected}>
                Download Selected ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="parse-list">
        {results.map((item, index) => {
          const isSelected = selectedIds.includes(index);
          
          if (!item.success) {
            return (
              <div key={index} className="video-card error">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  <span style={{ color: 'var(--color-danger)' }}>⚠️</span>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.url}
                    </div>
                    <div className="error-text">{item.error || 'Failed to extract metadata'}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => onRemove([index])}>
                    Dismiss
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={index} className="video-card">
              <label className="checkbox-custom">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectToggle(index)}
                />
                <span className="checkmark"></span>
              </label>

              <div className="video-thumbnail-container">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.title} className="video-thumbnail" />
                ) : (
                  <div className="video-thumbnail" style={{ display: 'flex', alignItems: 'center', justify: 'center', background: 'rgba(255,255,255,0.05)' }}>
                    🎬
                  </div>
                )}
                {item.duration > 0 && (
                  <span className="video-duration">{formatDuration(item.duration)}</span>
                )}
              </div>

              <div className="video-details">
                <h3 className="video-title" title={item.title}>{item.title}</h3>
                <div className="video-meta">
                  <span className="platform-tag">{item.platform}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                  <span style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{item.url}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <select
                  className="format-select"
                  value={formats[index] || 'best'}
                  onChange={(e) => handleFormatChange(index, e.target.value)}
                >
                  <option value="best">Video + Audio (Best)</option>
                  <option value="videoonly">Video Only</option>
                  <option value="audioonly">Audio Only</option>
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.45rem' }}
                  onClick={() => onRemove([index])}
                  title="Remove from list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
