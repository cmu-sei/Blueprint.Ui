// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EMPTY, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  CrucibleDialogService,
  CrucibleThemeService,
} from '@cmusei/crucible-common';
import { AnyProvider, mergeProviders, unstubbed } from './unstubbed';

// 1. App services that components inject. Stores, queries and data services
//    (src/app/data/**, including PermissionDataService) stay REAL: they are the
//    state under test. Do not list them here.
import { ErrorService } from '../services/error/error.service';
import { SignalRService } from '../services/signalr.service';
import { SystemMessageService } from '../services/system-message/system-message.service';
import { XApiService as AppXApiService } from '../services/xapi/xapi.service';

// 2. Every generated API service under src/app/generated/blueprint.api.
import {
  CardService,
  CardTeamService,
  CatalogInjectService,
  CatalogService,
  CatalogUnitService,
  CiteActionService,
  CiteDutyService,
  CiteService,
  CompetencyFrameworkService,
  DataFieldService,
  DataOptionService,
  DataValueService,
  GroupService,
  HealthCheckService,
  InjectService,
  InjectTypeService,
  InvitationService,
  LmtService,
  MoveService,
  MselCompetencyService,
  MselPageService,
  MselService,
  MselUnitService,
  OrganizationService,
  PlayerApplicationService,
  PlayerApplicationTeamService,
  PlayerService,
  ProficiencyLevelService,
  ProficiencyScaleService,
  ScenarioEventService,
  SystemPermissionsService,
  SystemRolesService,
  TeamCompetencyService,
  TeamService,
  TeamUserService,
  UnitService,
  UnitUserService,
  UserMselRoleService,
  UserService,
  UserTeamRoleService,
  XApiService,
} from '../generated/blueprint.api';

// 3. RouterQuery: not needed. app.module imports AkitaNgRouterStoreModule, but
//    no code injects RouterQuery.

// 4. BASE_PATH: not needed. Only app.module provides it; no data or hub
//    service injects it.

// 5. Every other common-library service the app injects, as a placeholder
//    under "Common library": CrucibleDialogService (the list components'
//    confirm dialogs). ComnAuthGuardService is only a route guard.

export function getDefaultProviders(
  overrides?: readonly AnyProvider[],
): AnyProvider[] {
  const defaults: AnyProvider[] = [
    // App services
    { provide: ErrorService, useValue: { handleError: () => {} } },
    unstubbed(SignalRService),
    unstubbed(SystemMessageService),
    unstubbed(AppXApiService, 'XApiService (app)'),

    // Generated API services: one `unstubbed(...)` per service. A test that
    // needs an endpoint passes `{ provide: XService, useValue: xApi }` built
    // with `satisfies ApiStub<XService>`.
    unstubbed(CardService),
    unstubbed(CardTeamService),
    unstubbed(CatalogInjectService),
    unstubbed(CatalogService),
    unstubbed(CatalogUnitService),
    unstubbed(CiteActionService),
    unstubbed(CiteDutyService),
    unstubbed(CiteService),
    unstubbed(CompetencyFrameworkService),
    unstubbed(DataFieldService),
    unstubbed(DataOptionService),
    unstubbed(DataValueService),
    unstubbed(GroupService),
    unstubbed(HealthCheckService),
    unstubbed(InjectService),
    unstubbed(InjectTypeService),
    unstubbed(InvitationService),
    unstubbed(LmtService),
    unstubbed(MoveService),
    unstubbed(MselCompetencyService),
    unstubbed(MselPageService),
    unstubbed(MselService),
    unstubbed(MselUnitService),
    unstubbed(OrganizationService),
    unstubbed(PlayerApplicationService),
    unstubbed(PlayerApplicationTeamService),
    unstubbed(PlayerService),
    unstubbed(ProficiencyLevelService),
    unstubbed(ProficiencyScaleService),
    unstubbed(ScenarioEventService),
    unstubbed(SystemPermissionsService),
    unstubbed(SystemRolesService),
    unstubbed(TeamCompetencyService),
    unstubbed(TeamService),
    unstubbed(TeamUserService),
    unstubbed(UnitService),
    unstubbed(UnitUserService),
    unstubbed(UserMselRoleService),
    unstubbed(UserService),
    unstubbed(UserTeamRoleService),
    unstubbed(XApiService, 'XApiService (generated)'),

    // Common library
    unstubbed(CrucibleDialogService),
    unstubbed(CrucibleThemeService), // injected by app.component.ts (crucible-theme)
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          // 6. Keys this app reads from settings.json, with neutral values.
          ApiUrl: '',
          AppTitle: '',
          AppTopBarText: '',
          AppTopBarHexColor: '#000000',
          AppTopBarHexTextColor: '#FFFFFF',
          AppTopBarImage: '',
          LightThemeTint: '',
          DarkThemeTint: '',
          DefaultDataFields: [],
          ScenarioEventBackgroundColors: [],
          XApiEnabled: false,
        },
      },
    },
    {
      provide: ComnAuthService,
      useValue: {
        isAuthenticated$: of(true),
        user$: of({ profile: { sub: '' } }),
        logout: () => {},
      },
    },
    {
      provide: ComnAuthQuery,
      useValue: {
        userTheme$: of('light-theme'),
        isLoggedIn$: of(true),
      },
    },

    // Dialog tokens
    { provide: MAT_DIALOG_DATA, useValue: {} },
    {
      provide: MatDialogRef,
      useValue: {
        close: () => {},
        beforeClosed: () => EMPTY,
        afterClosed: () => EMPTY,
        keydownEvents: () => EMPTY,
      },
    },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of(convertToParamMap({})),
        queryParams: of({}),
        queryParamMap: of(convertToParamMap({})),
        snapshot: {
          params: {},
          paramMap: convertToParamMap({}),
          queryParams: {},
          queryParamMap: convertToParamMap({}),
        },
      },
    },
  ];

  return mergeProviders(defaults, overrides);
}
