import { emptyChart, type ChartData } from '../model.ts';
import { career } from './career.ts';
import { fitness } from './fitness.ts';
import { habits } from './habits.ts';
import { health } from './health.ts';
import { language } from './language.ts';
import { money } from './money.ts';
import { relationships } from './relationships.ts';
import { sideProject } from './side-project.ts';

export type Eight<T> = readonly [T, T, T, T, T, T, T, T];

export type PresetId =
	| 'language'
	| 'fitness'
	| 'career'
	| 'money'
	| 'habits'
	| 'side-project'
	| 'health'
	| 'relationships';

export type Preset = {
	id: PresetId;
	title: string;
	goal: string;
	pillars: Eight<string>;
	actions: Eight<Eight<string>>;
};

export type PresetSummary = Pick<Preset, 'id' | 'title' | 'goal' | 'pillars'>;

export const PRESETS: readonly Preset[] = [
	language,
	fitness,
	career,
	money,
	habits,
	sideProject,
	health,
	relationships
];

export function listPresets(): readonly PresetSummary[] {
	return PRESETS.map(({ id, title, goal, pillars }) => ({ id, title, goal, pillars }));
}

export function isPresetId(value: string): value is PresetId {
	return PRESETS.some((preset) => preset.id === value);
}

export function getPreset(id: string): Preset | undefined {
	return PRESETS.find((preset) => preset.id === id);
}

export function buildChart(preset: Preset): ChartData {
	const data = emptyChart();
	data.goal = preset.goal;
	data.pillars = [...preset.pillars];
	data.actions = preset.actions.map((row) => [...row]);
	return data;
}
