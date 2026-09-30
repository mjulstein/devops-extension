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
    expect(parseCommandQuery('> add app').text).toBe('add app');
  });
});

describe('matchCommands', () => {
  it('offers every command for a bare prefix, in order', () => {
    expect(matchCommands(QUICK_COMMANDS, '').map((c) => c.id)).toEqual([
      'add-app',
      'add-app-env'
    ]);
  });

  it('leads with the name being typed, over the shorter one already complete', () => {
    // "add app e" is somebody part-way through "add app env". It is also a
    // legitimate "add app" named "e", so that stays on offer underneath.
    expect(matchCommands(QUICK_COMMANDS, 'add app e').map((c) => c.id)).toEqual(
      ['add-app-env', 'add-app']
    );
  });

  it('keeps the row while its arguments are being typed', () => {
    expect(
      matchCommands(QUICK_COMMANDS, 'add app env test https://x.test/')[0].id
    ).toBe('add-app-env');
  });

  it('prefers the more specific name when both could match', () => {
    // 'add app env x' begins with 'add app' as well; the longer name wins.
    expect(matchCommands(QUICK_COMMANDS, 'add app env x')[0].id).toBe(
      'add-app-env'
    );
  });
});

describe('completeCommand', () => {
  it('completes to the nearest name, ready for its arguments', () => {
    expect(completeCommand(QUICK_COMMANDS, 'add app e')).toBe('add app env ');
  });

  it('completes a bare prefix to the first command', () => {
    expect(completeCommand(QUICK_COMMANDS, '')).toBe('add app ');
  });

  it('leaves a name that is already complete alone', () => {
    expect(completeCommand(QUICK_COMMANDS, 'add app env test')).toBe(
      'add app env test'
    );
  });

  it('leaves text that matches nothing alone', () => {
    expect(completeCommand(QUICK_COMMANDS, 'zzz')).toBe('zzz');
  });
});

describe('readCommand', () => {
  it('reads the arguments after the name', () => {
    expect(
      readCommand(QUICK_COMMANDS, 'add app env test https://x.test/')
    ).toEqual({
      command: QUICK_COMMANDS[1],
      args: ['test', 'https://x.test/']
    });
  });

  it('reads a command with no arguments given', () => {
    expect(readCommand(QUICK_COMMANDS, 'add app')).toEqual({
      command: QUICK_COMMANDS[0],
      args: []
    });
  });

  it('gives no arguments while the name is still being typed', () => {
    expect(readCommand(QUICK_COMMANDS, 'add a')).toEqual({
      command: QUICK_COMMANDS[0],
      args: []
    });
  });

  it('is null when nothing matches', () => {
    expect(readCommand(QUICK_COMMANDS, 'zzz')).toBeNull();
  });
});
