import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-base, #f3f4f6)',
          color: 'var(--color-text-primary, #111827)',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</span>
          <h1 style={{ fontSize: '2rem', marginBottom: '10px', fontFamily: 'var(--font-heading)' }}>
            Application Error
          </h1>
          <p style={{ color: 'var(--color-text-secondary, #4b5563)', marginBottom: '20px', maxWidth: '500px' }}>
            An unexpected error occurred in the user interface. You can try reloading the application.
          </p>
          {this.state.error && (
            <pre style={{
              backgroundColor: 'rgba(0,0,0,0.03)',
              border: '1px solid var(--border-glass)',
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'left',
              fontSize: '0.85rem',
              overflowX: 'auto',
              maxWidth: '600px',
              width: '100%',
              marginBottom: '20px',
              color: 'var(--color-danger)'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: 'var(--color-primary, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'var(--font-heading)'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
