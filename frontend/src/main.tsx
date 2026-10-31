import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { Background3D } from './components/Background3D';
import './index.css';

try {
  const savedTheme = localStorage.getItem('incit_theme');
  const savedPalette = localStorage.getItem('incit_palette');
  document.documentElement.dataset.theme = savedTheme === 'light' || savedTheme === 'porcelain' ? 'light' : 'dark';
  document.documentElement.dataset.palette = ['indigo', 'emerald', 'violet', 'ocean'].includes(savedPalette ?? '')
    ? savedPalette!
    : 'indigo';
} catch {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.palette = 'indigo';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Background3D />
    <div className="app-layer">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </div>
  </StrictMode>,
);
