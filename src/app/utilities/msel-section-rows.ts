// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ScenarioEvent } from 'src/app/generated/blueprint.api';

/** A row of a MSEL view grouped by move and group: a move header, a group header, or an event. */
export interface MselSectionRow {
  type: 'move' | 'group' | 'event';
  moveNumber?: number;
  groupNumber?: number;
  groupKey?: string;
  event?: ScenarioEvent;
  rowIndex?: number;
}

/**
 * Each event's [move, group], by event id, as ScenarioEventDataService.getMoveAndGroupNumbers builds it: typed as an
 * array of records, as every view holding it is, though it is one map keyed by event id.
 */
export type MoveAndGroupNumbers = Record<string, number[]>[];

/**
 * The rows for events already in display order: a move header when the move changes, a group header when the
 * group does, then the event, numbered from 1. Each event's move and group come from moveAndGroupNumbers, the
 * numbering the Gallery articles use; an event missing from it is in move 0, group 0.
 */
export function buildSectionRows(
  events: ScenarioEvent[],
  moveAndGroupNumbers: MoveAndGroupNumbers,
): MselSectionRow[] {
  const byEvent = moveAndGroupNumbers as unknown as Record<
    string,
    number[] | undefined
  >;
  const rows: MselSectionRow[] = [];
  let lastMove = -1;
  let lastGroup = '';
  let rowIndex = 0;
  for (const event of events) {
    const nums = byEvent[event.id];
    const moveNum = nums ? +nums[0] : 0;
    const groupNum = nums ? +nums[1] : 0;
    const groupKey = `${moveNum}-${groupNum}`;

    if (moveNum !== lastMove) {
      rows.push({ type: 'move', moveNumber: moveNum });
      lastMove = moveNum;
      lastGroup = '';
    }
    if (groupKey !== lastGroup) {
      rows.push({
        type: 'group',
        moveNumber: moveNum,
        groupNumber: groupNum,
        groupKey,
      });
      lastGroup = groupKey;
    }
    rows.push({
      type: 'event',
      event,
      rowIndex: ++rowIndex,
      moveNumber: moveNum,
      groupNumber: groupNum,
      groupKey,
    });
  }
  return rows;
}

/**
 * Which move, group and event rows are open. The methods that open rows answer the ids of the events they opened,
 * for a view that does more when an event opens.
 */
export class MselSectionExpansion {
  readonly eventIds = new Set<string>();
  readonly moveNumbers = new Set<number>();
  readonly groupKeys = new Set<string>();

  /** Opens or closes a row; true when it is now open. */
  toggleEvent(eventId: string): boolean {
    return toggle(this.eventIds, eventId);
  }

  toggleMove(moveNumber: number): boolean {
    return toggle(this.moveNumbers, moveNumber);
  }

  toggleGroup(groupKey: string): boolean {
    return toggle(this.groupKeys, groupKey);
  }

  expandAll(rows: MselSectionRow[]): string[] {
    const opened: string[] = [];
    rows.forEach((row) => {
      if (row.type === 'move' && row.moveNumber !== undefined) {
        this.moveNumbers.add(row.moveNumber);
      } else if (row.type === 'group' && row.groupKey) {
        this.groupKeys.add(row.groupKey);
      } else if (row.type === 'event' && row.event?.id) {
        this.eventIds.add(row.event.id);
        opened.push(row.event.id);
      }
    });
    return opened;
  }

  collapseAll() {
    this.moveNumbers.clear();
    this.groupKeys.clear();
    this.eventIds.clear();
  }

  isFullyExpanded(rows: MselSectionRow[]): boolean {
    return rows.every((row) => {
      if (row.type === 'move' && row.moveNumber !== undefined) {
        return this.moveNumbers.has(row.moveNumber);
      } else if (row.type === 'group' && row.groupKey) {
        return this.groupKeys.has(row.groupKey);
      } else if (row.type === 'event' && row.event?.id) {
        return this.eventIds.has(row.event.id);
      }
      return true;
    });
  }

  get isFullyCollapsed(): boolean {
    return (
      this.moveNumbers.size === 0 &&
      this.groupKeys.size === 0 &&
      this.eventIds.size === 0
    );
  }

  /** Opens the move with its groups and events. */
  expandMove(rows: MselSectionRow[], moveNumber: number): string[] {
    this.moveNumbers.add(moveNumber);
    const opened: string[] = [];
    rows.forEach((row) => {
      if (
        row.type === 'group' &&
        row.moveNumber === moveNumber &&
        row.groupKey
      ) {
        this.groupKeys.add(row.groupKey);
      } else if (
        row.type === 'event' &&
        row.moveNumber === moveNumber &&
        row.event?.id
      ) {
        this.eventIds.add(row.event.id);
        opened.push(row.event.id);
      }
    });
    return opened;
  }

  collapseMove(rows: MselSectionRow[], moveNumber: number) {
    rows.forEach((row) => {
      if (
        row.type === 'group' &&
        row.moveNumber === moveNumber &&
        row.groupKey
      ) {
        this.groupKeys.delete(row.groupKey);
      } else if (
        row.type === 'event' &&
        row.moveNumber === moveNumber &&
        row.event?.id
      ) {
        this.eventIds.delete(row.event.id);
      }
    });
    this.moveNumbers.delete(moveNumber);
  }

  /** Opens the group with its events. */
  expandGroup(
    rows: MselSectionRow[],
    moveNumber: number,
    groupNumber: number,
  ): string[] {
    this.groupKeys.add(`${moveNumber}-${groupNumber}`);
    const opened: string[] = [];
    rows.forEach((row) => {
      if (
        row.type === 'event' &&
        row.moveNumber === moveNumber &&
        row.groupNumber === groupNumber &&
        row.event?.id
      ) {
        this.eventIds.add(row.event.id);
        opened.push(row.event.id);
      }
    });
    return opened;
  }

  collapseGroup(
    rows: MselSectionRow[],
    moveNumber: number,
    groupNumber: number,
  ) {
    rows.forEach((row) => {
      if (
        row.type === 'event' &&
        row.moveNumber === moveNumber &&
        row.groupNumber === groupNumber &&
        row.event?.id
      ) {
        this.eventIds.delete(row.event.id);
      }
    });
    this.groupKeys.delete(`${moveNumber}-${groupNumber}`);
  }
}

function toggle<T>(set: Set<T>, key: T): boolean {
  if (set.has(key)) {
    set.delete(key);
    return false;
  }
  set.add(key);
  return true;
}
