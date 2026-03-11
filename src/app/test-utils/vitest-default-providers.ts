// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

// Akita Stores
import { UserStore, CurrentUserStore } from '../data/user/user.store';
import { CiteDutyStore } from '../data/cite-duty/cite-duty.store';
import { UnitStore } from '../data/unit/unit.store';
import { UserMselRoleStore } from '../data/user-msel-role/user-msel-role.store';
import { UserTeamRoleStore } from '../data/user-team-role/user-team-role.store';
import { MselStore } from '../data/msel/msel.store';
import { OrganizationStore } from '../data/organization/organization.store';
import { PlayerApplicationStore } from '../data/player-application/player-application.store';
import { ScenarioEventStore } from '../data/scenario-event/scenario-event.store';
import { TeamUserStore } from '../data/team-user/team-user.store';
import { TeamStore } from '../data/team/team.store';
import { DataOptionStore } from '../data/data-option/data-option.store';
import { DataValueStore } from '../data/data-value/data-value.store';
import { InjectTypeStore } from '../data/inject-type/inject-type.store';
import { InjectmStore } from '../data/injectm/injectm.store';
import { InvitationStore } from '../data/invitation/invitation.store';
import { MoveStore } from '../data/move/move.store';
import { MselPageStore } from '../data/msel-page/msel-page.store';
import { MselUnitStore } from '../data/msel-unit/msel-unit.store';
import { CardStore } from '../data/card/card.store';
import { CatalogInjectStore } from '../data/catalog-inject/catalog-inject.store';
import { CatalogUnitStore } from '../data/catalog-unit/catalog-unit.store';
import { CatalogStore } from '../data/catalog/catalog.store';
import { CiteActionStore } from '../data/cite-action/cite-action.store';
import { DataFieldTemplateStore } from '../data/data-field/data-field-template.store';
import { DataFieldStore } from '../data/data-field/data-field.store';

// Akita Queries
import { UserQuery, CurrentUserQuery } from '../data/user/user.query';
import { CiteDutyQuery } from '../data/cite-duty/cite-duty.query';
import { UnitQuery } from '../data/unit/unit.query';
import { UserMselRoleQuery } from '../data/user-msel-role/user-msel-role.query';
import { UserTeamRoleQuery } from '../data/user-team-role/user-team-role.query';
import { MselQuery } from '../data/msel/msel.query';
import { OrganizationQuery } from '../data/organization/organization.query';
import { PlayerApplicationQuery } from '../data/player-application/player-application.query';
import { ScenarioEventQuery } from '../data/scenario-event/scenario-event.query';
import { TeamUserQuery } from '../data/team-user/team-user.query';
import { TeamQuery } from '../data/team/team.query';
import { DataOptionQuery } from '../data/data-option/data-option.query';
import { DataValueQuery } from '../data/data-value/data-value.query';
import { InjectTypeQuery } from '../data/inject-type/inject-type.query';
import { InjectmQuery } from '../data/injectm/injectm.query';
import { InvitationQuery } from '../data/invitation/invitation.query';
import { MoveQuery } from '../data/move/move.query';
import { MselPageQuery } from '../data/msel-page/msel-page.query';
import { MselUnitQuery } from '../data/msel-unit/msel-unit.query';
import { CardQuery } from '../data/card/card.query';
import { CatalogInjectQuery } from '../data/catalog-inject/catalog-inject.query';
import { CatalogUnitQuery } from '../data/catalog-unit/catalog-unit.query';
import { CatalogQuery } from '../data/catalog/catalog.query';
import { CiteActionQuery } from '../data/cite-action/cite-action.query';
import { DataFieldTemplateQuery } from '../data/data-field/data-field-template.query';
import { DataFieldQuery } from '../data/data-field/data-field.query';

