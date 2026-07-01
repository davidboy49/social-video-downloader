import React from 'react';

export default function Header({
  ffmpegAvailable,
  ffmpegInstallState,
  onInstallFfmpeg,
  darkTheme,
  onToggleTheme
}) {
  const isInstalling = ffmpegInstallState?.status === 'installing';
  const installProgress = ffmpegInstallState?.progress || 0;
  const installDetails = ffmpegInstallState?.details || '';

  return (
    <header className="header-wrapper">
      <div className="brand-section">
        <div className="brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
          <h1 className="brand-title">Social Downloader</h1>
        </div>
      </div>

      <div className="system-status">
        {/* Dynamic FFmpeg Badge / Installer display */}
        {ffmpegAvailable ? (
          <div className="status-badge success">
            <span className="status-dot">●</span>
            FFmpeg Active
          </div>
        ) : isInstalling ? (
          <div className="status-badge warning" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.4rem 0.8rem', borderRadius: '12px', alignItems: 'flex-start', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <svg className="install-spinner" viewBox="0 0 50 50" style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite', stroke: 'currentColor' }}>
                <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5" strokeDasharray="31.4, 31.4"></circle>
              </svg>
              <span>Installing FFmpeg... ({installProgress.toFixed(1)}%)</span>
            </div>
            <div className="progress-bar-bg" style={{ width: '180px', height: '4px', margin: '2px 0' }}>
              <div className="progress-bar-fill completed" style={{ width: `${installProgress}%` }}></div>
            </div>
            <span style={{ fontSize: '0.65rem', opacity: 0.8, maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installDetails}
            </span>
          </div>
        ) : (
          <div className="status-badge warning">
            <span className="status-dot">⚠️</span>
            FFmpeg Missing
            <div className="tooltip">
              <strong>FFmpeg is not installed.</strong>
              <br /><br />
              Downloads are restricted to pre-merged qualities.
              <br /><br />
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem', marginTop: '0.5rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onInstallFfmpeg();
                }}
              >
                ⚡ Auto Install FFmpeg
              </button>
            </div>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          className="btn btn-secondary theme-toggle-btn"
          onClick={onToggleTheme}
          title={darkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkTheme ? '☀️' : '🌙'}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .install-spinner {
          display: inline-block;
        }
      `}</style>
    </header>
  );
}
