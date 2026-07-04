import { describe, it, expect } from 'vitest';
import { getAppTheme } from '../themes';

describe('getAppTheme', () => {
  it('returns the speakeasy theme by name', () => {
    const theme = getAppTheme('speakeasy');
    expect(theme.palette.primary.main).toBe('#c9a96e');
    expect(theme.palette.background.default).toBe('#0a0a0a');
    expect(theme.custom.name).toBe('speakeasy');
    expect(theme.custom.decorations).toBe(false);
  });

  it('returns the july4 theme by name', () => {
    const theme = getAppTheme('july4');
    expect(theme.palette.primary.main).toBe('#B22234');
    expect(theme.palette.background.default).toBe('#0A1B3D');
    expect(theme.palette.secondary.main).toBe('#FFD700');
    expect(theme.custom.name).toBe('july4');
    expect(theme.custom.decorations).toBe(true);
    expect(theme.custom.placeholderEmoji).toBe('🎆');
  });

  it('falls back to speakeasy for undefined (config not loaded yet)', () => {
    expect(getAppTheme(undefined).custom.name).toBe('speakeasy');
  });

  it('falls back to speakeasy for unknown theme names', () => {
    expect(getAppTheme('christmas').custom.name).toBe('speakeasy');
  });

  it('every theme carries the full custom token set', () => {
    for (const name of ['speakeasy', 'july4']) {
      const { custom } = getAppTheme(name);
      expect(custom.metaThemeColor).toMatch(/^#/);
      expect(custom.navBg).toMatch(/^#/);
      expect(custom.placeholderGradient).toContain('linear-gradient');
      expect(custom.placeholderEmoji).toBeTruthy();
      expect(typeof custom.decorations).toBe('boolean');
    }
  });
});
