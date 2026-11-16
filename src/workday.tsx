import './theme.css';
import { createRoot } from 'react-dom/client';
import { WorkDayApp } from './workday/WorkDayApp';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Missing #app root element in work day HTML.');
}

createRoot(container).render(<WorkDayApp />);
