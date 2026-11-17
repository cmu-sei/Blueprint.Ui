// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Move } from 'src/app/generated/blueprint.api';

// Moves and scenario events can be saved in any order, because a MSEL changes a lot while it is edited.
// Pushing integrations needs every move to start strictly after the move numbered before it and every
// scenario event to start at or after the first move, as the API checks.
export const MOVE_ORDER_RULE = 'Each move must start after the move before it.';

// Each pair of consecutive moves (by number) that share a start time or are out of order,
// that the planner has to fix before pushing.
export function moveOrderProblems(moves: Move[]): string[] {
  const byNumber = [...(moves ?? [])].sort(
    (a, b) => +a.moveNumber - +b.moveNumber,
  );
  const problems: string[] = [];
  for (let i = 1; i < byNumber.length; i++) {
    const previous = byNumber[i - 1];
    const move = byNumber[i];
    if (+move.deltaSeconds === +previous.deltaSeconds) {
      problems.push(
        `Move ${previous.moveNumber} and Move ${move.moveNumber} start at the same time.`,
      );
    } else if (+move.deltaSeconds < +previous.deltaSeconds) {
      problems.push(
        `Move ${move.moveNumber} starts before Move ${previous.moveNumber}.`,
      );
    }
  }
  return problems;
}

// Everything that stops a push: the move order problems, plus the scenario events that start before the
// first move, so they are in no move. Matches the API's list.
export function moveOrderPushProblems(
  moves: Move[],
  eventDeltaSeconds: number[],
): string[] {
  const problems = moveOrderProblems(moves);
  if (moves?.length) {
    const first = [...moves].sort((a, b) => +a.moveNumber - +b.moveNumber)[0];
    const early = (eventDeltaSeconds ?? []).filter(
      (d) => +d < +first.deltaSeconds,
    ).length;
    if (early === 1) {
      problems.push(
        `1 scenario event starts before Move ${first.moveNumber}, so it is in no move.`,
      );
    } else if (early > 1) {
      problems.push(
        `${early} scenario events start before Move ${first.moveNumber}, so they are in no move.`,
      );
    }
  }
  return problems;
}
