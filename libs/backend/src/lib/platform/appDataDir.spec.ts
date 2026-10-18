import { homedir } from 'node:os';
import { join } from 'node:path';
import { appDataDir } from './appDataDir.js';

describe('appDataDir', () => {
  it('prefers ZINC_DATA_DIR', () => {
    expect(appDataDir({ ZINC_DATA_DIR: '/data/zinc' }, 'win32')).toBe(
      '/data/zinc',
    );
  });

  it('uses APPDATA on Windows', () => {
    expect(appDataDir({ APPDATA: 'C:/Users/n/AppData/Roaming' }, 'win32')).toBe(
      join('C:/Users/n/AppData/Roaming', 'zinc'),
    );
  });

  it('uses XDG_DATA_HOME on Linux, falling back to ~/.local/share', () => {
    expect(appDataDir({ XDG_DATA_HOME: '/xdg' }, 'linux')).toBe(
      join('/xdg', 'zinc'),
    );
    expect(appDataDir({}, 'linux')).toBe(
      join(homedir(), '.local', 'share', 'zinc'),
    );
  });
});
