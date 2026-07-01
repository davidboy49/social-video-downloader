import React, { useState, useEffect } from 'react';

export default function Settings({ currentSettings, onSaveSettings }) {
  const [outputDir, setOutputDir] = useState('');
  const [concurrency, setConcurrency] = useState(2);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (currentSettings) {
      setOutputDir(currentSettings.outputDir || '');
      setConcurrency(currentSettings.concurrency || 2);
    }
  }, [currentSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputDir, concurrency }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      onSaveSettings(data.settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // hide success alert after 3s
    } catch (err) {
      setError(err.message || 'Error occurred while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="glass-panel">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
        Settings
      </h2>

      <form onSubmit={handleSubmit} className="settings-grid">
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label" htmlFor="output-dir">
            Output Download Directory
          </label>
          <input
            id="output-dir"
            type="text"
            className="form-input"
            placeholder="e.g. C:\Users\sodavid.sin\Downloads"
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            disabled={isSaving}
            required
          />
          <span className="tip-text">
            Specify the folder where videos will be saved. The backend will verify or automatically create this directory.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="concurrency-limit">
            Max Parallel Downloads
          </label>
          <input
            id="concurrency-limit"
            type="number"
            className="form-input"
            min="1"
            max="10"
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)}
            disabled={isSaving}
            required
          />
          <span className="tip-text">
            Concurrency limit (1-10) to avoid IP bans and bandwidth exhaustion.
          </span>
        </div>

        <div className="settings-footer" style={{ gridColumn: 'span 2' }}>
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center' }}>
            {error && <span className="error-text">❌ {error}</span>}
            {success && <span style={{ color: 'var(--color-success)', fontSize: '0.85rem' }}>✓ Settings saved successfully</span>}
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </section>
  );
}
