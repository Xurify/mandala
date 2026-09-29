import { emptyChart, type ChartData } from './model.ts';

type Eight<T> = readonly [T, T, T, T, T, T, T, T];

/** Read-only sample. Pillar order is grid order: TL, T, TR, L, R, BL, B, BR. */
export const example = {
	goal: 'more organized life',
	pillars: [
		'Health',
		'Career',
		'Money',
		'People',
		'Learning',
		'Home',
		'Creativity',
		'Routine'
	],
	actions: [
		[
			'Sleep 7-8 hrs',
			'Morning walk',
			'Meal prep',
			'Drink water',
			'Stretch daily',
			'No junk food',
			'Annual checkup',
			'Reduce alcohol'
		],
		[
			'Deep work',
			'New skill',
			'Build portfolio',
			'1:1 meetings',
			'Side project',
			'Read industry',
			'Network monthly',
			'Track wins'
		],
		[
			'Monthly budget',
			'Save 20%',
			'No impulse buys',
			'Track expenses',
			'Emergency fund',
			'Invest monthly',
			'Learn finance',
			'Cut subs'
		],
		[
			'Family calls',
			'Date nights',
			'Listen more',
			'Be present',
			'Celebrate others',
			'Make friends',
			'Resolve issues',
			'Write letters'
		],
		[
			'1 book/month',
			'Take a course',
			'Practice daily',
			'Learn language',
			'Watch lectures',
			'Teach others',
			'Take notes',
			'Review weekly'
		],
		[
			'Declutter',
			'Deep clean',
			'Fix things',
			'Organize spaces',
			'Cozy corner',
			'No screens',
			'Plants & light',
			'Seasonal reset'
		],
		[
			'Write daily',
			'Try new hobby',
			'Visit gallery',
			'Make something',
			'Journal weekly',
			'Screen-free hr',
			'Share your work',
			'Take photos'
		],
		[
			'Wake up 6:30',
			'Morning ritual',
			'Plan the day',
			'Wind-down',
			'Weekly review',
			'Same bedtime',
			'Phone off 10pm',
			'Evening walk'
		]
	]
} as const satisfies {
	goal: string;
	pillars: Eight<string>;
	actions: Eight<Eight<string>>;
};

export function exampleChart(): ChartData {
	const data = emptyChart();
	data.goal = example.goal;
	data.pillars = [...example.pillars];
	data.actions = example.actions.map((row) => [...row]);
	return data;
}
