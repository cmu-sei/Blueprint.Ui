/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationService,
} from 'src/app/generated/blueprint.api';

/**
 * The actions an automation task can take and the parameters each one has, as the API's catalog describes them. The
 * catalog is part of the API build, so it is read once.
 */
@Injectable({
  providedIn: 'root',
})
export class AutomationActionDataService {
  private automationService = inject(AutomationService);
  private readonly actions$ = new BehaviorSubject<AutomationActionDefinition[]>(
    [],
  );
  private requested = false;

  readonly actions: Observable<AutomationActionDefinition[]> =
    this.actions$.asObservable();

  /** The catalog, grouped by category in catalog order. */
  readonly byCategory: Observable<
    { category: string; actions: AutomationActionDefinition[] }[]
  > = this.actions$.pipe(
    map((actions) => {
      const groups = new Map<string, AutomationActionDefinition[]>();
      actions.forEach((a) => {
        const category = a.category || 'Other';
        groups.set(category, [...(groups.get(category) ?? []), a]);
      });
      return [...groups].map(([category, list]) => ({
        category,
        actions: list,
      }));
    }),
  );

  load() {
    if (this.requested) return;
    this.requested = true;
    this.automationService
      .getAutomationActions()
      .pipe(take(1))
      .subscribe({
        next: (actions) => this.actions$.next(actions),
        error: (error) => {
          // a later page may ask again
          this.requested = false;
          throw error;
        },
      });
  }

  get(action: AutomationAction): AutomationActionDefinition | undefined {
    return this.actions$.value.find((a) => a.action === action);
  }

  /** "Category › Display", as a task names its action. */
  label(action: AutomationAction): string {
    const definition = this.get(action);
    if (!definition) return action ?? '';
    return definition.category
      ? `${definition.category} › ${definition.display}`
      : definition.display;
  }
}
