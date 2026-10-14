import type { Preset } from './index.ts';

export const language: Preset = {
	id: 'language',
	title: 'Language',
	variant: 'General',
	goal: 'Reach B1 in your target language within 12 months',
	pillars: [
		'Speaking',
		'Listening',
		'Vocabulary',
		'Pronunciation',
		'Reading',
		'Grammar',
		'Routine',
		'Confidence'
	],
	actions: [
		[
			'Talk to yourself for 5 minutes after dinner',
			'Record a 1-minute voice note each day',
			'Retell a video you watched in 3 sentences',
			'Join a weekly speaking club',
			'Sign up for a language exchange app',
			'Book a trial lesson with a tutor',
			'Schedule two 30-minute conversations a week',
			'Pick a topic before each conversation'
		],
		[
			'Listen to a learner podcast at breakfast',
			'Shadow a 2-minute clip after lunch',
			'Listen to 30 minutes of audio on your commute',
			'Switch subtitles to the language',
			'Watch one episode of a show each Friday',
			'Transcribe 1 minute of audio each week',
			'Rewatch one scene until you catch every word',
			'Listen without the transcript, then with it'
		],
		[
			'List 30 phrases you use on a normal day',
			'Save new words while you read or listen',
			'Reread yesterday’s text to see its words again',
			'Learn the words for your job and hobbies',
			'Look up words you hear 3 times',
			'Save new words from each conversation',
			'Learn 5 ways to ask someone to repeat',
			'Guess a word from context before looking it up'
		],
		[
			'Drill your 3 hardest sounds for 5 minutes',
			'Record a sentence and compare it to the audio',
			'Shadow one speaker’s intonation for a minute',
			'Read a short text out loud each morning',
			'Practice word stress on 10 long words',
			'Learn the minimal pairs for your hardest sound',
			'Ask your tutor to correct one sound per session',
			'List words people asked you to repeat'
		],
		[
			'Read one graded reader a week',
			'Read a graded reader with its audio',
			'Move up a level after 3 graded readers',
			'Read one article on a news site for learners',
			'Read 15 minutes of something you enjoy',
			'Read 10 minutes without a dictionary',
			'Read a short story for learners each weekend',
			'Pick a novel to finish by month 12'
		],
		[
			'Learn one grammar point each week',
			'Write 5 sentences with this week’s grammar point',
			'Use this week’s grammar point in a voice note',
			'Drill past tense verbs for 10 minutes',
			'Practice turning statements into questions',
			'Ask your tutor about a mistake you repeat',
			'Keep a one-page grammar cheat sheet',
			'Skim a grammar summary once a month'
		],
		[
			'Study at the same time every day',
			'Set a daily reminder to study',
			'Track study days on a paper calendar',
			'Study for 10 minutes on your busiest days',
			'Do a 20-minute catch-up after a missed day',
			'Plan next week’s study on Sunday',
			'Switch your phone to the language',
			'Take a level test every 3 months'
		],
		[
			'Speak first on every call',
			'Ask “How do you say…?” instead of switching',
			'Keep talking through one mistake per call',
			'Write one thing that went well after each call',
			'Send a voice message instead of a text',
			'Post one voice note in a learner group',
			'Keep speaking when people switch to English',
			'Compare your first voice note to your latest'
		]
	]
};

