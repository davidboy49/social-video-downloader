import React, { useState } from 'react';

export default function LinkInput({ onParse, isParsing }) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Split links by newlines, commas, or spaces, and filter empty ones
    const urls = inputValue
      .split(/[\n, ]+/)
      .map(url => url.trim())
      .filter(url => {
        try {
          new URL(url);
          return true;
        } catch (_) {
          return false;
        }
      });

    if (urls.length === 0) {
      alert('Please enter one or more valid URLs (including http:// or https://)');
      return;
    }

    onParse(urls);
    setInputValue('');
  };

  return (
    <section className="glass-panel input-section">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Paste Video Links</h2>
      <form onSubmit={handleSubmit} className="textarea-container">
        <textarea
          className="link-textarea"
          placeholder="Paste social media video links here...&#10;Supports YouTube, TikTok, Instagram, Twitter, Facebook, etc.&#10;Enter one link per line or separate with spaces/commas."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isParsing}
        />
        
        <div className="action-row" style={{ marginTop: '0.75rem' }}>
          <span className="tip-text">
            💡 Paste multiple links for bulk downloading. Each URL will be parsed and queued.
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isParsing || !inputValue.trim()}
          >
            {isParsing ? (
              <>
                <svg className="spinner" viewBox="0 0 50 50" style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite', stroke: 'currentColor' }}>
                  <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5" strokeDasharray="31.4, 31.4"></circle>
                </svg>
                Parsing Links...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
                </svg>
                Parse Links
              </>
            )}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          margin-right: 4px;
        }
      `}</style>
    </section>
  );
}
