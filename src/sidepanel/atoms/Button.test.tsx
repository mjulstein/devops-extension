import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';

describe('Button', () => {
  it('labels an icon-only button with its description, since nothing else can', () => {
    const html = renderToStaticMarkup(
      <Button icon="☆" description="Star this page" />
    );

    expect(html).toContain('aria-label="Star this page"');
    // The same text is the tooltip, so hovering explains the glyph.
    expect(html).toContain('title="Star this page"');
  });

  it('does not repeat the description as an accessible name when there is text', () => {
    const html = renderToStaticMarkup(
      <Button icon="↻" description="Reload the extension">
        Reload
      </Button>
    );

    expect(html).not.toContain('aria-label');
    expect(html).toContain('title="Reload the extension"');
    expect(html).toContain('Reload</span>');
  });

  it('hides the glyph from assistive tech, which reads the label instead', () => {
    const html = renderToStaticMarkup(<Button icon="⧉">Deduplicate</Button>);

    expect(html).toContain('aria-hidden="true"');
  });

  it('announces a toggle state when it is one', () => {
    const html = renderToStaticMarkup(
      <Button icon="🌙" description="Switch to light mode" isPressed />
    );

    expect(html).toContain('aria-pressed="true"');
  });

  it('carries an explicit title over the description', () => {
    const html = renderToStaticMarkup(
      <Button description="fallback" title="the real tooltip">
        Go
      </Button>
    );

    expect(html).toContain('title="the real tooltip"');
  });
});

describe('Button, disclosure', () => {
  it('announces expanded state and the region it controls, which is not the same as pressed', () => {
    const html = renderToStaticMarkup(
      <Button
        icon="▾"
        description="Collapse recent features"
        isExpanded
        controls="features"
      />
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="features"');
    expect(html).not.toContain('aria-pressed');
  });
});

describe('Button, menu trigger', () => {
  it('announces that it opens a menu', () => {
    const html = renderToStaticMarkup(
      <Button hasPopup="menu" isExpanded={false}>
        Starred
      </Button>
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });
});
