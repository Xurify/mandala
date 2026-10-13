import { emptyChart, type ChartData } from '../model.ts';
import { career } from './career.ts';
import { fitness } from './fitness.ts';
import { health } from './health.ts';
import { language, languageConversation, languageExam, languageFamily, languageMoving } from './language.ts';
import { money } from './money.ts';
import { music } from './music.ts';
import { relationships } from './relationships.ts';
import { sideProject } from './side-project.ts';
import { study } from './study.ts';
import { writing } from './writing.ts';

export type Eight<T> = readonly [T, T, T, T, T, T, T, T];

export type PresetId =
	| 'language'
	| 'language-conversation'
	| 'language-exam'
	| 'language-moving'
	| 'language-family'
	| 'fitness'
	| 'career'
	| 'money'
	| 'study'
	| 'side-project'
	| 'health'
	| 'relationships'
	| 'writing'
	| 'music';

export type Preset = {
	id: PresetId;
	/** The preset this one is another goal of. It stays out of the main list and shows as a choice under that one. */
	group?: PresetId;
	/** The goal's short name among its group's choices. */
	variant?: string;
	title: string;
	goal: string;
	pillars: Eight<string>;
	actions: Eight<Eight<string>>;
};

export type PresetSummary = Pick<Preset, 'id' | 'title' | 'goal' | 'pillars'>;

export const PRESETS: readonly Preset[] = [
	language,
	languageConversation,
	languageExam,
	languageMoving,
	languageFamily,
	fitness,
	career,
	money,
	study,
	sideProject,
	health,
	relationships,
	writing,
	music
];

export function listPresets(): readonly PresetSummary[] {
	return PRESETS.filter((preset) => !preset.group).map(({ id, title, goal, pillars }) => ({ id, title, goal, pillars }));
}

export function getPreset(id: string): Preset | undefined {
	return PRESETS.find((preset) => preset.id === id);
}

/** The preset and every other goal in its group, the main one first. */
export function goalsOf(id: PresetId): readonly Preset[] {
	const root = getPreset(id)?.group ?? id;
	return PRESETS.filter((preset) => preset.id === root || preset.group === root);
}

export function buildChart(preset: Preset): ChartData {
	const data = emptyChart();
	data.goal = preset.goal;
	data.pillars = [...preset.pillars];
	data.actions = preset.actions.map((row) => [...row]);
	return data;
}
