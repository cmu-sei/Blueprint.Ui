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

  // per MSEL, the newest read or action: an answer to an older read, overtaken by a newer read or by a start or pause
  // the API took, is dropped rather than put back over what came after it. A refused action changes nothing, so the
  // read it overlapped still counts.
  private readonly sequence: Record<string, number> = {};
  private next(mselId: string): number {
    this.sequence[mselId] = (this.sequence[mselId] ?? 0) + 1;
    return this.sequence[mselId];
  }

  load(mselId: string) {
    const asked = this.next(mselId);
    this.mselExecutionService
      .getMselExecution(mselId)
      .pipe(take(1))
      .subscribe((execution) => {
        if (this.sequence[mselId] === asked) this.updateStore(execution);
      });
  }

  startMove(
    mselId: string,
    moveNumber: number,
    runTaskIds: string[],
  ): Observable<MselAdvanceResult> {
    return this.mselExecutionService
      .startMselMove(mselId, moveNumber, { runTaskIds })
      .pipe(tap((result) => this.taken(mselId, result.execution)));
  }

  startGroup(
    mselId: string,
    moveNumber: number,
    groupNumber: number,
    runTaskIds: string[],
  ): Observable<MselAdvanceResult> {
    return this.mselExecutionService
      .startMselGroup(mselId, moveNumber, groupNumber, { runTaskIds })
      .pipe(tap((result) => this.taken(mselId, result.execution)));
  }

  setPaused(mselId: string, paused: boolean): Observable<MselExecution> {
    return this.mselExecutionService
      .setMselAutomationPaused(mselId, { paused })
      .pipe(tap((execution) => this.taken(mselId, execution)));
  }

  /** The position an action the API took left the MSEL in, newer than any read before it. */
  private taken(mselId: string, execution: MselExecution | undefined) {
    this.next(mselId);
    this.updateStore(execution);
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
