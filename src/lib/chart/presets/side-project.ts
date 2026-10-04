import type { Preset } from './index.ts';

export const sideProject: Preset = {
	id: 'side-project',
	title: 'Side project',
	goal: 'Launch your side project to 100 users within 6 months',
	pillars: [
		'Scope',
		'Build time',
		'Shipping',
		'User talks',
		'First-run experience',
		'Launch',
		'Distribution',
		'Momentum'
	],
	actions: [
		[
			'Write the one-sentence pitch tonight',
			'Name the first 10 people it is for',
			'List what version 1 will not do',
			'Cut one feature from the list each week',
			'Keep a one-page spec in the repo',
			'Write 5 user jobs on sticky notes',
			'Freeze features 2 weeks before launch',
			'Move new ideas to a “later” list'
		],
		[
			'Block 90 minutes on 3 weekday mornings',
			'Protect Saturday morning for the project',
			'Put the blocks on a shared calendar',
			'Close chat apps during each block',
			'Leave a note with the next block’s first task',
			'Tell one person when your next block is',
			'Skip one optional plan each week',
			'Set a start alarm 10 minutes early'
		],
		[
			'Ship one small change every build day',
			'Write a test for each bug you fix',
			'Fix the top bug before new work',
			'Push before you close the laptop',
			'Deploy to a real URL in week 2',
			'Keep a public changelog',
			'Set up error alerts before launch',
			'Demo the build to yourself every Friday'
		],
		[
			'Talk to 3 potential users by Friday',
			'Ask about the last time they had the problem',
			'Write 5 notes after each conversation',
			'Watch someone use it without helping',
			'Change one thing from last week’s notes',
			'Book the next test before you leave',
			'Send a 3-question survey after a trial',
			'Remove a feature nobody used'
		],
		[
			'Sketch the main screen on paper first',
			'Cut sign-up to one screen',
			'Write every button label as a verb',
			'Replace placeholder copy before launch',
			'Test the flow on your phone each week',
			'Ask 2 people what they expect to click',
			'Add a one-line hint to each empty screen',
			'Take a clean screenshot for the launch post'
		],
		[
			'Pick a launch date and tell 3 people',
			'Put up a waitlist page this week',
			'Draft the launch post 2 weeks ahead',
			'Record a 30-second walkthrough',
			'Test sign-up on a second device',
			'Email the waitlist on launch morning',
			'Watch errors live for the first hour',
			'Thank every early user by email'
		],
		[
			'List 10 places your users already gather',
			'Post a build update every Thursday',
			'Reply to every comment the same day',
			'Help in one community thread a week',
			'Ask 3 users if you may quote them',
			'Write up one user story a month',
			'Ask each new user where they heard of it',
			'Submit to 3 directories after launch'
		],
		[
			'Write one line you shipped each day',
			'Update the user count on a note each Sunday',
			'Share one win with a friend each week',
			'Reread a kind user quote before a block',
			'Take one full weekend off each month',
			'Join a weekly builders’ check-in',
			'Pick next week’s one goal on Friday',
			'Mark 10, 25, and 50 users with a treat'
		]
	]
};
