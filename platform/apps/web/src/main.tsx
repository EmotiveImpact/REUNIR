import './design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceProvider } from './lib/context';
import App from './App';
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
    render() { return this.state.error ? <main className="loading-page"><h1>A small interruption.</h1><p>The interface encountered an unexpected problem. Your saved demo data has not been deleted.</p><button onClick={() => location.reload()}>Reload REUNIR</button><details><summary>Technical detail</summary>{this.state.error}</details></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><QueryClientProvider client={client}><Router><WorkspaceProvider><App /></WorkspaceProvider></Router></QueryClientProvider></ErrorBoundary></React.StrictMode>);

import './v4.css';
import './lesson-editor.css';
import './lesson-resources.css';