export const languageConversation: Preset = {
	id: 'language-conversation',
	group: 'language',
	title: 'Language',
	variant: 'Conversation',
	goal: 'Hold a 20-minute conversation in the language in 6 months',
	pillars: [
		'Listening',
		'Vocabulary',
		'Speaking',
		'Conversations',
		'Pronunciation',
		'Grammar',
		'Routine',
		'Confidence'
	],
	actions: [
		[
			'Listen to a learner podcast at breakfast',
			'Shadow a 2-minute clip after lunch',
			'Listen without the transcript, then with it',
			'Listen to 30 minutes of audio on your commute',
			'Transcribe 1 minute of audio each week',
			'Rewatch one scene until you catch every word',
			'Watch one episode of a show each Friday',
			'Listen to audio while you do the dishes'
		],
		[
			'List 30 phrases you use on a normal day',
			'Learn 10 words for topics you talk about',
			'Reuse 3 new words in your next conversation',
			'Learn 5 ways to ask someone to repeat',
			'Learn 5 filler phrases that buy thinking time',
			'Learn the words for your job and hobbies',
			'Read 15 minutes of something you enjoy',
			'Save new words from each conversation'
		],
		[
			'Talk to yourself for 5 minutes after dinner',
			'Record a 1-minute voice note each day',
			'Describe your day out loud before bed',
			'Retell a video you watched in 3 sentences',
			'Answer 5 questions about yourself out loud',
			'Prepare a 2-minute story about your week',
			'Narrate what you’re doing while you cook',
			'Replay a voice note and fix one sentence'
		],
		[
			'Join a weekly speaking club',
			'Sign up for a language exchange app',
			'Message 3 exchange partners this week',
			'Book a trial lesson with a tutor',
			'Schedule two 30-minute conversations a week',
			'Pick a topic before each conversation',
			'Book the next session before you hang up',
			'Hold a 20-minute conversation by month 5'
		],
		[
			'Drill your 3 hardest sounds for 5 minutes',
			'Record a sentence and compare it to the audio',
			'Ask your tutor to correct one sound per session',
			'Practice word stress on 10 long words',
			'Shadow one speaker’s intonation for a minute',
			'Read a short text out loud each morning',
			'Learn the minimal pairs for your hardest sound',
			'List words people asked you to repeat'
		],
		[
			'Learn one grammar point each week',
			'Write 5 sentences with this week’s grammar point',
			'Use this week’s grammar point in a voice note',
			'Drill past tense verbs for 10 minutes',
			'Practice turning statements into questions',
			'Ask your tutor about a mistake you repeat',
			'Keep a one-page grammar cheat sheet',
			'Rewrite 3 sentences your tutor corrected'
		],
		[
			'Set a daily reminder to study',
			'Study at the same time every day',
			'Track study days on a paper calendar',
			'Study for 10 minutes on your busiest days',
			'Do a 20-minute catch-up after a missed day',
			'Plan next week’s study on Sunday',
			'Tell a friend your goal and deadline',
			'Switch your phone to the language'
		],
		[
			'Speak first on every call',
			'Ask “How do you say…?” instead of switching',
			'Write one thing that went well after each call',
			'Send a voice message instead of a text',
			'Keep talking through one mistake per call',
			'Ask your partner to correct your mistakes',
			'Post one voice note in a learner group',
			'Compare your first voice note to your latest'
		]
	]
};

