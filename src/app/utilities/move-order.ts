// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Move } from 'src/app/generated/blueprint.api';

// Every move starts strictly after the move numbered before it, as the API requires.
// A move number the MSEL already uses is left to the API.
export const MOVE_ORDER_RULE = 'Each move must start after the move before it.';

// Why a move with this number and start can't sit among the MSEL's other moves, or '' if it can.
// The conflict named is the closest one by move number. The API answers with the same message.
export function moveOrderConflict(
  moveNumber: number,
  deltaSeconds: number,
  otherMoves: Move[],
): string {
  const number = +moveNumber;
  const seconds = +deltaSeconds;
  const others = (otherMoves ?? []).filter((m) => +m.moveNumber !== number);
  const before = others
    .filter((m) => +m.moveNumber < number && +m.deltaSeconds >= seconds)
    .sort((a, b) => +b.moveNumber - +a.moveNumber)[0];
  if (before) {
    return +before.deltaSeconds === seconds
      ? `Move ${number} can't start at the same time as Move ${before.moveNumber}. ${MOVE_ORDER_RULE}`
      : `Move ${number} must start after Move ${before.moveNumber}. ${MOVE_ORDER_RULE}`;
  }
  const after = others
    .filter((m) => +m.moveNumber > number && +m.deltaSeconds <= seconds)
    .sort((a, b) => +a.moveNumber - +b.moveNumber)[0];
  if (after) {
    return +after.deltaSeconds === seconds
      ? `Move ${number} can't start at the same time as Move ${after.moveNumber}. ${MOVE_ORDER_RULE}`
      : `Move ${number} must start before Move ${after.moveNumber}. ${MOVE_ORDER_RULE}`;
  }
  return '';
}
