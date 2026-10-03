import { tv } from 'tailwind-variants';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export const button = tv({
	base: `inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 font-sans font-[560] tracking-[-0.005em] whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 ease-ui active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none`,
	variants: {
		variant: {
			primary: 'bg-ink text-on-ink shadow-press hover:bg-ink-hover focus-visible:bg-ink-hover',
			soft: 'bg-soft text-text hover:bg-soft-hover focus-visible:bg-soft-hover',
			ghost: 'bg-transparent text-muted hover:bg-sunken hover:text-text focus-visible:bg-sunken focus-visible:text-text dark:hover:bg-soft dark:focus-visible:bg-soft',
			danger:
				'bg-transparent text-danger hover:bg-danger-wash focus-visible:bg-danger-wash'
		},
		size: {
			md: 'min-h-[42px] px-[18px] text-[0.9rem]',
			sm: 'min-h-[34px] gap-1.5 px-3.5 text-[0.84rem]'
		}
	},
	defaultVariants: { variant: 'primary', size: 'md' }
});

export const iconButton = tv({
	base: `relative inline-flex size-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-text transition-[background-color,transform] duration-150 ease-ui hover:bg-sunken aria-expanded:bg-sunken active:scale-[0.94] ${focus}`
});

export const segmented = tv({
	slots: {
		group: 'relative inline-flex w-fit gap-0.5 self-start rounded-full bg-sunken p-[3px]',
		option: `relative z-[1] inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent font-sans font-[560] text-muted transition-[color,transform] duration-150 ease-ui hover:text-text active:scale-[0.96] aria-pressed:text-text ${focus}`
	},
	variants: {
		size: {
			md: { option: 'min-h-[34px] px-4 text-[0.86rem]' },
			sm: { option: 'min-h-7 gap-[5px] px-[11px] text-[0.76rem] coarse:min-h-[34px]' }
		}
	},
	defaultVariants: { size: 'md' }
});

export const menu = tv({
	slots: {
		wrap: 'relative flex',
		trigger: 'relative z-50 w-full',
		backdrop: 'fixed inset-0 z-[49] cursor-default border-0 bg-transparent p-0',
		panel:
			'absolute top-[calc(100%+8px)] z-50 flex max-h-[min(70dvh,32rem)] min-w-[min(290px,calc(100vw-32px))] flex-col gap-px overflow-y-auto overscroll-contain rounded-[20px] bg-surface p-1.5 shadow-float motion-safe:animate-menu'
	},
	variants: {
		align: {
			end: { panel: 'end-0 origin-top-right' },
			start: { panel: 'start-0 min-w-[min(340px,calc(100vw-32px))] origin-top-left' }
		}
	},
	defaultVariants: { align: 'end' }
});

export const menuItem = tv({
	slots: {
		base: 'group flex w-full min-h-[42px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border-0 bg-transparent px-3 py-2 text-start font-sans text-[0.9rem] font-medium text-text hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none coarse:min-h-[46px] coarse:text-[0.94rem]',
		main: 'inline-flex min-w-0 items-center gap-3',
		icon: 'shrink-0 text-muted',
		badge:
			'shrink-0 rounded-[7px] bg-sunken px-[7px] py-px text-[0.72rem] font-[560] text-muted tabular-nums group-hover:bg-surface group-focus-visible:bg-surface'
	},
	variants: {
		tone: {
			default: {},
			danger: {
				base: 'text-danger hover:bg-danger-wash focus-visible:bg-danger-wash',
				icon: 'text-danger'
			}
		},
		active: {
			true: { base: 'bg-sunken', badge: 'bg-surface' },
			false: {}
		}
	},
	defaultVariants: { tone: 'default', active: false }
});

export const dialog = tv({
	slots: {
		panel:
			'm-auto overflow-hidden rounded-[30px] border-0 bg-surface p-0 text-text shadow-float outline-none open:flex open:flex-col open:motion-safe:animate-dialog dialog-backdrop print:hidden',
		sheet: 'flex min-h-0 max-h-full flex-col overflow-hidden',
		head: 'flex items-start justify-between gap-3 pt-[22px] pr-4 pb-2.5 pl-[26px]',
		title:
			'm-0 mt-1 font-serif text-[1.6rem] font-[480] leading-[1.15] tracking-[-0.02em] text-balance text-text',
		body: 'min-h-0 flex-1 overflow-auto overscroll-contain pt-2.5 pr-3.5 pb-[26px] pl-[26px] text-[0.95rem] text-pretty scrollbar-gutter-stable',
		sub: 'm-0 mt-1 font-sans text-[0.88rem] leading-[1.4] font-normal tracking-normal text-pretty text-muted',
		foot: 'flex items-center justify-end gap-2 px-[26px] pb-[22px]'
	},
	variants: {
		size: {
			md: { panel: 'w-[min(38rem,calc(100vw-32px))] max-h-[min(86dvh,740px)]' },
			sm: { panel: 'w-[min(34rem,calc(100vw-32px))] max-h-[min(80dvh,660px)]' }
		},
		footer: {
			true: { body: 'pb-3' },
			false: {}
		}
	},
	defaultVariants: { size: 'md', footer: false }
});

export const dock = tv({
	slots: {
		wrap: 'pointer-events-none fixed inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom,18px))] z-40 flex flex-col items-center gap-2.5 px-4 print:hidden',
		bar: 'pointer-events-auto flex gap-1 rounded-full bg-[color-mix(in_oklch,var(--surface)_84%,transparent)] p-[5px] shadow-float backdrop-blur-[18px] backdrop-saturate-150'
	}
});

export const dockTab = tv({
	base: `inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-5 font-sans text-[0.9rem] font-[560] text-muted transition-[background-color,color,transform] duration-[180ms] ease-ui hover:bg-sunken hover:text-text active:scale-[0.96] aria-selected:bg-ink aria-selected:text-on-ink max-[900px]:px-[22px] ${focus}`
});

export const toast = tv({
	base: 'pointer-events-none max-w-[min(520px,100%)] rounded-[18px] bg-ink text-center text-[0.88rem] font-medium text-pretty text-on-ink shadow-float transition-[opacity,transform] duration-200 ease-ui',
	variants: {
		on: {
			true: 'translate-y-0 scale-100 px-[18px] py-2.5 opacity-100',
			false: 'translate-y-2 scale-[0.98] p-0 opacity-0'
		}
	},
	defaultVariants: { on: false }
});

export const notice = tv({
	base: 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-[22px] bg-surface py-3 pr-3 pl-5 text-[0.9rem] text-muted shadow-card print:hidden'
});

export const eyebrow = tv({
	base: 'm-0 inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase'
});

export const card = tv({
	base: 'rounded-[22px] bg-surface p-5 shadow-card'
});
