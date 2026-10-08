// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Fakes the generated API endpoints a page calls when it opens an MSEL
// (StarterComponent, MselComponent, EventDetailPageComponent and the other
// page components load the MSEL, its moves, teams, data fields, values,
// events, roles and users from their route). Each endpoint answers with a
// fresh copy of the rows given, so the REAL data services fill the REAL stores
// as they do in the app. Pass only the rows a spec reads; the rest answer [].

import { Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  Card,
  CardService,
  CardTeam,
  CardTeamService,
  Catalog,
  CatalogService,
  CiteAction,
  CiteActionService,
  CiteDuty,
  CiteDutyService,
  DataField,
  DataFieldService,
  DataOption,
  DataOptionService,
  DataValue,
  DataValueService,
  Invitation,
  InvitationService,
  Move,
  MoveService,
  Msel,
  MselService,
  MselUnit,
  MselUnitService,
  Organization,
  OrganizationService,
  ScenarioEvent,
  ScenarioEventService,
  Team,
  TeamService,
  TeamUser,
  TeamUserService,
  Unit,
  UnitService,
  User,
  UserMselRole,
  UserMselRoleService,
  UserService,
  UserTeamRole,
  UserTeamRoleService,
} from '../generated/blueprint.api';
import { ApiStub } from './api-stub';

export interface MselLoadRows {
  msel: Msel;
  cards?: Card[];
  cardTeams?: CardTeam[];
  catalogs?: Catalog[];
  citeActions?: CiteAction[];
  citeDuties?: CiteDuty[];
  dataFields?: DataField[];
  dataOptions?: DataOption[];
  dataValues?: DataValue[];
  invitations?: Invitation[];
  moves?: Move[];
  mselUnits?: MselUnit[];
  organizations?: Organization[];
  scenarioEvents?: ScenarioEvent[];
  teams?: Team[];
  teamUsers?: TeamUser[];
  units?: Unit[];
  users?: User[];
  userMselRoles?: UserMselRole[];
  userTeamRoles?: UserTeamRole[];
}

// A fresh copy per call: Akita deep-freezes what it stores, and the data
// services write parsed dates onto each response.
const rows = <T>(list: T[] | undefined) => vi.fn(() => of(structuredClone(list ?? [])));

export function mselLoadApiStubs(data: MselLoadRows) {
  return {
    msel: {
      getMsel: vi.fn(() => of(structuredClone(data.msel))),
    } satisfies ApiStub<MselService>,
    card: { getCardsByMsel: rows(data.cards) } satisfies ApiStub<CardService>,
    cardTeam: { getMselCardTeams: rows(data.cardTeams) } satisfies ApiStub<CardTeamService>,
    catalog: { getMyCatalogs: rows(data.catalogs) } satisfies ApiStub<CatalogService>,
    citeAction: { getActionsByMsel: rows(data.citeActions) } satisfies ApiStub<CiteActionService>,
    citeDuty: { getDutiesByMsel: rows(data.citeDuties) } satisfies ApiStub<CiteDutyService>,
    dataField: { getDataFieldsByMsel: rows(data.dataFields) } satisfies ApiStub<DataFieldService>,
    dataOption: { getDataOptionsByMsel: rows(data.dataOptions) } satisfies ApiStub<DataOptionService>,
    dataValue: { getDataValuesByMsel: rows(data.dataValues) } satisfies ApiStub<DataValueService>,
    invitation: { getInvitations: rows(data.invitations) } satisfies ApiStub<InvitationService>,
    move: { getMovesByMsel: rows(data.moves) } satisfies ApiStub<MoveService>,
    mselUnit: { getMselUnits: rows(data.mselUnits) } satisfies ApiStub<MselUnitService>,
    organization: {
      getOrganizationsByMsel: rows(data.organizations),
      getOrganizationTemplates: rows<Organization>([]),
    } satisfies ApiStub<OrganizationService>,
    scenarioEvent: {
      getScenarioEventsByMsel: rows(data.scenarioEvents),
      getScenarioEvent: vi.fn((id: string) =>
        of(structuredClone((data.scenarioEvents ?? []).find((se) => se.id === id) ?? {})),
      ),
    } satisfies ApiStub<ScenarioEventService>,
    team: { getTeamsByMsel: rows(data.teams) } satisfies ApiStub<TeamService>,
    teamUser: { getMselTeamUsers: rows(data.teamUsers) } satisfies ApiStub<TeamUserService>,
    unit: { getUnits: rows(data.units) } satisfies ApiStub<UnitService>,
    user: { getMselUsers: rows(data.users) } satisfies ApiStub<UserService>,
    userMselRole: { getUserMselRolesByMsel: rows(data.userMselRoles) } satisfies ApiStub<UserMselRoleService>,
    userTeamRole: { getUserTeamRolesByMsel: rows(data.userTeamRoles) } satisfies ApiStub<UserTeamRoleService>,
  };
}

export type MselLoadApiStubs = ReturnType<typeof mselLoadApiStubs>;

/** The providers for `mselLoadApiStubs(...)`; a spec's own provider for one of these services wins when listed after them. */
export function mselLoadApiProviders(stubs: MselLoadApiStubs): Provider[] {
  return [
    { provide: MselService, useValue: stubs.msel },
    { provide: CardService, useValue: stubs.card },
    { provide: CardTeamService, useValue: stubs.cardTeam },
    { provide: CatalogService, useValue: stubs.catalog },
    { provide: CiteActionService, useValue: stubs.citeAction },
    { provide: CiteDutyService, useValue: stubs.citeDuty },
    { provide: DataFieldService, useValue: stubs.dataField },
    { provide: DataOptionService, useValue: stubs.dataOption },
    { provide: DataValueService, useValue: stubs.dataValue },
    { provide: InvitationService, useValue: stubs.invitation },
    { provide: MoveService, useValue: stubs.move },
    { provide: MselUnitService, useValue: stubs.mselUnit },
    { provide: OrganizationService, useValue: stubs.organization },
    { provide: ScenarioEventService, useValue: stubs.scenarioEvent },
    { provide: TeamService, useValue: stubs.team },
    { provide: TeamUserService, useValue: stubs.teamUser },
    { provide: UnitService, useValue: stubs.unit },
    { provide: UserService, useValue: stubs.user },
    { provide: UserMselRoleService, useValue: stubs.userMselRole },
    { provide: UserTeamRoleService, useValue: stubs.userTeamRole },
  ];
}
