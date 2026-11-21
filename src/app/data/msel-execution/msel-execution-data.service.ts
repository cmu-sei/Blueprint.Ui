/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import {
  MselAdvanceResult,
  MselExecution,
  MselExecutionService,
} from 'src/app/generated/blueprint.api';

/**
 * Where a deployed MSEL is: its current move and group, whether its automation is paused, and each scenario event's
 * move and group as the server numbers them. The MSEL's own Updated broadcast says when the position changed.
 */
@Injectable({
  providedIn: 'root',
})
export class MselExecutionDataService {
  private mselExecutionService = inject(MselExecutionService);
  private readonly executions$ = new BehaviorSubject<
    Record<string, MselExecution>
  >({});

  select(mselId: string): Observable<MselExecution | undefined> {
    return this.executions$.pipe(map((all) => all[mselId]));
  }

  get(mselId: string): MselExecution | undefined {
    return this.executions$.value[mselId];
  }

  // Per MSEL, each read and action is numbered as it is sent, and an answer is stored only when it was asked for after
  // the answer stored last: an older read's answer is dropped rather than put back over what came after it, whichever
  // arrives first. A refused action has no answer, so it overtakes nothing.
  private readonly asked: Record<string, number> = {};
  private readonly stored: Record<string, number> = {};
  private ask(mselId: string): number {
    this.asked[mselId] = (this.asked[mselId] ?? 0) + 1;
    return this.asked[mselId];
  }
  private answer(
    mselId: string,
    ticket: number,
    execution: MselExecution | undefined,
  ) {
    if (ticket <= (this.stored[mselId] ?? 0)) return;
    this.stored[mselId] = ticket;
    this.updateStore(execution);
  }

  /**
   * A live change of the MSEL's position or pause, from its Updated broadcast: newer than every answer asked for
   * before it, which is then dropped even while the read asked for here is still on its way, or if that read fails.
   */
  live(mselId: string, change: Partial<MselExecution>) {
    this.stored[mselId] = this.ask(mselId);
    const current = this.get(mselId);
    if (current) this.updateStore({ ...current, ...change });
    this.load(mselId);
  }

  load(mselId: string) {
    const ticket = this.ask(mselId);
    this.mselExecutionService
      .getMselExecution(mselId)
      .pipe(take(1))
      .subscribe((execution) => this.answer(mselId, ticket, execution));
  }

  startMove(
    mselId: string,
    moveNumber: number,
    runTaskIds: string[],
  ): Observable<MselAdvanceResult> {
    const ticket = this.ask(mselId);
    return this.mselExecutionService
      .startMselMove(mselId, moveNumber, { runTaskIds })
      .pipe(tap((result) => this.answer(mselId, ticket, result.execution)));
  }

  startGroup(
    mselId: string,
    moveNumber: number,
    groupNumber: number,
    runTaskIds: string[],
  ): Observable<MselAdvanceResult> {
    const ticket = this.ask(mselId);
    return this.mselExecutionService
      .startMselGroup(mselId, moveNumber, groupNumber, { runTaskIds })
      .pipe(tap((result) => this.answer(mselId, ticket, result.execution)));
  }

  setPaused(mselId: string, paused: boolean): Observable<MselExecution> {
    const ticket = this.ask(mselId);
    return this.mselExecutionService
      .setMselAutomationPaused(mselId, { paused })
      .pipe(tap((execution) => this.answer(mselId, ticket, execution)));
  }

  /** An execution from the API or a test; the API sends its numbers as strings, which are made numbers here. */
  updateStore(execution: MselExecution | undefined) {
    if (!execution?.mselId) return;
    const toNumber = (n: unknown) =>
      n === null || n === undefined || n === '' ? null : Number(n);
    execution = {
      ...execution,
      currentMoveNumber: toNumber(execution.currentMoveNumber),
      currentGroupNumber: toNumber(execution.currentGroupNumber),
      positions: (execution.positions ?? []).map((p) => ({
        ...p,
        moveNumber: Number(p.moveNumber),
        groupNumber: Number(p.groupNumber),
      })),
    };
    execution.startTime = execution.startTime
      ? new Date(execution.startTime)
      : null;
    execution.currentGroupStartedAt = execution.currentGroupStartedAt
      ? new Date(execution.currentGroupStartedAt)
      : null;
    this.executions$.next({
      ...this.executions$.value,
      [execution.mselId]: execution,
    });
  }
}
