// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ScenarioEvent } from 'src/app/generated/blueprint.api';
import {
  MoveAndGroupNumbers,
  MselSectionExpansion,
  buildSectionRows,
} from './msel-section-rows';

const event = (id: string): ScenarioEvent => ({ id, mselId: 'msel-1' });
// built as getMoveAndGroupNumbers builds it: an array used as a map by event id
function numbers(map: Record<string, number[]>): MoveAndGroupNumbers {
  const value = [] as unknown as MoveAndGroupNumbers;
  Object.assign(value, map);
  return value;
}

// move 1 has groups 0 and 1, move 2 one group; e-x has no numbers
const EVENTS = ['a', 'b', 'c', 'd', 'x'].map((id) => event(`e-${id}`));
const NUMBERS = numbers({
  'e-a': [1, 0],
  'e-b': [1, 0],
  'e-c': [1, 1],
  'e-d': [2, 0],
});

const summary = (rows: ReturnType<typeof buildSectionRows>) =>
  rows.map((r) =>
    r.type === 'event'
      ? `${r.rowIndex}:${r.event.id}@${r.groupKey}`
      : r.type === 'move'
        ? `move ${r.moveNumber}`
        : `group ${r.groupKey}`,
  );

describe('buildSectionRows', () => {
  /**
   * Verifies: a move header comes before a move's first event and a group header before each group's, events are numbered from 1 in order, and an event without numbers is in move 0, group 0.
   * Data: e-a and e-b in move 1 group 0, e-c in move 1 group 1, e-d in move 2, e-x with no numbers.
   */
  it('heads each move and group', () => {
    expect(summary(buildSectionRows(EVENTS, NUMBERS))).toEqual([
      'move 1',
      'group 1-0',
      '1:e-a@1-0',
      '2:e-b@1-0',
      'group 1-1',
      '3:e-c@1-1',
      'move 2',
      'group 2-0',
      '4:e-d@2-0',
      'move 0',
      'group 0-0',
      '5:e-x@0-0',
    ]);
  });
});

describe('MselSectionExpansion', () => {
  const rows = buildSectionRows(EVENTS, NUMBERS);

  /**
   * Verifies: a toggle opens a row and answers true, then closes it and answers false.
   * Data: event e-a, move 1, group 1-0.
   */
  it('toggles rows', () => {
    const expansion = new MselSectionExpansion();

    expect(expansion.toggleEvent('e-a')).toBe(true);
    expect(expansion.toggleMove(1)).toBe(true);
    expect(expansion.toggleGroup('1-0')).toBe(true);
    expect(expansion.toggleEvent('e-a')).toBe(false);
    expect([
      ...expansion.eventIds,
      ...expansion.moveNumbers,
      ...expansion.groupKeys,
    ]).toEqual([1, '1-0']);
  });

  /**
   * Verifies: Expand All opens every row and names the events it opened; Collapse All closes them all.
   * Data: the five events.
   */
  it('expands and collapses everything', () => {
    const expansion = new MselSectionExpansion();

    expect(expansion.isFullyCollapsed).toBe(true);
    expect(expansion.expandAll(rows)).toEqual([
      'e-a',
      'e-b',
      'e-c',
      'e-d',
      'e-x',
    ]);
    expect(expansion.isFullyExpanded(rows)).toBe(true);
    expansion.collapseAll();
    expect(expansion.isFullyCollapsed).toBe(true);
    expect(expansion.isFullyExpanded(rows)).toBe(false);
  });

  /**
   * Verifies: opening a move opens its groups and events and nothing of another move; closing it closes them again; a group does the same for its events.
   * Data: move 1 (groups 1-0, 1-1), then group 1-1.
   */
  it('expands and collapses one move or group', () => {
    const expansion = new MselSectionExpansion();

    expect(expansion.expandMove(rows, 1)).toEqual(['e-a', 'e-b', 'e-c']);
    expect([...expansion.groupKeys]).toEqual(['1-0', '1-1']);
    expect(expansion.moveNumbers.has(2)).toBe(false);
    expansion.collapseMove(rows, 1);
    expect(expansion.isFullyCollapsed).toBe(true);

    expect(expansion.expandGroup(rows, 1, 1)).toEqual(['e-c']);
    expansion.collapseGroup(rows, 1, 1);
    expect(expansion.isFullyCollapsed).toBe(true);
  });
});
