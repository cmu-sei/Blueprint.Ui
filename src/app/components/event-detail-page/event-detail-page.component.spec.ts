// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import {
  DataField,
  DataFieldType,
  DataValue,
  Msel,
  MselRole,
  ScenarioEvent,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { EventDetailPageComponent } from './event-detail-page.component';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
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
  @Input() unitOptions: unknown[];
  @Input() cardOptions: unknown[];
  @Input() moveOptions: unknown[];
  @Input() gallerySourceTypeOptions: unknown[];
  @Input() galleryItemStatusOptions: string[];
  @Input() userOptions: unknown[];
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1 },
  { id: 'df-owner', mselId: 'msel-1', name: 'Owner', dataType: DataFieldType.User, displayOrder: 2 },
];
const EVENT: ScenarioEvent = { id: 'se-1', mselId: 'msel-1', deltaSeconds: 0 };
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-owner', value: 'user-a' },
];

async function renderEventDetail(options: { msel?: Msel; providers?: Provider[] } = {}) {
  const { msel = MSEL, providers = [] } = options;
  const apis = mselLoadApiStubs({ msel, dataFields: FIELDS, dataValues: VALUES, scenarioEvents: [EVENT] });
  const { route } = activatedRouteStub({ msel: 'msel-1', scenarioEvent: 'se-1' });
  const rendered = await renderComponent(EventDetailPageComponent, {
    imports: [MatButtonModule, MatIconModule],
    declarations: [EventDetailPageComponent, TopbarStub, DataValueStub],
    providers: [...mselLoadApiProviders(apis), { provide: ActivatedRoute, useValue: route }, ...providers],
    inputs: { loggedInUserId: 'user-me' },
  });
  return { ...rendered, apis };
}

function values(fixture: ComponentFixture<unknown>): DataValueStub[] {
  return fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance);
}

describe('EventDetailPageComponent', () => {
  /**
   * Verifies: the page loads the MSEL and the event named in the route and lists the event's data values.
   * Interacts with: the MSEL endpoints and ScenarioEventService.getScenarioEvent (stubs), real data services and stores, DataValueStub inputs.
   * Data: msel=msel-1, scenarioEvent=se-1 with a Title and an Owner value.
   */
  it('shows the event data values', async () => {
    const { fixture, apis } = await renderEventDetail();

    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.scenarioEvent.getScenarioEvent).toHaveBeenCalledWith('se-1');
    // A text query: jsdom's CSS engine throws computing this page's styles for a role query.
    expect(screen.getByText('Exercise Alpha Event Details', { selector: 'h2' })).toBeInTheDocument();
    expect(values(fixture).map((v) => [v.dataField.name, v.value])).toEqual([
      ['Title', 'Phishing wave'],
      ['Owner', 'user-a'],
    ]);
  });

  /**
   * Verifies: every data value is shown read-only: no edit, approve or owner rights, value only.
   * Interacts with: DataValueStub inputs.
   * Data: the Title and Owner values of se-1.
   */
  it('shows the data values read-only', async () => {
    const { fixture } = await renderEventDetail();

    for (const value of values(fixture)) {
      expect(value.canEdit).toBe(false);
      expect(value.canApprove).toBe(false);
      expect(value.isOwner).toBe(false);
      expect(value.showValueOnly).toBe(true);
    }
  });

  /**
   * Verifies: a user who may edit and approve this MSEL elsewhere still gets every data value read-only here: the page binds the gates to false.
   * Interacts with: the MSEL's userMselRoles (through the real MSEL store), the real PermissionDataService (which the page does not read), DataValueStub inputs.
   * Data: user-me is Editor and Approver of msel-1 and holds SystemPermission.EditMsels.
   */
  it('keeps the data values read-only for an editor and approver of the MSEL', async () => {
    const { fixture } = await renderEventDetail({
      msel: {
        ...MSEL,
        userMselRoles: [
          { id: 'umr-1', userId: 'user-me', mselId: 'msel-1', role: MselRole.Editor },
          { id: 'umr-2', userId: 'user-me', mselId: 'msel-1', role: MselRole.Approver },
        ],
      },
      providers: permissionDataProviders({ system: [SystemPermission.EditMsels] }),
    });

    // The user's system permission is loaded in the app state the page runs in.
    expect(TestBed.inject(PermissionDataService).hasPermission(SystemPermission.EditMsels)).toBe(true);
    expect(values(fixture)).toHaveLength(2);
    for (const value of values(fixture)) {
      expect(value.canEdit).toBe(false);
      expect(value.canApprove).toBe(false);
    }
  });

  /**
   * Verifies: the data values get undefined user options (current behavior).
   * Interacts with: DataValueStub inputs.
   * Data: the Owner value (a user id).
   */
  it('passes no user options to the data values', async () => {
    const { fixture } = await renderEventDetail();

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(values(fixture)[1].userOptions).toBeUndefined();
  });

  /**
   * Verifies: every data value gets the MSEL's Gallery source types and Gallery article statuses as its options.
   * Interacts with: DataValueStub inputs, the MSEL loaded through the real MselDataService.
   * Data: MSEL msel-1 with source types News and Social and statuses Green and Red.
   */
  it("passes the MSEL's Gallery source types and statuses to the data values", async () => {
    const { fixture } = await renderEventDetail({
      msel: { ...MSEL, gallerySourceTypes: ['News', 'Social'], galleryItemStatuses: ['Green', 'Red'] },
    });

    expect(values(fixture)).toHaveLength(2);
    for (const value of values(fixture)) {
      expect(value.gallerySourceTypeOptions).toEqual(['News', 'Social']);
      expect(value.galleryItemStatusOptions).toEqual(['Green', 'Red']);
    }
  });
});
