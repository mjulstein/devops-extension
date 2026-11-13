import './theme.css';
import { createRoot } from 'react-dom/client';
import { WindowDeckApp } from './windows/WindowDeckApp';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Missing #app root element in window deck HTML.');
}

createRoot(container).render(<WindowDeckApp />);
