import type { CoachBrief } from './draft.ts';

export type CoachFixture = {
	name: string;
	brief: CoachBrief;
	reply: string;
};

const clean = {
	goal: 'Finish a half marathon this October',
	pillars: ['Easy runs', 'Speed', 'Long run', 'Strength', 'Sleep', 'Food', 'Shoes', 'Calendar'],
	actions: [
		['Run 30 minutes Tuesday', 'Run 30 minutes Thursday', 'Keep the pace easy', 'Walk the hills', 'Log the run after', 'Leave shoes by the door', 'Same route each week', 'Stop if the knee twinges'],
		['8 strides after Thursday', 'One tempo of 15 minutes', 'Time the tempo', 'Recover with a walk', 'Skip strides if sore', 'Note the pace after', 'Same park loop', 'End at the same corner'],
		['Long run on Sunday', 'Add 5 minutes each week', 'Start at 40 minutes', 'Walk one minute each mile', 'Carry water', 'Eat before leaving', 'Same morning hour', 'Stop at 90 minutes'],
		['Squat twice a week', 'Two sets of 8', 'Calf raise after', 'Hip hinge after', 'Rest a day between', 'Use a chair if needed', 'Ten minutes only', 'Stop if the knee swells'],
		['Lights out at 10', 'Phone in the kitchen', 'Same wake time', 'No coffee after 2', 'Nap 20 minutes if short', 'Dark room', 'Same bedtime alarm', 'Wind down with a book'],
		['Breakfast before the run', 'Protein at lunch', 'Fruit with breakfast', 'Water on the desk', 'Snack after the long run', 'Cook Sunday dinner', 'Same grocery list', 'Eat within an hour after'],
		['Rotate two pairs', 'Replace at 400 miles', 'Leave the pair by the door', 'Check the tread monthly', 'Tie them before the alarm', 'Dry them after rain', 'Same socks each run', 'Note the mileage'],
		['Block Sunday on Sunday', 'Block Tuesday night', 'Block Thursday night', 'Protect the long run', 'Move a run, do not skip', 'Tell the house the plan', 'Look at the week on Sunday', 'One rest day marked']
	]
};

export const coachFixtures: readonly CoachFixture[] = [
	{
		name: 'clean chart',
		brief: {
			direction: 'Finish a half marathon',
			timeline: 'October',
			situation: 'Runs twice a week',
			focus: 'Keep the knee calm',
			constraint: 'A bad knee'
		},
		reply: JSON.stringify(clean)
	},
	{
		name: 'not json',
		brief: {
			direction: 'Learn enough Japanese to travel',
			timeline: 'One year',
			situation: 'Knows hiragana',
			focus: 'Speaking',
			constraint: 'Twenty minutes a day'
		},
		reply: 'Here is a thoughtful plan for your trip, with lots of ideas to consider.'
	},
	{
		name: 'fails the tests',
		brief: {
			direction: 'Grow a video channel',
			timeline: 'This year',
			situation: 'Posted once',
			focus: 'A weekly video',
			constraint: 'Evenings only'
		},
		reply: JSON.stringify({
			goal: 'A weekly video this year',
			pillars: ['Posting', 'Ideas', 'Edit', 'Titles', 'Gear', 'Schedule', 'Review', 'Rest'],
			actions: [
				['Posting', 'Stay positive', 'Work hard', 'Be successful', 'Do better', 'Get 10 million views', 'Posting', 'Film one video'],
				['Write 5 titles', 'Pick one title', 'Save the rest', 'Ask a friend', 'Cut the weak one', 'Read it aloud', 'File the notes', 'Stop at five'],
				['Cut the video Tuesday', 'Export at night', 'Watch it once', 'Trim the open', 'Add captions', 'Save the project', 'One hour only', 'Stop at the mark'],
				['Write the title first', 'Name the viewer', 'Cut extra words', 'Read it aloud', 'Keep it one line', 'Save three options', 'Pick before filming', 'File the losers'],
				['Charge the camera', 'Clear the desk', 'Same lamp', 'Check the mic', 'Spare battery', 'Lens cloth', 'Cables in the drawer', 'Test the frame'],
				['Film on Wednesday', 'Edit on Thursday', 'Post on Friday', 'Block the hour', 'Same evening', 'Phone on silent', 'One video only', 'Mark it done'],
				['Watch the last video', 'Note one fix', 'Apply it next', 'Skip the comments', 'Ten minutes only', 'Write the note', 'File the note', 'Stop there'],
				['One evening off', 'Walk after dinner', 'Stretch ten minutes', 'Lights out at 11', 'No edit on Sunday', 'Breakfast before noon', 'Leave the camera', 'Mark the rest day']
			]
		})
	}
];