// Data Services
import { SystemRoleDataService } from '../data/system-role/system-role-data.service';
import { CiteDutyDataService } from '../data/cite-duty/cite-duty-data.service';
import { UnitDataService } from '../data/unit/unit-data.service';
import { UserDataService } from '../data/user/user-data.service';
import { CatalogInjectDataService } from '../data/catalog-inject/catalog-inject-data.service';
import { UnitUserDataService } from '../data/user/unit-user-data.service';
import { CatalogUnitDataService } from '../data/catalog-unit/catalog-unit-data.service';
import { MselPageDataService } from '../data/msel-page/msel-page-data.service';
import { GroupMembershipDataService } from '../data/group/group-membership-data.service';
import { InjectTypeDataService } from '../data/inject-type/inject-type-data.service';
import { GroupDataService } from '../data/group/group-data.service';
import { DataFieldDataService } from '../data/data-field/data-field-data.service';
import { MselDataService } from '../data/msel/msel-data.service';
import { DataOptionDataService } from '../data/data-option/data-option-data.service';
import { MselUnitDataService } from '../data/msel-unit/msel-unit-data.service';
import { PermissionDataService } from '../data/permission/permission-data.service';
import { DataValueDataService } from '../data/data-value/data-value-data.service';
import { CardDataService } from '../data/card/card-data.service';
import { ScenarioEventDataService } from '../data/scenario-event/scenario-event-data.service';
import { UIDataService } from '../data/ui/ui-data.service';
import { CiteActionDataService } from '../data/cite-action/cite-action-data.service';
import { UserTeamRoleDataService } from '../data/user-team-role/user-team-role-data.service';
import { InjectmDataService } from '../data/injectm/injectm-data.service';
import { MoveDataService } from '../data/move/move-data.service';
import { TeamDataService } from '../data/team/team-data.service';
import { OrganizationDataService } from '../data/organization/organization-data.service';
import { TeamUserDataService } from '../data/team-user/team-user-data.service';
import { CardTeamDataService } from '../data/team/card-team-data.service';
import { PlayerApplicationTeamDataService } from '../data/team/player-application-team-data.service';
import { UserMselRoleDataService } from '../data/user-msel-role/user-msel-role-data.service';
import { PlayerApplicationDataService } from '../data/player-application/player-application-data.service';
import { CatalogDataService } from '../data/catalog/catalog-data.service';
import { InvitationDataService } from '../data/invitation/invitation-data.service';

// App Services
import { SignalRService } from '../services/signalr.service';
import { DialogService } from '../services/dialog/dialog.service';
import { ErrorService } from '../services/error/error.service';
import { SystemMessageService } from '../services/system-message/system-message.service';

// Generated API Services
import {
  CardService as ApiCardService,
  CardTeamService as ApiCardTeamService,
  CatalogService as ApiCatalogService,
  CatalogInjectService as ApiCatalogInjectService,
  CatalogUnitService as ApiCatalogUnitService,
  CiteService as ApiCiteService,
  CiteActionService as ApiCiteActionService,
  CiteDutyService as ApiCiteDutyService,
  DataFieldService as ApiDataFieldService,
  DataOptionService as ApiDataOptionService,
  DataValueService as ApiDataValueService,
  GroupService as ApiGroupService,
  HealthCheckService,
  InjectService as ApiInjectService,
  InjectTypeService as ApiInjectTypeService,
  InvitationService as ApiInvitationService,
  MoveService as ApiMoveService,
  MselService as ApiMselService,
  MselPageService as ApiMselPageService,
  MselUnitService as ApiMselUnitService,
  OrganizationService as ApiOrganizationService,
  PlayerService as ApiPlayerService,
  PlayerApplicationService as ApiPlayerApplicationService,
  PlayerApplicationTeamService as ApiPlayerApplicationTeamService,
  ScenarioEventService as ApiScenarioEventService,
  SystemPermissionsService,
  SystemRolesService,
  TeamService as ApiTeamService,
  TeamUserService as ApiTeamUserService,
  UnitService as ApiUnitService,
  UnitUserService as ApiUnitUserService,
  UserService as ApiUserService,
  UserMselRoleService as ApiUserMselRoleService,
  UserTeamRoleService as ApiUserTeamRoleService,
} from '../generated/blueprint.api';

// Generated API services not in barrel
import { CiteRoleService } from '../generated/blueprint.api/api/citeRole.service';
import { PermissionService as ApiPermissionService } from '../generated/blueprint.api/api/permission.service';
import { UserPermissionService } from '../generated/blueprint.api/api/userPermission.service';

// Common library
import { ComnSettingsService, ComnAuthService, ComnAuthQuery } from '@cmusei/crucible-common';

function getProvideToken(provider: any): any {
  if (typeof provider === 'function') return provider;
  return provider?.provide;
}

