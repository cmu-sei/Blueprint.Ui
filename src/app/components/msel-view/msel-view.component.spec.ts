// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input } from '@angular/core';
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
  Card,
  CompetencyFramework,
  CompetencyFrameworkService,
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Move,
  Msel,
  MselCompetency,
  MselCompetencyService,
  ScenarioEvent,
  Team,
  User,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MselViewComponent } from './msel-view.component';
import { IsDateTimeValuePipe } from 'src/app/utilities/date-time-value';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, onExerciseView: true },
  { id: 'df-notes', mselId: 'msel-1', name: 'Planner Notes', dataType: DataFieldType.String, displayOrder: 2, onExerciseView: false },
  { id: 'df-when', mselId: 'msel-1', name: 'When', dataType: DataFieldType.DateTime, displayOrder: 3, onExerciseView: true },
];
const EVENTS: ScenarioEvent[] = [{ id: 'se-1', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 0, groupOrder: 1, isHidden: false }];
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-notes', value: 'Planner only' },
  // left behind when When was changed to DateTime
  { id: 'dv-3', scenarioEventId: 'se-1', dataFieldId: 'df-when', value: 'Team 2' },
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
    declarations: [MselViewComponent, DurationViewStub, IsDateTimeValuePipe],
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

  /**
   * Verifies: a DateTime value that is not a date is shown as its text, marked as not a date, rather than as an empty cell.
   * Interacts with: the DateTime cell of the MSEL view, IsDateTimeValuePipe, ScenarioEventDataService.getDisplayValueFromView.
   * Data: When (DateTime, on the exercise view) = "Team 2".
   */
  it('shows a DateTime value that is not a date as its text', async () => {
    await renderMselView();
    const table = within(screen.getByRole('table'));

    expect(table.getByText('Team 2')).toHaveAttribute('title', 'Not a date and time');
  });

  describe('on its own route', () => {
    const PLANNER: User = { id: 'user-1', name: 'Pat Planner' };
    const TEAM: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE', users: [PLANNER] };
    const STANDALONE_MSEL: Msel = {
      ...MSEL,
      showMoveOnExerciseView: true,
      teams: [TEAM],
    };
    const STANDALONE_FIELDS: DataField[] = [
      ...FIELDS,
      { id: 'df-card', mselId: 'msel-1', name: 'Gallery Card', dataType: DataFieldType.Card, displayOrder: 4, onExerciseView: true },
      { id: 'df-owner', mselId: 'msel-1', name: 'Owner', dataType: DataFieldType.User, displayOrder: 5, onExerciseView: true },
    ];
    const STANDALONE_VALUES: DataValue[] = [
      ...VALUES,
      { id: 'dv-4', scenarioEventId: 'se-1', dataFieldId: 'df-card', value: 'card-1' },
      { id: 'dv-5', scenarioEventId: 'se-1', dataFieldId: 'df-owner', value: 'user-1' },
    ];
    const CARDS: Card[] = [{ id: 'card-1', mselId: 'msel-1', name: 'Breaking News' }];
    const MOVES: Move[] = [{ id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0 }];

    async function renderStandalone() {
      const apis = mselLoadApiStubs({
        msel: STANDALONE_MSEL,
        dataFields: STANDALONE_FIELDS,
        dataValues: STANDALONE_VALUES,
        scenarioEvents: EVENTS,
        cards: CARDS,
        moves: MOVES,
      });
      // msel/:mselid/view has the MSEL in the path and no ?msel
      const { route } = activatedRouteStub({}, { mselid: 'msel-1' });
      await renderComponent(MselViewComponent, {
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
        declarations: [MselViewComponent, DurationViewStub, IsDateTimeValuePipe],
        providers: [
          ...mselLoadApiProviders(apis),
          {
            provide: MselCompetencyService,
            useValue: { getMselCompetencies: vi.fn(() => of<MselCompetency[]>([])) } satisfies ApiStub<MselCompetencyService>,
          },
          {
            provide: CompetencyFrameworkService,
            useValue: { getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([])) } satisfies ApiStub<CompetencyFrameworkService>,
          },
          { provide: ActivatedRoute, useValue: route },
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
        inputs: { tabHeight: 48 },
      });
      return apis;
    }

    /**
     * Verifies: opened on msel/:mselid/view, the view loads the MSEL itself and keeps it active, so the columns set on the MSEL show.
     * Interacts with: the MSEL, move and card endpoints (stubs), real MselDataService and MselStore.
     * Data: route param mselid=msel-1, no ?msel; the MSEL shows Move on the exercise view.
     */
    it('loads and keeps the MSEL from the path', async () => {
      const apis = await renderStandalone();

      expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
      expect(apis.move.getMovesByMsel).toHaveBeenCalledWith('msel-1');
      expect(apis.card.getCardsByMsel).toHaveBeenCalledWith('msel-1');
      expect(screen.getByRole('columnheader', { name: /Move/ })).toBeInTheDocument();
    });

    /**
     * Verifies: Card and User values show the card and user names, not empty cells, when the view is opened on its own.
     * Interacts with: ScenarioEventDataService.updateScenarioEventViewCards / updateScenarioEventViewUsers and getDisplayValueFromView.
     * Data: Gallery Card = card-1 (Breaking News), Owner = user-1 (Pat Planner, on Blue Team).
     */
    it('shows card and user names', async () => {
      await renderStandalone();
      const table = within(screen.getByRole('table'));

      expect(table.getByText('Phishing wave')).toBeInTheDocument();
      expect(table.getByText('Breaking News')).toBeInTheDocument();
      expect(table.getByText('Pat Planner')).toBeInTheDocument();
    });
  });
});
