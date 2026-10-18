import { hasToken, withToken } from './access.js';

describe('hasToken', () => {
  it('accepts only the exact token', () => {
    expect(hasToken('/rx?t=abc', 'abc')).toBe(true);
    expect(hasToken('/rx?t=abd', 'abc')).toBe(false);
    expect(hasToken('/rx?t=ab', 'abc')).toBe(false);
    expect(hasToken('/rx', 'abc')).toBe(false);
    expect(hasToken(undefined, 'abc')).toBe(false);
  });

  it('round-trips with withToken', () => {
    const token = 'a+b/c=';
    expect(hasToken(withToken('/api/maps/m/tiles/1/2/3', token), token)).toBe(
      true,
    );
  });
});
