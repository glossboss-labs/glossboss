import { describe, expect, it } from 'vitest';
import { normalizeSettingsTab } from './Settings';

describe('normalizeSettingsTab', () => {
  it('maps legacy modal tab ids to their page equivalents', () => {
    expect(
      normalizeSettingsTab('api', {
        isAuthenticated: false,
        isDevelopment: false,
      }),
    ).toBe('translation');
    expect(
      normalizeSettingsTab('keybinds', {
        isAuthenticated: false,
        isDevelopment: false,
      }),
    ).toBe('shortcuts');
    expect(
      normalizeSettingsTab('transfer', {
        isAuthenticated: false,
        isDevelopment: false,
      }),
    ).toBe('backup');
  });

  it('falls back when the requested tab is not available in the current context', () => {
    expect(
      normalizeSettingsTab('account', {
        isAuthenticated: false,
        isDevelopment: false,
      }),
    ).toBe('translation');
    expect(
      normalizeSettingsTab('development', {
        isAuthenticated: true,
        isDevelopment: false,
      }),
    ).toBe('account');
    expect(
      normalizeSettingsTab('not-a-tab', {
        isAuthenticated: true,
        isDevelopment: true,
      }),
    ).toBe('account');
  });
});
