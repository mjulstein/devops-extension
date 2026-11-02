import { renderToStaticMarkup } from 'react-dom/server';
import { WindowDeck } from './WindowDeck';
import { readWindows } from './windowDeck';

const windows = readWindows([
  {
    id: 1,
    type: 'normal',
    focused: true,
    tabs: [
      { id: 11, title: 'Front', url: 'https://a.test/', active: true },
      { id: 12, title: 'Behind', url: 'https://a.test/b' }
    ]
  },
  {
    id: 2,
    type: 'normal',
    tabs: [{ id: 21, title: 'Alone', url: 'https://b.test/', active: true }]
  }
]);

function render(pinned: number[] = []) {
  return renderToStaticMarkup(
    <WindowDeck
      windows={windows}
      pinned={pinned}
      onOrderChange={() => undefined}
      onTogglePinned={() => undefined}
      onSwitchTo={() => undefined}
      onClose={() => undefined}
      onDetachFront={() => undefined}
    />
  );
}

describe('WindowDeck', () => {
  it('names each window after what is in front of you in it', () => {
    const markup = render();
    expect(markup).toContain('Front');
    expect(markup).toContain('Alone');
  });

  it('counts the tabs, and says when there is only one', () => {
    const markup = render();
    expect(markup).toContain('2 tabs');
    expect(markup).toContain('one tab');
  });

  it('marks the window you came from', () => {
    expect(render()).toContain('· here');
  });

  it('says what closing a window would take with it', () => {
    // A window can hold a day's work; the button should say so before it is
    // pressed, not after.
    expect(render()).toContain('Close Front and 1 more');
  });

  it('offers the move menu on the icon, as the tabs list does', () => {
    expect(render()).toContain('Right-click to move Front');
  });

  it('offers to hold a window at the top, and to let go of a held one', () => {
    expect(render()).toContain('Hold Front at the top');
    expect(render([1])).toContain('Let Front move with the rest');
  });

  it('says so when there is nothing to switch to', () => {
    const markup = renderToStaticMarkup(
      <WindowDeck
        windows={[]}
        pinned={[]}
        onOrderChange={() => undefined}
        onTogglePinned={() => undefined}
        onSwitchTo={() => undefined}
        onClose={() => undefined}
        onDetachFront={() => undefined}
      />
    );
    expect(markup).toContain('No other windows are open.');
  });

  it('offers to send the front tab off alone, where there is a rest', () => {
    expect(render()).toContain('Move Front into a window of its own');
  });

  it('offers nothing of the kind on a window of one tab', () => {
    // It would move the tab from one window to an identical one.
    expect(render()).not.toContain('Move Alone into a window of its own');
  });
});
