import { describe, it, expect } from 'vitest';
import { getAppTheme } from '../themes';

describe('w00w00 theme', () => {
  it('uses the deck palette: ink background, bone primary, TLP red secondary', () => {
    const t = getAppTheme('w00w00');
    expect(t.custom.name).toBe('w00w00');
    expect(t.palette.background.default).toBe('#0a0a0b');
    expect(t.palette.primary.main).toBe('#f5f2ed');
    expect(t.palette.secondary.main).toBe('#ff0033');
    expect(t.typography.h1.fontFamily).toContain('IBM Plex Mono');
    expect(t.custom.decorations).toBe(true);
  });
});

describe('beach theme', () => {
  it('uses the harbor palette: navy background, seafoam primary, brass secondary', () => {
    const t = getAppTheme('beach');
    expect(t.custom.name).toBe('beach');
    expect(t.palette.background.default).toBe('#0b1c2c');
    expect(t.palette.primary.main).toBe('#8fd3c7');
    expect(t.palette.secondary.main).toBe('#c8a45c');
    expect(t.typography.h1.fontFamily).toContain('Cormorant');
    expect(t.custom.decorations).toBe(true);
  });
});

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
