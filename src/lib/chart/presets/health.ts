import type { Preset } from './index.ts';

export const health: Preset = {
	id: 'health',
	title: 'Health',
	goal: 'Sleep 7 hours, eat well, and feel calmer within 6 months',
	pillars: [
		'Sleep',
		'Meals',
		'Hydration',
		'Movement',
		'Stress',
		'Screens',
		'Checkups',
		'Wind-down'
	],
	actions: [
		[
			'Lights out by 11 on weeknights',
			'Wake within 30 minutes of the same time',
			'Keep the room dark and cool',
			'No caffeine after 2 p.m.',
			'Leave the phone outside the bedroom',
			'Get up if you cannot sleep after 20 minutes',
			'Note bedtime in a paper log',
			'Protect 8 hours in bed before a work day'
		],
		[
			'Eat breakfast sitting down',
			'Put a vegetable on the lunch plate',
			'Cook 2 simple dinners this week',
			'Shop with a written list on Sunday',
			'Eat fruit before you open snacks',
			'Plate food in the kitchen, not the sofa',
			'Stop eating 2 hours before bed',
			'Pack tomorrow’s lunch tonight'
		],
		[
			'Fill a bottle after you wake',
			'Drink a glass with each meal',
			'Keep a cup on the desk you use',
			'Tick 6 glasses on a paper strip',
			'Take a bottle when you leave home',
			'Drink water before a second coffee',
			'Refill at lunch without fail',
			'Empty the bottle before dinner'
		],
		[
			'Walk 20 minutes after lunch',
			'Stand and stretch each hour',
			'Take the stairs for 3 floors',
			'Walk a short loop after dinner',
			'Stretch 8 minutes before bed',
			'Park farther and walk the rest',
			'Do 10 slow squats while the kettle boils',
			'Put shoes by the door at night'
		],
		[
			'Breathe slowly for 4 minutes at noon',
			'Write 3 worries, then close the page',
			'Step outside for 5 minutes when tense',
			'Name one thing you can drop this week',
			'Call a friend instead of scrolling',
			'Sit quietly before you answer mail',
			'Leave one meeting-free hour daily',
			'Stop work at the time you wrote down'
		],
		[
			'No screens in the last 45 minutes',
			'Charge devices in another room',
			'Turn off one extra notification tonight',
			'Use greyscale after 9 p.m.',
			'Leave the phone in a drawer at meals',
			'Set an app timer for 30 minutes',
			'Keep one evening with no video',
			'Check mail at 3 set times only'
		],
		[
			'Book a checkup this month',
			'Write the date on the calendar',
			'List questions the night before',
			'Bring a current medicine list',
			'Book the dentist if it is overdue',
			'Pick up any forms the same week',
			'Put results in one folder',
			'Set a reminder for the next visit'
		],
		[
			'Dim lights after dinner',
			'Read paper pages for 10 minutes',
			'Make tea and sit without a screen',
			'Stretch on the floor before bed',
			'Write tomorrow’s first task only',
			'Wash up so morning is clear',
			'Play quiet audio or none at all',
			'Start the wind-down at a set clock time'
		]
	]
};
