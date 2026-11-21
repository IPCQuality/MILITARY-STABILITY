import { createRoot } from 'react-dom/client';
import App from './frontend/App.tsx';
import { ErrorBoundary } from './frontend/ui/ErrorBoundary.tsx';
import './frontend/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

(window as unknown as { __msBooted?: boolean }).__msBooted = true;
