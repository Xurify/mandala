import { getContext, setContext } from 'svelte';

export type MenuApi = { close: () => void };

const KEY = Symbol('mandala-menu');

export function setMenu(api: MenuApi): void {
	setContext(KEY, api);
}

export function getMenu(): MenuApi | undefined {
	return getContext<MenuApi | undefined>(KEY);
}
