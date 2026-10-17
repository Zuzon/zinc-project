import { backendSocketUrl } from './backendSocket.js';

describe('backendSocketUrl', () => {
  it('uses the page host and a matching scheme', () => {
    expect(
      backendSocketUrl({ protocol: 'http:', host: 'localhost:4200' }),
    ).toBe('ws://localhost:4200/rx');
    expect(backendSocketUrl({ protocol: 'https:', host: 'zinc.local' })).toBe(
      'wss://zinc.local/rx',
    );
  });
});