export const languageExam: Preset = {
	id: 'language-exam',
	group: 'language',
	title: 'Language',
	variant: 'Exam',
	goal: 'Pass a B2 exam in the language by June',
	pillars: [
		'The exam',
		'Practice tests',
		'Listening',
		'Reading',
		'Writing',
		'Speaking',
		'Grammar',
		'Test day'
	],
	actions: [
		[
			'Book your exam date',
			'Read the official marking criteria',
			'List each section and its time limit',
			'Learn what each score band requires',
			'Read 3 sample answers that passed',
			'Check what to bring on exam day',
			'Set a target score for each section',
			'Build a study plan back from the exam date'
		],
		[
			'Do one timed practice test every Saturday',
			'Score each test with the answer key',
			'Collect 10 past exam papers',
			'Track your score for each section',
			'Redo your lowest-scoring section',
			'Take a full practice test in month 1',
			'Review every wrong answer on Sunday',
			'Save the most recent past paper for last'
		],
		[
			'Do 2 timed listening tasks a day',
			'Replay the questions you got wrong',
			'Read the questions before the audio starts',
			'Listen to the news for 15 minutes a day',
			'Practice taking notes while you listen',
			'Listen to the accents used in the exam',
			'Transcribe one exam recording a week',
			'Listen at full speed only from month 3'
		],
		[
			'Read one opinion article a day',
			'Time yourself on one reading task a day',
			'Skim an article for the main idea in 2 minutes',
			'Learn the common trick questions',
			'Underline the evidence for each answer',
			'Read one long-form article a week',
			'Learn 10 linking words a week',
			'Summarize an article in 3 sentences'
		],
		[
			'Write one 250-word essay a week',
			'Get one essay marked by a teacher each week',
			'Learn a template for each writing task',
			'Write under exam time limits',
			'Learn 20 phrases for giving opinions',
			'Rewrite each marked essay with the corrections',
			'Hit the word count on every task',
			'Proofread with a checklist of your mistakes'
		],
		[
			'Practice the 2-minute talk on a timer',
			'Do a mock speaking test with a tutor',
			'Record answers to 10 sample questions',
			'Learn phrases to agree and disagree',
			'Learn phrases that buy you thinking time',
			'Describe a photo out loud for 1 minute',
			'Listen back and count your filler words',
			'Do a mock test with a new examiner in month 5'
		],
		[
			'List the grammar mistakes from marked work',
			'Drill your most common mistake for 10 minutes',
			'Study the grammar list for your level',
			'Do 20 grammar exercises a day',
			'Write 5 sentences for each weak point',
			'Retest your top 5 mistakes each month',
			'Practice the 3 tenses you avoid',
			'Keep a one-page error log'
		],
		[
			'Take a full mock exam at the real exam time',
			'Plan your route to the test center',
			'Pack your ID and pens the night before',
			'Sleep 8 hours every night of exam week',
			'Stop learning new material 3 days before',
			'Do a 10-minute listening warm-up that morning',
			'Visit the test center a week before',
			'Plan something fun for after the exam'
		]
	]
};

export const languageMoving: Preset = {
	id: 'language-moving',
	group: 'language',
	title: 'Language',
	variant: 'Moving abroad',
	goal: 'Handle daily life in the language within a year of moving',
	pillars: [
		'Errands',
		'Phone calls',
		'Paperwork',
		'Neighbors',
		'Work',
		'Listening',
		'Getting around',
		'Confidence'
	],
	actions: [
		[
			'Do your weekly grocery shop in the language',
			'Ask a store clerk one question each trip',
			'Learn the words on your receipts',
			'Order at a café without pointing',
			'Return or exchange one item in the language',
			'Learn the words for common pharmacy items',
			'Get a haircut in the language',
			'Ask for prices instead of reading the tag'
		],
		[
			'Script and make one phone call a week',
			'Book a doctor’s appointment by phone',
			'Practice spelling your name out loud',
			'Practice saying your address and phone number',
			'Call a store to ask about opening hours',
			'Leave one voicemail in the language',
			'Answer unknown numbers in the language',
			'Write down useful phrases after each call'
		],
		[
			'Fill in one form without a translator',
			'Read your mail before translating it',
			'Learn 30 words from official letters',
			'Email an office in the language',
			'Read the key sections of your lease',
			'Learn the words on your pay stub',
			'Keep a glossary of paperwork words',
			'Send one written question to a local office'
		],
		[
			'Learn 5 neighbors’ names',
			'Greet your neighbors by name',
			'Join one local club or class',
			'Learn 5 small-talk openers',
			'Ask a neighbor for a local recommendation',
			'Invite a neighbor for coffee',
			'Go to one local event a month',
			'Chat with the same shopkeeper every week'
		],
		[
			'List 30 words you use at work',
			'Describe your job in 3 sentences',
			'Introduce yourself to coworkers in the language',
			'Read one industry article a week',
			'Learn the names of your work tools',
			'Write one work email a week in the language',
			'Prepare 3 sentences before each meeting',
			'Speak the language at lunch with coworkers'
		],
		[
			'Listen to local radio at breakfast',
			'Watch the local news once a week',
			'Listen to announcements on public transport',
			'Learn 10 words of the local dialect',
			'Follow one local podcast',
			'Write down 3 phrases you overhear each day',
			'Watch one local TV show a week',
			'Go to one local talk or reading a month'
		],
		[
			'Ask for directions once a week',
			'Read transit signs out loud',
			'Buy tickets at the counter, not the machine',
			'Learn the words for delays and cancellations',
			'Ask the driver which stop to get off at',
			'Learn the street names in your neighborhood',
			'Try a new route and ask the way once',
			'Learn how to report a lost item'
		],
		[
			'Keep speaking when people switch to English',
			'Ask people to slow down instead of switching',
			'Say “I’m still learning” and keep going',
			'Write one thing that went well each day',
			'Make the phone call you’ve been putting off',
			'Run one errand without a translator app',
			'Ask a friend to correct you once a week',
			'Join a conversation group for newcomers'
		]
	]
};

