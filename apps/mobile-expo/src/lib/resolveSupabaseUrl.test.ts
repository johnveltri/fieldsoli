import { describe, expect, it } from '@jest/globals';

import { resolveSupabaseUrlForPlatform } from './resolveSupabaseUrl';

describe('resolveSupabaseUrlForPlatform', () => {
  it('rewrites loopback hosts to 10.0.2.2 on Android', () => {
    expect(resolveSupabaseUrlForPlatform('http://127.0.0.1:54321', 'android')).toBe(
      'http://10.0.2.2:54321',
    );
    expect(resolveSupabaseUrlForPlatform('http://localhost:54321', 'android')).toBe(
      'http://10.0.2.2:54321',
    );
    expect(resolveSupabaseUrlForPlatform('http://[::1]:54321', 'android')).toBe(
      'http://10.0.2.2:54321',
    );
  });

  it('leaves local URLs unchanged on iOS and web', () => {
    expect(resolveSupabaseUrlForPlatform('http://127.0.0.1:54321', 'ios')).toBe(
      'http://127.0.0.1:54321',
    );
    expect(resolveSupabaseUrlForPlatform('http://localhost:54321', 'web')).toBe(
      'http://localhost:54321',
    );
  });

  it('leaves hosted HTTPS URLs unchanged on Android', () => {
    expect(
      resolveSupabaseUrlForPlatform(
        'https://gfvqmxsiuhhujnckghpa.supabase.co',
        'android',
      ),
    ).toBe('https://gfvqmxsiuhhujnckghpa.supabase.co');
  });
});
