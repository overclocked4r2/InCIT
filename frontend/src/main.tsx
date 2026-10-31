import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

try {
  const savedTheme = localStorage.getItem('incit_theme');
  document.documentElement.dataset.theme = savedTheme === 'porcelain' ? 'porcelain' : 'midnight';
} catch {
  document.documentElement.dataset.theme = 'midnight';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