export const languageFamily: Preset = {
	id: 'language-family',
	group: 'language',
	title: 'Language',
	variant: 'Family',
	goal: 'Talk with your grandparents for 30 minutes in their language',
	pillars: [
		'Vocabulary',
		'Listening',
		'Family stories',
		'Calls',
		'Traditions',
		'Pronunciation',
		'Family support',
		'Confidence'
	],
	actions: [
		[
			'Learn the word for every relative',
			'Learn 20 words used at the dinner table',
			'Learn the family nicknames and what they mean',
			'Learn 10 words for feelings',
			'Learn the greetings your grandparents use',
			'Learn 10 words about their hometown',
			'Ask for one new word on every call',
			'Keep a notebook of family words'
		],
		[
			'Record your grandparent telling a story',
			'Listen to old voice messages from them',
			'Replay one recording each week',
			'Transcribe 5 lines of their speech',
			'Write down sayings they repeat',
			'Listen to music from their youth',
			'Watch a movie from their country',
			'Ask them to send you a voice note each week'
		],
		[
			'Ask about their childhood on each call',
			'Write down one story they tell you',
			'Ask how they met',
			'Go through old photos together',
			'Ask about the town they grew up in',
			'Learn one story well enough to retell it',
			'Draw a family tree in their language',
			'Ask about one family tradition'
		],
		[
			'Call every Sunday at the same time',
			'Speak their language for the first 5 minutes',
			'Write 3 questions before each call',
			'Add 5 minutes to the call each month',
			'Write down new words after each call',
			'Plan a visit this year',
			'Send a text in their language midweek',
			'Set the next call before you hang up'
		],
		[
			'Cook a family recipe with them on a video call',
			'Learn the words for one family holiday',
			'Write down a family recipe in their language',
			'Learn a song they sing at family gatherings',
			'Learn the toast they give at dinner',
			'Learn the names of their signature dishes',
			'Help plan a family event in the language',
			'Ask them to teach you a card game'
		],
		[
			'Copy how they say 5 everyday words',
			'Record yourself and play it for them',
			'Practice sounds your first language lacks',
			'Drill your 3 hardest sounds for 5 minutes',
			'Say their names the way they do',
			'Shadow one of their recordings each week',
			'Ask them which words you mispronounce',
			'Read a short text out loud each morning'
		],
		[
			'Ask a cousin to text you in the language',
			'Ask a parent to speak it at one meal a week',
			'Find a relative to practice with weekly',
			'Start a family group chat in the language',
			'Ask a parent to explain one phrase a week',
			'Ask relatives which phrases they use most',
			'Practice with a sibling before each call',
			'Ask a parent to join your first few calls'
		],
		[
			'Let them correct you without switching',
			'Tell them you’re learning and why',
			'Speak first on every call',
			'Ask “How do you say…?” instead of switching',
			'Write one thing that went well after each call',
			'Keep talking through one mistake per call',
			'Send a voice note without re-recording it',
			'Ask them to speak a little slower'
		]
	]
};
