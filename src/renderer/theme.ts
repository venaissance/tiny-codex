export interface Theme {
  name: 'dark' | 'light';
  colors: {
    // Canvas & surfaces
    canvasBg: string;
    surfaceBg: string;
    surfaceHover: string;
    surfaceActive: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    // Borders
    border: string;
    borderSubtle: string;

    // Accent
    accent: string;
    accentHover: string;
    accentFg: string;

    // Input
    inputBg: string;
    inputBorder: string;

    // Status
    success: string;
    warning: string;
    error: string;

    // Diff
    diffAdd: string;
    diffDel: string;
    diffAddBg: string;
    diffDelBg: string;

    // Scrollbar
    scrollbar: string;
  };
}

// Dark Islands theme (from vscode-dark-islands)
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    canvasBg: '#121216',
    surfaceBg: '#181a1d',
    surfaceHover: '#25262a',
    surfaceActive: '#2b2d30',

    textPrimary: '#bcbec4',
    textSecondary: '#7a7e85',
    textMuted: '#494c52',

    border: '#2b2d30',
    borderSubtle: '#25262a',

    accent: '#548af7',
    accentHover: '#6b9df8',
    accentFg: '#ffffff',

    inputBg: '#1e2023',
    inputBorder: '#3c3f41',

    success: '#6aab73',
    warning: '#e8bf6a',
    error: '#f75464',

    diffAdd: '#6aab73',
    diffDel: '#f75464',
    diffAddBg: 'rgba(106,171,115,0.1)',
    diffDelBg: 'rgba(247,84,100,0.1)',

    scrollbar: '#35383d',
  },
};

// Light Islands theme (light adaptation)
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    canvasBg: '#f5f5f7',
    surfaceBg: '#ffffff',
    surfaceHover: '#f0f0f2',
    surfaceActive: '#e8e8ec',

    textPrimary: '#1d1d1f',
    textSecondary: '#6e6e73',
    textMuted: '#aeaeb2',

    border: '#d1d1d6',
    borderSubtle: '#e5e5ea',

    accent: '#3478f6',
    accentHover: '#2563eb',
    accentFg: '#ffffff',

    inputBg: '#ffffff',
    inputBorder: '#d1d1d6',

    success: '#34c759',
    warning: '#ff9f0a',
    error: '#ff3b30',

    diffAdd: '#34c759',
    diffDel: '#ff3b30',
    diffAddBg: 'rgba(52,199,89,0.1)',
    diffDelBg: 'rgba(255,59,48,0.1)',

    scrollbar: '#c7c7cc',
  },
};

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme.name);
}
