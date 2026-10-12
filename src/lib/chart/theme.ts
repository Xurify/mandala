import { DEFAULT_ACCENT, isAccent, type AccentId } from './accent.ts';

export type AppTheme = 'system' | 'light' | 'dark';

/** `--bg` in each theme as hex, for the browser's bar. `theme.test.ts` holds them to the tokens in `app.css`. */
export const THEME_COLORS = { light: '#f8f5f0', dark: '#15120f' } as const;

export function themeOf(value: string | null): AppTheme {
	return value === 'light' || value === 'dark' ? value : 'system';
}

export function accentOf(value: string | null): AccentId {
	return value && isAccent(value) ? value : DEFAULT_ACCENT;
}

/** Paints a theme on the page: the attribute the tokens key on, and the browser's bar, which only knows the system's. */
export function applyTheme(theme: AppTheme): void {
	const root = document.documentElement;
	if (theme === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', theme);
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		meta.content = THEME_COLORS[theme === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : theme];
	}
}

export function applyAccent(accent: AccentId): void {
	if (accent === DEFAULT_ACCENT) document.documentElement.removeAttribute('data-accent');
	else document.documentElement.setAttribute('data-accent', accent);
}

export function saveTheme(theme: AppTheme): void {
	try {
		if (theme === 'system') localStorage.removeItem('theme');
		else localStorage.setItem('theme', theme);
	} catch {
		// Blocked storage: the choice holds for this visit.
	}
}

export function saveAccent(accent: AccentId): void {
	try {
		if (accent === DEFAULT_ACCENT) localStorage.removeItem('accent');
		else localStorage.setItem('accent', accent);
	} catch {
		// Blocked storage: the choice holds for this visit.
	}
}
