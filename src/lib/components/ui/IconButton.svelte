<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from '../Icon.svelte';
	import { cn } from './cn';
	import { iconButton } from './styles';

	type Props = Omit<HTMLButtonAttributes, 'aria-label' | 'class'> & {
		icon: IconName;
		label: string;
		class?: string;
	};

	let { icon, label, class: className, type, ...rest }: Props = $props();
</script>

<button
	type={type ?? 'button'}
	aria-label={label}
	title={label}
	class={cn(iconButton(), className)}
	{...rest}
>
	<Icon name={icon} size={18} />
</button>
