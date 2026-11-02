import { renderToStaticMarkup } from 'react-dom/server';
import { GroupMoveMenu } from './GroupMoveMenu';

function render(index: number, count: number) {
  return renderToStaticMarkup(
    <GroupMoveMenu
      label="Repos"
      index={index}
      count={count}
      onMove={() => undefined}
      onClose={() => undefined}
    />
  );
}

describe('GroupMoveMenu', () => {
  it('offers both ends and both steps', () => {
    const markup = render(1, 3);
    for (const text of [
      'Move to top',
      'Move up',
      'Move down',
      'Move to bottom'
    ]) {
      expect(markup).toContain(text);
    }
  });

  it('greys out the moves that would do nothing at the top', () => {
    // Enabled buttons that change nothing are how a broken list looks.
    const markup = render(0, 3);
    expect(markup.split('disabled').length - 1).toBe(2);
  });

  it('greys out the other two at the bottom', () => {
    expect(render(2, 3).split('disabled').length - 1).toBe(2);
  });

  it('greys out everything when a group is alone', () => {
    expect(render(0, 1).split('disabled').length - 1).toBe(4);
  });
});
