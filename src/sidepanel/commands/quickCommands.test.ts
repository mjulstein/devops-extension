import {
  completeCommand,
  isCommandQuery,
  matchCommands,
  parseCommandQuery,
  QUICK_COMMANDS,
  readCommand
} from './quickCommands';

describe('isCommandQuery', () => {
  it('is the leading > that asks for commands', () => {
    expect(isCommandQuery('>add')).toBe(true);
    expect(isCommandQuery('add')).toBe(false);
  });

  it('drops the prefix and the space after it', () => {
    expect(parseCommandQuery('> sort tabs').text).toBe('sort tabs');
  });
});

describe('matchCommands', () => {
  it('offers every command for a bare prefix, in order', () => {
    expect(matchCommands(QUICK_COMMANDS, '').map((c) => c.id)).toEqual([
      'sort-tabs',
      'join-windows',
      'tab-to-window',
      'group-to-window',
      'close-older-than'
    ]);
  });

  it('narrows to the one being typed', () => {
    expect(matchCommands(QUICK_COMMANDS, 'sort').map((c) => c.id)).toEqual([
      'sort-tabs'
    ]);
  });

  it('keeps the row while its arguments are being typed', () => {
    expect(
      matchCommands(QUICK_COMMANDS, 'close tabs older than 30')[0].id
    ).toBe('close-older-than');
  });

  it('matches a word from the middle of a name', () => {
    expect(matchCommands(QUICK_COMMANDS, 'window').map((c) => c.id)).toEqual([
      'join-windows',
      'tab-to-window',
      'group-to-window'
    ]);
  });
});

describe('completeCommand', () => {
  it('completes to the nearest name, ready for its arguments', () => {
    expect(completeCommand(QUICK_COMMANDS, 'close')).toBe(
      'close tabs older than '
    );
  });

  it('completes a bare prefix to the first command, which takes none', () => {
    expect(completeCommand(QUICK_COMMANDS, '')).toBe('sort tabs');
  });

  it('leaves a name that is already complete alone', () => {
    expect(completeCommand(QUICK_COMMANDS, 'sort tabs')).toBe('sort tabs');
  });

  it('leaves text that matches nothing alone', () => {
    expect(completeCommand(QUICK_COMMANDS, 'zzz')).toBe('zzz');
  });
});

describe('readCommand', () => {
  it('reads the arguments after the name', () => {
    expect(readCommand(QUICK_COMMANDS, 'close tabs older than 30')).toEqual({
      command: QUICK_COMMANDS[4],
      args: ['30']
    });
  });

  it('reads a command with no arguments given', () => {
    expect(readCommand(QUICK_COMMANDS, 'sort tabs')).toEqual({
      command: QUICK_COMMANDS[0],
      args: []
    });
  });

  it('gives no arguments while the name is still being typed', () => {
    expect(readCommand(QUICK_COMMANDS, 'sort t')).toEqual({
      command: QUICK_COMMANDS[0],
      args: []
    });
  });

  it('is null when nothing matches', () => {
    expect(readCommand(QUICK_COMMANDS, 'zzz')).toBeNull();
  });
});
