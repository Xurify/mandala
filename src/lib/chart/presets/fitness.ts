import type { Preset } from './index.ts';

export const fitness: Preset = {
	id: 'fitness',
	title: 'Fitness',
	goal: 'Run a half marathon in under 2:00 within 16 weeks',
	pillars: [
		'Training plan',
		'Easy miles',
		'Long runs',
		'Speed work',
		'Strength',
		'Recovery',
		'Fuel',
		'Race day'
	],
	actions: [
		[
			'Print a 16-week plan',
			'Put the week’s four runs on the calendar',
			'Log every run the same day',
			'Reschedule a missed run within 2 days',
			'Cut weekly distance by a third every 4th week',
			'Tell a friend your run days for the week',
			'Lay out run kit the night before',
			'Check progress with a 10K in week 8'
		],
		[
			'Run 3 easy runs a week at 6:30/km or slower',
			'Run Thursday and Saturday before 9 a.m.',
			'Add 5 minutes to one easy run each week',
			'Finish easy runs with 4 relaxed strides',
			'Run one easy run a week on a soft trail',
			'Walk the first 5 minutes as a warm-up',
			'Wear a heart-rate strap on one easy run',
			'Swap a missed run for a 20-minute jog'
		],
		[
			'Add 1 km to Sunday’s long run',
			'Build the long run to 18 km by week 13',
			'Run the last 3 km of a long run at race pace',
			'Plan a long-run route with water stops',
			'Start the long run before 9 a.m.',
			'Run one long run on the race course',
			'Walk 10 minutes after each long run',
			'Run one long run a month with a friend'
		],
		[
			'Run 6×400 m on Tuesdays in odd weeks',
			'Run a 20-minute tempo on even Tuesdays',
			'Warm up 10 minutes before every workout',
			'Run 3 km at race pace, 5:40/km',
			'Write each workout’s splits in the log',
			'Cool down 10 minutes after each workout',
			'Run 6×1-minute hill repeats in week 5',
			'Add one 400 every 2 weeks'
		],
		[
			'Do 20 minutes of strength twice a week',
			'Do 3 sets of single-leg squats',
			'Do calf raises while you brush your teeth',
			'Hold a 1-minute plank after easy runs',
			'Do glute bridges before Tuesday’s workout',
			'Book one session with a physio or coach',
			'Do 5 minutes of hip mobility at night',
			'Drop strength to once a week in the taper'
		],
		[
			'Take Monday fully off',
			'Be in bed by 10:30 before workouts',
			'Foam-roll 10 minutes twice a week',
			'Stretch calves and hips after each run',
			'Legs up the wall 10 minutes after Sunday',
			'Run easy, not hard, after a short night',
			'Rate soreness 1–5 in the log after runs',
			'Book a sports massage in week 10'
		],
		[
			'Eat protein at breakfast on run days',
			'Drink 500 ml of water before long runs',
			'Test one gel flavor on each long run',
			'Take a gel every 40 minutes past the hour',
			'Eat within 30 minutes of a long run',
			'Rehearse race breakfast before a long run',
			'Eat extra carbs 2 days before the race',
			'Pack run snacks the night before'
		],
		[
			'Register for the race this week',
			'Get fitted for shoes by week 2',
			'Log shoe kilometers and replace at 600',
			'Wear the race outfit on a long run',
			'Write a pacing plan for each 5 km',
			'Pack the bag and pin the bib 2 nights out',
			'Write a rain-day plan the week before',
			'Map the route to the start line'
		]
	]
};