export function getDefaultProviders(overrides?: Provider[]): Provider[] {
  const defaults: Provider[] = [
    // Akita Stores
    { provide: UserStore, useValue: {} },
    { provide: CurrentUserStore, useValue: {} },
    { provide: CiteDutyStore, useValue: {} },
    { provide: UnitStore, useValue: {} },
    { provide: UserMselRoleStore, useValue: {} },
    { provide: UserTeamRoleStore, useValue: {} },
    { provide: MselStore, useValue: {} },
    { provide: OrganizationStore, useValue: {} },
    { provide: PlayerApplicationStore, useValue: {} },
    { provide: ScenarioEventStore, useValue: {} },
    { provide: TeamUserStore, useValue: {} },
    { provide: TeamStore, useValue: {} },
    { provide: DataOptionStore, useValue: {} },
    { provide: DataValueStore, useValue: {} },
    { provide: InjectTypeStore, useValue: {} },
    { provide: InjectmStore, useValue: {} },
    { provide: InvitationStore, useValue: {} },
    { provide: MoveStore, useValue: {} },
    { provide: MselPageStore, useValue: {} },
    { provide: MselUnitStore, useValue: {} },
    { provide: CardStore, useValue: {} },
    { provide: CatalogInjectStore, useValue: {} },
    { provide: CatalogUnitStore, useValue: {} },
    { provide: CatalogStore, useValue: {} },
    { provide: CiteActionStore, useValue: {} },
    { provide: DataFieldTemplateStore, useValue: {} },
    { provide: DataFieldStore, useValue: {} },

    // Akita Queries
    {
      provide: UserQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectLoading: () => of(false),
      },
    },
    {
      provide: CurrentUserQuery,
      useValue: {
        userTheme$: of('light-theme'),
        select: () => of({ name: '', id: '', theme: 'light-theme' }),
      },
    },
    {
      provide: CiteDutyQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: UnitQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: UserMselRoleQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: UserTeamRoleQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: MselQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectActive: () => of(null),
        selectEntity: () => of(null),
        selectLoading: () => of(false),
      },
    },
    {
      provide: OrganizationQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: PlayerApplicationQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: ScenarioEventQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: TeamUserQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: TeamQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: DataOptionQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: DataValueQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: InjectTypeQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: InjectmQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: InvitationQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: MoveQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: MselPageQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: MselUnitQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: CardQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: CatalogInjectQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: CatalogUnitQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: CatalogQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: CiteActionQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: DataFieldTemplateQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },
    {
      provide: DataFieldQuery,
      useValue: { selectAll: () => of([]), select: () => of(null), selectEntity: () => of(null) },
    },

    // Data Services
    { provide: SystemRoleDataService, useValue: { load: () => of([]) } },
    { provide: CiteDutyDataService, useValue: { load: () => of([]) } },
    { provide: UnitDataService, useValue: { load: () => of([]) } },
    {
      provide: UserDataService,
      useValue: {
        setCurrentUser: () => {},
        load: () => of([]),
        setUserTheme: () => {},
      },
    },
    { provide: CatalogInjectDataService, useValue: { load: () => of([]) } },
    { provide: UnitUserDataService, useValue: { load: () => of([]) } },
    { provide: CatalogUnitDataService, useValue: { load: () => of([]) } },
    { provide: MselPageDataService, useValue: { load: () => of([]) } },
    { provide: GroupMembershipDataService, useValue: { load: () => of([]) } },
    { provide: InjectTypeDataService, useValue: { load: () => of([]) } },
    { provide: GroupDataService, useValue: { load: () => of([]) } },
    { provide: DataFieldDataService, useValue: { load: () => of([]) } },
    {
      provide: MselDataService,
      useValue: {
        load: () => of([]),
        setActive: () => {},
        delete: () => {},
      },
    },
    { provide: DataOptionDataService, useValue: { load: () => of([]) } },
    { provide: MselUnitDataService, useValue: { load: () => of([]) } },
    {
      provide: PermissionDataService,
      useValue: {
        permissions: [],
        load: () => of([]),
        hasPermission: () => false,
        canViewAdministration: () => false,
      },
    },
    { provide: DataValueDataService, useValue: { load: () => of([]) } },
    { provide: CardDataService, useValue: { load: () => of([]) } },
    { provide: ScenarioEventDataService, useValue: { load: () => of([]) } },
    {
      provide: UIDataService,
      useValue: { inIframe: () => false },
    },
    { provide: CiteActionDataService, useValue: { load: () => of([]) } },
    { provide: UserTeamRoleDataService, useValue: { load: () => of([]) } },
    { provide: InjectmDataService, useValue: { load: () => of([]) } },
    { provide: MoveDataService, useValue: { load: () => of([]) } },
    { provide: TeamDataService, useValue: { load: () => of([]) } },
    { provide: OrganizationDataService, useValue: { load: () => of([]) } },
    { provide: TeamUserDataService, useValue: { load: () => of([]) } },
    { provide: CardTeamDataService, useValue: { load: () => of([]) } },
    { provide: PlayerApplicationTeamDataService, useValue: { load: () => of([]) } },
    { provide: UserMselRoleDataService, useValue: { load: () => of([]) } },
    { provide: PlayerApplicationDataService, useValue: { load: () => of([]) } },
    { provide: CatalogDataService, useValue: { load: () => of([]) } },
    { provide: InvitationDataService, useValue: { load: () => of([]) } },

    // App Services
    {
      provide: SignalRService,
      useValue: {
        startConnection: () => Promise.resolve(),
        join: () => {},
        leave: () => {},
        selectMsel: () => {},
      },
    },
    { provide: DialogService, useValue: { confirm: () => of(true) } },
    { provide: ErrorService, useValue: { handleError: () => {} } },
    { provide: SystemMessageService, useValue: {} },

    // Generated API Services
    { provide: ApiCardService, useValue: {} },
    { provide: ApiCardTeamService, useValue: {} },
    { provide: ApiCatalogService, useValue: {} },
    { provide: ApiCatalogInjectService, useValue: {} },
    { provide: ApiCatalogUnitService, useValue: {} },
    { provide: ApiCiteService, useValue: {} },
    { provide: ApiCiteActionService, useValue: {} },
    { provide: ApiCiteDutyService, useValue: {} },
    { provide: ApiDataFieldService, useValue: {} },
    { provide: ApiDataOptionService, useValue: {} },
    { provide: ApiDataValueService, useValue: {} },
    { provide: ApiGroupService, useValue: {} },
    {
      provide: HealthCheckService,
      useValue: {
        getReadiness: () => of({ status: 'Healthy' }),
      },
    },
    { provide: ApiInjectService, useValue: {} },
    { provide: ApiInjectTypeService, useValue: {} },
    { provide: ApiInvitationService, useValue: {} },
    { provide: ApiMoveService, useValue: {} },
    { provide: ApiMselService, useValue: {} },
    { provide: ApiMselPageService, useValue: {} },
    { provide: ApiMselUnitService, useValue: {} },
    { provide: ApiOrganizationService, useValue: {} },
    { provide: ApiPlayerService, useValue: {} },
    { provide: ApiPlayerApplicationService, useValue: {} },
    { provide: ApiPlayerApplicationTeamService, useValue: {} },
    { provide: ApiScenarioEventService, useValue: {} },
    { provide: SystemPermissionsService, useValue: { getMySystemPermissions: () => of([]) } },
    { provide: SystemRolesService, useValue: {} },
    { provide: ApiTeamService, useValue: {} },
    { provide: ApiTeamUserService, useValue: {} },
    { provide: ApiUnitService, useValue: {} },
    { provide: ApiUnitUserService, useValue: {} },
    { provide: ApiUserService, useValue: {} },
    { provide: ApiUserMselRoleService, useValue: {} },
    { provide: ApiUserTeamRoleService, useValue: {} },
    // Not in barrel
    { provide: CiteRoleService, useValue: {} },
    { provide: ApiPermissionService, useValue: {} },
    { provide: UserPermissionService, useValue: {} },

    // Common library services
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          ApiUrl: '',
          AppTitle: 'Blueprint',
          AppTopBarText: 'Blueprint',
          AppTopBarHexColor: '#0F1D47',
          AppTopBarHexTextColor: '#FFFFFF',
          AppTopBarImage: '',
        },
      },
    },
    {
      provide: ComnAuthService,
      useValue: {
        isAuthenticated$: of(true),
        user$: of({}),
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
    { provide: MatDialogRef, useValue: { close: () => {} } },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of({ get: () => null, has: () => false }),
        queryParams: of({}),
        queryParamMap: of({ get: () => null, has: () => false }),
        snapshot: {
          params: {},
          paramMap: { get: () => null, has: () => false },
        },
      },
    },
  ];

  if (!overrides?.length) return defaults;

  const overrideTokens = new Set(overrides.map(getProvideToken));
  const filtered = defaults.filter(
    (p) => !overrideTokens.has(getProvideToken(p))
  );
  return [...filtered, ...overrides];
}
