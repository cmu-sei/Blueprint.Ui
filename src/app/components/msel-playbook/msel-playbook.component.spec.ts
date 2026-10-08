// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { screen, within } from '@testing-library/angular';
import { DataField, DataFieldType, DataValue, Msel, ScenarioEvent } from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { MselPlaybookComponent } from './msel-playbook.component';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  @Input() startTime: Date;
  @Input() durationSeconds: number;
  @Input() showRealTime: boolean;
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1 },
  { id: 'df-detail', mselId: 'msel-1', name: 'Detail', dataType: DataFieldType.String, displayOrder: 2 },
];
const EVENT: ScenarioEvent = { id: 'se-1', mselId: 'msel-1', deltaSeconds: 600, groupOrder: 1 };
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-detail', value: 'Users receive a phish' },
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

async function renderPlaybook(canEditMsel: boolean) {
  return renderComponent(MselPlaybookComponent, {
    imports: [MatButtonModule, MatIconModule, MatPaginatorModule],
    declarations: [MselPlaybookComponent, DurationViewStub],
    providers: [
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
    inputs: { canEditMsel, loggedInUserId: 'user-1' },
  });
}

describe('MselPlaybookComponent', () => {
  /**
   * Verifies: the playbook shows each event's title and data values.
   * Interacts with: real MselQuery, DataFieldQuery, DataValueQuery and ScenarioEventQuery (seeded).
   * Data: one event, "Phishing wave", with a Detail value.
   */
  it('shows the events with their data values', async () => {
    await renderPlaybook(true);

    expect(screen.getByRole('heading', { name: 'MSEL Playbook' })).toBeInTheDocument();
    const event = within(screen.getByRole('table'));
    expect(event.getByRole('columnheader', { name: 'Phishing wave' })).toBeInTheDocument();
    expect(event.getByText('Users receive a phish')).toBeInTheDocument();
  });

  /**
   * Verifies: the playbook is read-only whatever canEditMsel is: it renders no editable control, only paging and printing.
   * Interacts with: MselPlaybookComponent template (canEditMsel is an input the template does not read).
   * Data: canEditMsel true and false.
   */
  it.each([true, false])('renders no editing controls with canEditMsel %s', async (canEditMsel) => {
    await renderPlaybook(canEditMsel);

    expect(screen.queryAllByRole('textbox')).toEqual([]);
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Print Current Page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print All Events' })).toBeInTheDocument();
  });
});
