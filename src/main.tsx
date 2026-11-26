import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AccidentGuard] UI render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: '24px', background: '#070a11', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#f87171' }}>AccidentGuard could not start</h1>
          <p>The app hit a rendering error. Refresh the page; if it continues, share the diagnostic details below with the developer.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '16px', borderRadius: '8px', background: '#111827', color: '#fecaca' }}>
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: '8px', border: 0, cursor: 'pointer' }}>
            Reload application
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('[AccidentGuard] Startup failed: #root element was not found.');
}
