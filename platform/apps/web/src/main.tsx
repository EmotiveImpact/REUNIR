import './design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceProvider } from './lib/context';
import App from './App';
import { SAVED_NOTE } from './components/states';
import { Button } from './components/ui/button';
import './styles.css';
const Router = location.protocol === 'about:' ? MemoryRouter : HashRouter;
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: false } } });
class ErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    error: string;
}> {
    state = { error: '' };
    static getDerivedStateFromError(error: Error) { return { error: error.message }; }
    // The last resort, outside the shell: each page has its own boundary (components/states.tsx) that keeps the navigation.
    render() { return this.state.error ? <main className="loading-page"><div className="state-error"><h1>A small interruption.</h1><p>The interface encountered an unexpected problem. {SAVED_NOTE}</p><div className="empty-actions"><Button variant="default" className="button primary" onClick={() => location.reload()}>Reload REUNIR</Button></div><details className="state-detail"><summary>Technical detail</summary><code>{this.state.error}</code></details></div></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><QueryClientProvider client={client}><Router><WorkspaceProvider><App /></WorkspaceProvider></Router></QueryClientProvider></ErrorBoundary></React.StrictMode>);

import './v4.css';
import './lesson-editor.css';
import './lesson-resources.css';
import './knowledge-checks.css';
import './covers.css';
import './instructors.css';
import './appeals.css';
import './groups.css';
import './learning-record.css';
import './account.css';
import './states.css';
import './collections.css';
import './project-work.css';
import './forms.css';
