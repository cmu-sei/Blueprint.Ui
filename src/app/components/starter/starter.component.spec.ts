// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ComnAuthService, ComnSettingsService, Theme } from '@cmusei/crucible-common';
import { Msel, SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { StarterComponent } from './starter.component';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
}
@Component({ selector: 'app-scenario-event-list', template: '', standalone: false })
class ScenarioEventListStub {
  @Input() loggedInUserId: string;
  @Input() userTheme: Theme;
  @Input() isStarterMsel: boolean;
}

const MSEL: Msel = { id: 'msel-1', name: 'Starter Exercise', createdBy: 'someone-else', userMselRoles: [] };
const ALL_BUT_CREATE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.CreateMsels);

async function renderStarter(overrides: { permissions?: SystemPermission[]; mselId?: string } = {}) {
  const { permissions = [], mselId } = overrides;
  const apis = mselLoadApiStubs({ msel: MSEL });
  // The MSEL answers after the component has initialized, as HTTP does.
  const mselResponse = new Subject<Msel>();
  apis.msel.getMsel.mockImplementation(() => mselResponse);
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    join: vi.fn(),
    selectMsel: vi.fn(),
  } satisfies Pick<SignalRService, 'startConnection' | 'join' | 'selectMsel'>;
  // StarterComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const { route } = activatedRouteStub(mselId ? { msel: mselId } : {});
  const rendered = await renderComponent(StarterComponent, {
    declarations: [StarterComponent, TopbarStub, ScenarioEventListStub],
    providers: [
      ...mselLoadApiProviders(apis),
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: SignalRService, useValue: signalR },
      { provide: ActivatedRoute, useValue: route },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTitle: 'Blueprint', AppTopBarText: 'Blueprint Starter', AppTopBarImage: '' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: 'user-me', name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  mselResponse.next(structuredClone(MSEL));
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, apis, signalR, permissionApis };
}

function child<T>(fixture: ComponentFixture<unknown>, stub: new (...args: never[]) => T): T | undefined {
  return fixture.debugElement.query(By.directive(stub))?.componentInstance;
}

describe('StarterComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: the component counts the user as a content developer only with CreateMsels.
   * Interacts with: real PermissionDataService over SystemPermissionsService.getMySystemPermissions (stub).
   * Data: CreateMsels, or every other permission (near miss).
   */
  it.each([
    { permissions: [SystemPermission.CreateMsels], expected: true },
    { permissions: ALL_BUT_CREATE_MSELS, expected: false },
  ])('sets isContentDeveloper $expected from CreateMsels', async ({ permissions, expected }) => {
    const { fixture, permissionApis } = await renderStarter({ permissions });

    expect(permissionApis.systemPermissions.getMySystemPermissions).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.isContentDeveloper).toBe(expected);
  });

  /**
   * Verifies: without an msel parameter the page loads the units and organization templates, joins the home hub, shows the configured title and no event list.
   * Interacts with: UnitService.getUnits and OrganizationService.getOrganizationTemplates (stubs), SignalRService (stub), Title.
   * Data: no msel query parameter.
   */
  it('starts without an MSEL', async () => {
    const { fixture, apis, signalR } = await renderStarter();

    expect(apis.unit.getUnits).toHaveBeenCalledTimes(1);
    expect(apis.organization.getOrganizationTemplates).toHaveBeenCalledTimes(1);
    expect(apis.msel.getMsel).not.toHaveBeenCalled();
    expect(signalR.startConnection).toHaveBeenCalledWith(ApplicationArea.home);
    expect(signalR.selectMsel).toHaveBeenCalledWith('');
    expect(child(fixture, TopbarStub)?.title).toBe('Blueprint Starter');
    expect(child(fixture, ScenarioEventListStub)).toBeUndefined();
  });

  /**
   * Verifies: with an msel parameter the page loads that MSEL and its data, makes it active, titles the page after it, and shows its events as a starter MSEL.
   * Interacts with: the MSEL endpoints (stubs), real MselDataService and MselQuery, SignalRService.selectMsel, Title.
   * Data: msel=msel-1, "Starter Exercise".
   */
  it('opens the MSEL named in the route', async () => {
    const { fixture, apis, signalR } = await renderStarter({ mselId: 'msel-1' });

    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.scenarioEvent.getScenarioEventsByMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.user.getMselUsers).toHaveBeenCalledWith('msel-1');
    expect(TestBed.inject(MselQuery).getActiveId()).toBe('msel-1');
    expect(TestBed.inject(Title).getTitle()).toBe('Blueprint - Starter Exercise');
    expect(child(fixture, TopbarStub)?.title).toBe('Blueprint - Starter Exercise');
    expect(signalR.selectMsel).toHaveBeenCalledWith('msel-1');
    const events = child(fixture, ScenarioEventListStub);
    expect(events?.isStarterMsel).toBe(true);
    expect(events?.loggedInUserId).toBe('user-me');
  });
});
