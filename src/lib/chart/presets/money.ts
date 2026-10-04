import type { Preset } from './index.ts';

export const money: Preset = {
	id: 'money',
	title: 'Money',
	goal: 'Build a 3-month emergency fund within 12 months',
	pillars: [
		'Target',
		'Budget',
		'Auto-save',
		'Spending leaks',
		'Fixed bills',
		'Extra income',
		'Windfalls',
		'Weekly check-in'
	],
	actions: [
		[
			'Add up one month of essential costs',
			'Multiply by 3 and write the target down',
			'Split the target into 12 monthly amounts',
			'Decide what counts as an emergency',
			'Draw a progress bar and fill it in monthly',
			'Recheck the target every 3 months',
			'Tell one person your target date',
			'Pick a first milestone of one month saved'
		],
		[
			'Write next month’s budget on the 25th',
			'List every recurring cost tonight',
			'Give every dollar a job before payday',
			'Set a weekly cap for food and fun',
			'Log spending in the sheet every evening',
			'Keep one line for fun money',
			'Compare budget to actual at month end',
			'Split yearly costs into monthly pieces'
		],
		[
			'Open a separate savings account this week',
			'Name the account “Emergency fund”',
			'Set a transfer for the morning of payday',
			'Start at 10% of each paycheck',
			'Raise the transfer 1% every 3 months',
			'Round up card purchases into savings',
			'Take the savings card out of your wallet',
			'Keep the fund at a different bank'
		],
		[
			'Cancel one unused subscription today',
			'Wait 48 hours before any want over $50',
			'Pack lunch 4 days a week',
			'Delete saved cards from shopping sites',
			'Unsubscribe from 5 store emails',
			'Cook at home 5 nights a week',
			'Shop for groceries with a written list',
			'Pay cash for eating out for one month'
		],
		[
			'List every bill with its due date',
			'Call one provider a month for a lower rate',
			'Compare insurance quotes this quarter',
			'Switch to a cheaper phone plan',
			'Set autopay for every fixed bill',
			'Get one quote for cheaper energy',
			'Set a reminder 3 days before each due date',
			'Recheck every bill every 6 months'
		],
		[
			'Ask for a raise review this quarter',
			'List 3 skills someone would pay for',
			'Sell 5 things you no longer use',
			'Take one paid side task a month',
			'Send invoices the day work ends',
			'Track side income on its own line',
			'Ask about paid overtime this month',
			'Move all side income straight to the fund'
		],
		[
			'Save half of every tax refund',
			'Move half of any bonus to the fund',
			'Bank gift money the day it arrives',
			'Save the amount each cut bill frees up',
			'Deposit cash-back rewards monthly',
			'Save the first month of any raise',
			'Put loose cash in the fund every Friday',
			'Save money back from returns the same day'
		],
		[
			'Check balances every Sunday for 15 minutes',
			'Write one money win each week',
			'Look at next week’s bills and plans',
			'Plan the week’s spending in 5 minutes',
			'Share progress with a partner or friend',
			'Pick one leak to fix next week',
			'Mark each $500 saved with a free treat',
			'Move leftover budget to the fund'
		]
	]
};
