import './theme.css';
import { createRoot } from 'react-dom/client';
import { BookmarksApp } from './bookmarks/BookmarksApp';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Missing #app root element in bookmarks manager HTML.');
}

createRoot(container).render(<BookmarksApp />);
