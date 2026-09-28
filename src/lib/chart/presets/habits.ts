import type { Preset } from './index.ts';

export const habits: Preset = {
	id: 'habits',
	title: 'Habits',
	goal: 'Keep 5 daily habits going for 90 days straight',
	pillars: [
		'Morning routine',
		'Evening routine',
		'Tracking',
		'Environment',
		'Triggers',
		'Focus',
		'Rest',
		'Weekly review'
	],
	actions: [
		[
			'Wake at the same time on weekdays',
			'Drink a glass of water on waking',
			'Make the bed before you check mail',
			'Do 5 minutes of light stretch',
			'Write the day’s 3 tasks by 8',
			'Eat breakfast sitting down',
			'Leave the phone in another room',
			'Start the first habit within 20 minutes'
		],
		[
			"Lay tomorrow's clothes out tonight",
			'Dim lights 45 minutes before bed',
			'Write tomorrow’s first task',
			'Put devices on a charger outside',
			'Wash up before you sit down',
			'Set the alarm once, then leave it',
			'Read paper pages for 10 minutes',
			'Lights out by the time you chose'
		],
		[
			'Tick the habit tracker before bed',
			'Keep the tracker where you see it',
			'Mark a miss the same evening',
			'Never skip two days in a row',
			'Photo the tracker every Sunday',
			'Count streaks in a paper log',
			'Reset the week’s grid on Monday',
			'Show the tracker to one person'
		],
		[
			'Put tools for habits in one place',
			'Clear the table before breakfast',
			'Leave running shoes by the door',
			'Fill a water bottle at night',
			'Remove one distraction from the desk',
			'Keep a bag packed for the morning',
			'Charge devices away from the bed',
			'Set out the notebook before sleep'
		],
		[
			'Pair a habit with making tea',
			'Start after you lock the front door',
			'Use the same song as a start cue',
			'Stand up when the kettle boils',
			'Do the habit before you open mail',
			'Link floss to brushing at night',
			'Write the cue on a sticky note',
			'Practice the cue once on Sunday'
		],
		[
			'Work in 25-minute blocks twice daily',
			'Close extra tabs before a block',
			'Put the phone in a drawer',
			'Write the one task on paper first',
			'Stop the block when the timer ends',
			'Stand and stretch between blocks',
			'Do deep work before noon',
			'Log finished blocks on the tracker'
		],
		[
			'Keep one afternoon with no extra tasks',
			'Take a 10-minute walk after lunch',
			'Sit away from screens at meals',
			'Protect 8 hours in bed on weeknights',
			'Say no to one extra plan this week',
			'Nap 20 minutes if you slept short',
			'Leave the house for daylight daily',
			'Stop caffeine after 2 p.m.'
		],
		[
			'Review the tracker for 15 minutes Sunday',
			'Pick the 5 habits again each month',
			'Drop one habit that is not sticking',
			'Write what blocked you this week',
			'Plan the next 7 days on paper',
			'Celebrate 7 ticks with a small treat',
			'Ask a friend to check in Friday',
			'Reset missed days without a speech'
		]
	]
};
