// The settings view in a window of its own.
//
// It is the same App the side panel runs, opened on the Settings tab, rather
// than a second settings screen: the settings are one stored object with one
// dirty-tracking and one save, and a parallel implementation of that is a
// second thing to keep correct for no gain.
//
// What the window changes is room. `data-surface` marks the document as one,
// and the stylesheets widen the shell and lay the fields out in columns instead
// of the single narrow ribbon a 460px panel forces.

import './theme.css';
import { createRoot } from 'react-dom/client';
import { App } from './sidepanel/App';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Missing #app root element in settings HTML.');
}

document.documentElement.dataset.surface = 'window';

createRoot(container).render(<App initialTab="settings" />);
