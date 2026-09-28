import { describe, expect, it } from 'vitest';
import { ACTION_MAX, GOAL_MAX, PILLAR_MAX } from './draft.ts';
import { exportJson, exportText, filledCount, hasContent, parseChart } from './model.ts';
import {
	PRESETS,
	buildChart,
	getPreset,
	isPresetId,
	listPresets,
	type PresetId
} from './presets/index.ts';

const PRESET_IDS: PresetId[] = [
	'language',
	'fitness',
	'career',
	'money',
	'habits',
	'side-project',
	'health',
	'relationships'
];

const LANGUAGE_LOCK =
	/\b(japanese|jlpt|kanji|kana|hiragana|katakana|romaji|chinese|hsk|korean|hangul|spanish|french|german|pinyin)\b/i;

function allActions(preset: (typeof PRESETS)[number]): string[] {
	return preset.actions.flatMap((row) => [...row]);
}

describe('presets', () => {
	it('registers eight unique ids in the declared order', () => {
		expect(PRESETS.map((preset) => preset.id)).toEqual(PRESET_IDS);
		expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(8);
		expect(listPresets().map((summary) => summary.id)).toEqual(PRESET_IDS);
	});

	it('fills every cell within draft caps and unique labels', () => {
		for (const preset of PRESETS) {
			expect(preset.goal.trim()).not.toBe('');
			expect(preset.goal.length).toBeLessThanOrEqual(GOAL_MAX);
			expect(preset.goal).toBe(preset.goal.trim());
			expect(preset.pillars).toHaveLength(8);
			expect(preset.actions).toHaveLength(8);

			const pillarKeys = preset.pillars.map((pillar) => pillar.trim().toLowerCase());
			expect(pillarKeys.every(Boolean)).toBe(true);
			expect(new Set(pillarKeys).size).toBe(8);
			for (const pillar of preset.pillars) {
				expect(pillar).toBe(pillar.trim());
				expect(pillar.length).toBeLessThanOrEqual(PILLAR_MAX);
			}

			const actions = allActions(preset);
			expect(actions).toHaveLength(64);
			const actionKeys = actions.map((action) => action.trim().toLowerCase());
			expect(actionKeys.every(Boolean)).toBe(true);
			expect(new Set(actionKeys).size).toBe(64);
			for (const action of actions) {
				expect(action).toBe(action.trim());
				expect(action.length).toBeLessThanOrEqual(ACTION_MAX);
			}
		}
	});

	it('builds an isolated full chart', () => {
		const preset = getPreset('money');
		expect(preset).toBeDefined();
		const chart = buildChart(preset!);
		expect(hasContent(chart)).toBe(true);
		expect(filledCount(chart)).toBe(73);
		expect(chart.ink).toEqual({});
		expect(chart.rd).toEqual({});
		expect(parseChart(exportJson(chart))).toEqual(chart);

		chart.goal = 'changed';
		chart.pillars[0] = 'changed';
		chart.actions[0]![0] = 'changed';
		expect(preset!.goal).not.toBe('changed');
		expect(preset!.pillars[0]).not.toBe('changed');
		expect(preset!.actions[0][0]).not.toBe('changed');
		expect(buildChart(preset!).goal).toBe(preset!.goal);
	});

	it('looks up ids', () => {
		expect(getPreset('nope')).toBeUndefined();
		expect(isPresetId('fitness')).toBe(true);
		expect(isPresetId('nope')).toBe(false);
	});

	it('keeps the language preset language-agnostic', () => {
		const preset = getPreset('language');
		expect(preset).toBeDefined();
		const blob = [preset!.goal, ...preset!.pillars, ...allActions(preset!)].join('\n');
		expect(blob).not.toMatch(LANGUAGE_LOCK);
	});

	it('keeps the fitness marathon example', () => {
		const text = exportText(buildChart(getPreset('fitness')!));
		expect(text).toContain('Goal: Run a half marathon');
		expect(text).toContain('Pillar 1: Training plan');
		expect(text).toContain('  - Print a 16-week plan');
		expect(text.match(/^\s+- /gm)?.length).toBe(64);
	});
});
