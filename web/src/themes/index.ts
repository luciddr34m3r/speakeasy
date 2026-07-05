import type { Theme } from '@mui/material/styles';
import type { ThemeName } from '../lib/schema';
import speakeasy from './speakeasy';
import july4 from './july4';
import w00w00 from './w00w00';
import beach from './beach';

export interface CustomTokens {
  name: ThemeName;
  metaThemeColor: string;
  navBg: string;
  placeholderGradient: string;
  placeholderEmoji: string;
  decorations: boolean;
}

declare module '@mui/material/styles' {
  interface Theme {
    custom: CustomTokens;
  }
  interface ThemeOptions {
    custom: CustomTokens;
  }
}

const themes: Record<ThemeName, Theme> = { speakeasy, july4, w00w00, beach };

/**
 * Falls back to speakeasy for undefined (config still loading) or unknown
 * names (config doc written before a theme was removed/renamed).
 */
export function getAppTheme(name: string | undefined): Theme {
  return themes[(name ?? 'speakeasy') as ThemeName] ?? themes.speakeasy;
}
