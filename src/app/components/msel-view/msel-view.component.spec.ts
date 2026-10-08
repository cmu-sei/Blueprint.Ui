// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import { of } from 'rxjs';
import { AngularEditorModule } from '@kolkov/angular-editor';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Msel,
  MselCompetency,
  MselCompetencyService,
  ScenarioEvent,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MselViewComponent } from './msel-view.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  @Input() startTime: Date;
  @Input() durationSeconds: number;
  @Input() showRealTime: boolean;
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, onExerciseView: true },
  { id: 'df-notes', mselId: 'msel-1', name: 'Planner Notes', dataType: DataFieldType.String, displayOrder: 2, onExerciseView: false },
];
const EVENTS: ScenarioEvent[] = [{ id: 'se-1', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 0, groupOrder: 1, isHidden: false }];
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-notes', value: 'Planner only' },
];

async function renderMselView() {
  const apis = mselLoadApiStubs({ msel: MSEL, dataFields: FIELDS, dataValues: VALUES, scenarioEvents: EVENTS });
  const competencyApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>([])),
  } satisfies ApiStub<MselCompetencyService>;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  // Embedded in the MSEL page, the view reads the MSEL from ?msel.
  const { route } = activatedRouteStub({ msel: 'msel-1' });
  const rendered = await renderComponent(MselViewComponent, {
    imports: [
      AngularEditorModule,
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatSortModule,
      MatTooltipModule,
    ],
    declarations: [MselViewComponent, DurationViewStub],
    providers: [
      ...mselLoadApiProviders(apis),
      { provide: MselCompetencyService, useValue: competencyApi },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: ActivatedRoute, useValue: route },
      // The MSEL page has already loaded and activated the MSEL.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([structuredClone(MSEL)]);
          store.setActive('msel-1');
          return store;
        },
      },
      // The component posts an xAPI statement over HttpClient when opened on its own route.
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
    inputs: { tabHeight: 48 },
  });
  return { ...rendered, apis, competencyApi };
}

describe('MselViewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: the component mounts with the default test providers and loads the MSEL's fields, values, events and competencies.
   * Interacts with: the MSEL endpoints (stubs), MselCompetencyService.getMselCompetencies (stub), real data services and stores.
   * Data: ?msel=msel-1.
   */
  it('renders with the default test providers', async () => {
    const { fixture, apis, competencyApi } = await renderMselView();

    expect(fixture.componentInstance).toBeInstanceOf(MselViewComponent);
    expect(apis.dataField.getDataFieldsByMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.scenarioEvent.getScenarioEventsByMsel).toHaveBeenCalledWith('msel-1');
    expect(competencyApi.getMselCompetencies).toHaveBeenCalledWith('msel-1');
  });

  /**
   * Verifies: the exercise view shows only the fields marked for it.
   * Interacts with: MselViewComponent.getSortedDataFields, real ScenarioEventDataService view helpers.
   * Data: Title is on the exercise view, Planner Notes is not.
   */
  it('shows only the exercise-view fields', async () => {
    await renderMselView();
    const table = within(screen.getByRole('table'));

    expect(table.getByText('Phishing wave')).toBeInTheDocument();
    expect(table.queryByText('Planner only')).not.toBeInTheDocument();
  });
});
