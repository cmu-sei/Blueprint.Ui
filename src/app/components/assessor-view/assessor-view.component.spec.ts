// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import {
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Msel,
  MselCompetency,
  MselCompetencyService,
  ScenarioEvent,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { AssessorViewComponent } from './assessor-view.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  @Input() startTime: Date;
  @Input() durationSeconds: number;
  @Input() showRealTime: boolean;
}
@Component({ selector: 'app-data-value', template: '', standalone: false })
class DataValueStub {
  @Input() value: string;
  @Output() valueChange = new EventEmitter<string>();
  @Input() dataField: DataField;
  @Input() canEdit: boolean;
  @Input() canApprove: boolean;
  @Input() isOwner: boolean;
  @Input() showValueOnly: boolean;
  @Input() organizationOptions: unknown[];
  @Input() teamOptions: unknown[];
  @Input() cardOptions: unknown[];
  @Input() moveOptions: unknown[];
  @Input() userOptions: unknown[];
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, isAssessorVisible: true },
  { id: 'df-done', mselId: 'msel-1', name: 'Observed', dataType: DataFieldType.Checkbox, displayOrder: 2, isAssessorVisible: true },
  { id: 'df-notes', mselId: 'msel-1', name: 'Planner Notes', dataType: DataFieldType.String, displayOrder: 3, isAssessorVisible: false },
];
const EVENT: ScenarioEvent = { id: 'se-1', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 0, groupOrder: 1 };
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-done', value: 'false' },
];

function seeded<S extends { set(entities: unknown[]): void }>(Store: new () => S, entities: unknown[]) {
  return {
    provide: Store,
    useFactory: () => {
      const store = new Store();
      store.set(structuredClone(entities));
      return store;
    },
  };
}

async function renderAssessorView(overrides: { canEditCheckboxes?: boolean } = {}) {
  const { canEditCheckboxes = false } = overrides;
  const poolApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>([])),
  } satisfies ApiStub<MselCompetencyService>;
  const teamCompetencyApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>([])),
  } satisfies ApiStub<TeamCompetencyService>;
  const rendered = await renderComponent(AssessorViewComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressBarModule,
      MatSelectModule,
      MatSortModule,
      MatTooltipModule,
    ],
    declarations: [AssessorViewComponent, DurationViewStub, DataValueStub],
    providers: [
      { provide: MselCompetencyService, useValue: poolApi },
      { provide: TeamCompetencyService, useValue: teamCompetencyApi },
      // The component reads xAPI statements over HttpClient when an event is expanded.
      provideHttpClient(),
      provideHttpClientTesting(),
      // The MSEL page loads all of this; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([structuredClone(MSEL)]);
          store.setActive('msel-1');
          return store;
        },
      },
      seeded(DataFieldStore, FIELDS),
      seeded(DataValueStore, VALUES),
      seeded(ScenarioEventStore, [EVENT]),
    ],
    inputs: { canEditCheckboxes, loggedInUserId: 'user-me' },
  });
  return { ...rendered, poolApi };
}

function values(fixture: ComponentFixture<unknown>): DataValueStub[] {
  return fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance);
}
const byField = (fixture: ComponentFixture<unknown>, name: string) => values(fixture).find((v) => v.dataField.name === name);

describe('AssessorViewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: only the assessor-visible data fields are shown, and the MSEL's competencies are loaded.
   * Interacts with: real DataFieldQuery, DataValueQuery and ScenarioEventQuery (seeded), MselCompetencyService.getMselCompetencies (stub), DataValueStub inputs.
   * Data: Title and Observed are assessor-visible; Planner Notes is not.
   */
  it('shows only the assessor-visible fields', async () => {
    const { fixture, poolApi } = await renderAssessorView();

    expect(poolApi.getMselCompetencies).toHaveBeenCalledWith('msel-1');
    expect(values(fixture).map((v) => [v.dataField.name, v.value])).toEqual([
      ['Title', 'Phishing wave'],
      ['Observed', 'false'],
    ]);
    expect(screen.queryByText('No data fields are marked as assessor-visible.')).not.toBeInTheDocument();
  });

  /**
   * Verifies: with canEditCheckboxes only the Checkbox field is editable; nothing is approvable or owned.
   * Interacts with: DataValueStub inputs.
   * Data: canEditCheckboxes true; Title (String) and Observed (Checkbox).
   */
  it('lets an assessor tick the checkbox fields with canEditCheckboxes', async () => {
    const { fixture } = await renderAssessorView({ canEditCheckboxes: true });

    expect(byField(fixture, 'Observed')?.canEdit).toBe(true);
    expect(byField(fixture, 'Title')?.canEdit).toBe(false);
    for (const value of values(fixture)) {
      expect(value.canApprove).toBe(false);
      expect(value.isOwner).toBe(false);
      expect(value.showValueOnly).toBe(true);
    }
  });

  /**
   * Verifies: without canEditCheckboxes every field, the Checkbox field included, is read-only.
   * Interacts with: DataValueStub inputs.
   * Data: canEditCheckboxes false.
   */
  it('makes the checkbox fields read-only without canEditCheckboxes', async () => {
    const { fixture } = await renderAssessorView({ canEditCheckboxes: false });

    expect(byField(fixture, 'Observed')?.canEdit).toBe(false);
    expect(byField(fixture, 'Title')?.canEdit).toBe(false);
  });
});
