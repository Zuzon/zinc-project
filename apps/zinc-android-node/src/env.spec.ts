import { readBackendEnv } from './env.js';

const base = {
  ZINC_DATA_DIR: '/data/user/0/app/files/zinc',
  ZINC_PORT: '41234',
  ZINC_TOKEN: 'secret',
};

describe('readBackendEnv', () => {
  it('reads the settings the Android host passes', () => {
    expect(
      readBackendEnv({
        ...base,
        ZINC_LISTEN_FD: '57',
        ZINC_SQLITE_BINDING: '/lib/libbetter_sqlite3.so',
      }),
    ).toEqual({
      dataDir: '/data/user/0/app/files/zinc',
      port: 41234,
      listenFd: 57,
      token: 'secret',
      sqliteBinding: '/lib/libbetter_sqlite3.so',
    });
  });

  it('leaves the optional settings unset', () => {
    expect(readBackendEnv(base)).toEqual({
      dataDir: '/data/user/0/app/files/zinc',
      port: 41234,
      listenFd: undefined,
      token: 'secret',
      sqliteBinding: undefined,
    });
  });

  it('rejects missing or malformed settings', () => {
    expect(() => readBackendEnv({ ...base, ZINC_TOKEN: '' })).toThrow(
      /ZINC_TOKEN/,
    );
    expect(() => readBackendEnv({ ...base, ZINC_PORT: '0' })).toThrow(
      /ZINC_PORT/,
    );
    expect(() => readBackendEnv({ ...base, ZINC_PORT: '80a' })).toThrow(
      /ZINC_PORT/,
    );
    expect(() => readBackendEnv({ ...base, ZINC_LISTEN_FD: '-1' })).toThrow(
      /ZINC_LISTEN_FD/,
    );
  });
});
