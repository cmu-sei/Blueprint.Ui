// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SignalRService } from './signalr.service';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { CardDataService } from '../data/card/card-data.service';
import { CardTeamDataService } from '../data/team/card-team-data.service';
import { CatalogDataService } from '../data/catalog/catalog-data.service';
import { CiteActionDataService } from '../data/cite-action/cite-action-data.service';
import { CiteDutyDataService } from '../data/cite-duty/cite-duty-data.service';
import { DataFieldDataService } from '../data/data-field/data-field-data.service';
import { DataOptionDataService } from '../data/data-option/data-option-data.service';
import { DataValueDataService } from '../data/data-value/data-value-data.service';
import { InjectmDataService } from '../data/injectm/injectm-data.service';
import { InjectTypeDataService } from '../data/inject-type/inject-type-data.service';
import { MoveDataService } from '../data/move/move-data.service';
import { MselDataService } from '../data/msel/msel-data.service';
import { MselUnitDataService } from '../data/msel-unit/msel-unit-data.service';
import { OrganizationDataService } from '../data/organization/organization-data.service';
import { PlayerApplicationDataService } from '../data/player-application/player-application-data.service';
import { PlayerApplicationTeamDataService } from '../data/team/player-application-team-data.service';
import { ScenarioEventDataService } from '../data/scenario-event/scenario-event-data.service';
import { TeamDataService } from '../data/team/team-data.service';
import { TeamUserDataService } from '../data/team-user/team-user-data.service';
import { UserDataService } from '../data/user/user-data.service';
import { UserMselRoleDataService } from '../data/user-msel-role/user-msel-role-data.service';

function createMockDataService() {
  return {
    updateStore: () => {},
    deleteFromStore: () => {},
    load: () => of([]),
  };
}

function setupSignalRTest() {
  TestBed.configureTestingModule({
    providers: [
      SignalRService,
      {
        provide: ComnAuthService,
        useValue: {
          isAuthenticated$: of(true),
          user$: of({}),
          logout: () => {},
          getAuthorizationToken: () => 'mock-token',
        },
      },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: { ApiUrl: 'http://localhost:4725' },
        },
      },
      { provide: CardDataService, useValue: createMockDataService() },
      { provide: CardTeamDataService, useValue: createMockDataService() },
      { provide: CatalogDataService, useValue: createMockDataService() },
      { provide: CiteActionDataService, useValue: createMockDataService() },
      { provide: CiteDutyDataService, useValue: createMockDataService() },
      { provide: DataFieldDataService, useValue: createMockDataService() },
      { provide: DataOptionDataService, useValue: createMockDataService() },
      { provide: DataValueDataService, useValue: createMockDataService() },
      { provide: InjectmDataService, useValue: createMockDataService() },
      { provide: InjectTypeDataService, useValue: createMockDataService() },
      { provide: MoveDataService, useValue: createMockDataService() },
      {
        provide: MselDataService,
        useValue: {
          ...createMockDataService(),
          mselPushStatusChange: () => {},
          setActive: () => {},
          delete: () => {},
        },
      },
      { provide: MselUnitDataService, useValue: createMockDataService() },
      { provide: OrganizationDataService, useValue: createMockDataService() },
      { provide: PlayerApplicationDataService, useValue: createMockDataService() },
      { provide: PlayerApplicationTeamDataService, useValue: createMockDataService() },
      { provide: ScenarioEventDataService, useValue: createMockDataService() },
      { provide: TeamDataService, useValue: createMockDataService() },
      { provide: TeamUserDataService, useValue: createMockDataService() },
      {
        provide: UserDataService,
        useValue: {
          ...createMockDataService(),
          setCurrentUser: () => {},
          setUserTheme: () => {},
        },
      },
      { provide: UserMselRoleDataService, useValue: createMockDataService() },
    ],
  });

  return TestBed.inject(SignalRService);
}

describe('SignalRService', () => {
  it('should be created', () => {
    const service = setupSignalRTest();
    expect(service).toBeTruthy();
  });

  it('should have startConnection method', () => {
    const service = setupSignalRTest();
    expect(typeof service.startConnection).toBe('function');
  });

  it('should have join method', () => {
    const service = setupSignalRTest();
    expect(typeof service.join).toBe('function');
  });

  it('should have leave method', () => {
    const service = setupSignalRTest();
    expect(typeof service.leave).toBe('function');
  });

  it('should have selectMsel method', () => {
    const service = setupSignalRTest();
    expect(typeof service.selectMsel).toBe('function');
  });

  it('should be injectable', () => {
    const service = setupSignalRTest();
    expect(service).toBeInstanceOf(SignalRService);
  });
});
