/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, OnDestroy } from '@angular/core';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import * as signalR from '@microsoft/signalr';
import {
  Card,
  CardTeam,
  Catalog,
  CiteAction,
  CiteRole,
  DataField,
  DataOption,
  DataValue,
  Injectm,
  InjectType,
  Move,
  Msel,
  MselUnit,
  Organization,
  PlayerApplication,
  PlayerApplicationTeam,
  ScenarioEvent,
  Team,
  TeamUser,
  User,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { CardDataService } from '../data/card/card-data.service';
import { CardTeamDataService } from '../data/team/card-team-data.service';
import { CatalogDataService } from '../data/catalog/catalog-data.service';
import { CiteActionDataService } from '../data/cite-action/cite-action-data.service';
import { CiteRoleDataService } from '../data/cite-role/cite-role-data.service';
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
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from '../data/team-user/team-user-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserMselRoleDataService } from '../data/user-msel-role/user-msel-role-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export enum ApplicationArea {
  home = '',
  admin = 'Admin',
}
@Injectable({
  providedIn: 'root',
})
export class SignalRService implements OnDestroy {
  private hubConnection: signalR.HubConnection;
  private applicationArea: ApplicationArea;
  private connectionPromise: Promise<void>;
  private isJoined = false;
  private mselId = '';
  private token = '';
  private unsubscribe$ = new Subject();

  constructor(
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private cardDataService: CardDataService,
    private cardTeamDataService: CardTeamDataService,
    private catalogDataService: CatalogDataService,
    private citeActionDataService: CiteActionDataService,
    private citeRoleDataService: CiteRoleDataService,
    private dataFieldDataService: DataFieldDataService,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
    private injectmDataService: InjectmDataService,
    private injectTypeDataService: InjectTypeDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselUnitDataService: MselUnitDataService,
    private organizationDataService: OrganizationDataService,
    private playerApplicationDataService: PlayerApplicationDataService,
    private playerApplicationTeamDataService: PlayerApplicationTeamDataService,
    private scenarioEventDataService: ScenarioEventDataService,
    private teamDataService: TeamDataService,
    private teamUserDataService: TeamUserDataService,
    private userDataService: UserDataService,
    private userMselRoleDataService: UserMselRoleDataService
  ) {
    this.authService.user$.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.reconnect();
    });
  }

  public startConnection(applicationArea: ApplicationArea): Promise<void> {
    if (this.connectionPromise && this.applicationArea === applicationArea) {
      return this.connectionPromise;
    }

    this.applicationArea = applicationArea;
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.getHubUrlWithAuth())
      .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection.onreconnected(() => {
      this.join();
    });

    this.addHandlers();
    this.connectionPromise = this.hubConnection.start();
    this.connectionPromise.then((x) => this.join());

    return this.connectionPromise;
  }

  private getHubUrlWithAuth(): string {
    const accessToken = this.authService.getAuthorizationToken();
    if (accessToken !== this.token) {
      this.token = accessToken;
      if (!this.token) {
        location.reload();
      }
    }
    const hubUrl = `${this.settingsService.settings.ApiUrl}/hubs/main?bearer=${accessToken}`;
    return hubUrl;
  }

  public join() {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('Join' + this.applicationArea);
      this.isJoined = true;
      if (this.mselId) {
        setTimeout(() => this.selectMsel(this.mselId), 100);
      }
    }
  }

  public leave() {
    if (this.isJoined) {
      this.hubConnection.invoke('Leave' + this.applicationArea);
    }
    this.isJoined = false;
  }

  public selectMsel(mselId: string) {
    if (this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      setTimeout(() => this.selectMsel(mselId), 500);
    } else if (this.isJoined) {
      if (this.applicationArea !== ApplicationArea.admin) {
        this.hubConnection.invoke('selectMsel', [mselId]);
        this.mselId = mselId;
      }
    }
  }

  private reconnect() {
    if (this.hubConnection != null) {
      this.hubConnection.stop().then(() => {
        this.hubConnection.baseUrl = this.getHubUrlWithAuth();
        this.connectionPromise = this.hubConnection.start();
        this.connectionPromise.then(() => {
          if (
            this.hubConnection.state !== signalR.HubConnectionState.Connected
          ) {
            setTimeout(() => this.reconnect(), 500);
          } else {
            this.join();
          }
        });
      });
    }
  }

  private addHandlers() {
    this.addCardHandlers();
    this.addCardTeamHandlers();
    this.addCatalogHandlers();
    this.addCiteActionHandlers();
    this.addCiteRoleHandlers();
    this.addDataFieldHandlers();
    this.addDataOptionHandlers();
    this.addDataValueHandlers();
    this.addInjectmHandlers();
    this.addInjectTypeHandlers();
    this.addMoveHandlers();
    this.addMselHandlers();
    this.addMselUnitHandlers();
    this.addOrganizationHandlers();
    this.addPlayerApplicationHandlers();
    this.addPlayerApplicationTeamHandlers();
    this.addScenarioEventHandlers();
    this.addTeamHandlers();
    this.addTeamUserHandlers();
    this.addUserHandlers();
    this.addUserMselRoleHandlers();
  }

  private addCardHandlers() {
    this.hubConnection.on('CardUpdated', (card: Card) => {
      this.cardDataService.updateStore(card);
    });

    this.hubConnection.on('CardCreated', (card: Card) => {
      this.cardDataService.updateStore(card);
    });

    this.hubConnection.on('CardDeleted', (id: string) => {
      this.cardDataService.deleteFromStore(id);
    });
  }

  private addCardTeamHandlers() {
    this.hubConnection.on('CardTeamUpdated', (cardTeam: CardTeam) => {
      this.cardTeamDataService.updateStore(cardTeam);
    });

    this.hubConnection.on('CardTeamCreated', (cardTeam: CardTeam) => {
      this.cardTeamDataService.updateStore(cardTeam);
    });

    this.hubConnection.on('CardTeamDeleted', (id: string) => {
      this.cardTeamDataService.deleteFromStore(id);
    });
  }

  private addCatalogHandlers() {
    this.hubConnection.on('CatalogUpdated', (catalog: Catalog) => {
      this.catalogDataService.updateStore(catalog);
    });

    this.hubConnection.on('CatalogCreated', (catalog: Catalog) => {
      this.catalogDataService.updateStore(catalog);
    });

    this.hubConnection.on('CatalogDeleted', (id: string) => {
      this.catalogDataService.deleteFromStore(id);
    });
  }

  private addCiteActionHandlers() {
    this.hubConnection.on('CiteActionUpdated', (citeAction: CiteAction) => {
      this.citeActionDataService.updateStore(citeAction);
    });

    this.hubConnection.on('CiteActionCreated', (citeAction: CiteAction) => {
      this.citeActionDataService.updateStore(citeAction);
    });

    this.hubConnection.on('CiteActionDeleted', (id: string) => {
      this.citeActionDataService.deleteFromStore(id);
    });
  }

  private addCiteRoleHandlers() {
    this.hubConnection.on('CiteRoleUpdated', (citeRole: CiteRole) => {
      this.citeRoleDataService.updateStore(citeRole);
    });

    this.hubConnection.on('CiteRoleCreated', (citeRole: CiteRole) => {
      this.citeRoleDataService.updateStore(citeRole);
    });

    this.hubConnection.on('CiteRoleDeleted', (id: string) => {
      this.citeRoleDataService.deleteFromStore(id);
    });
  }

  private addDataFieldHandlers() {
    this.hubConnection.on('DataFieldUpdated', (dataField: DataField) => {
      this.dataFieldDataService.updateStore(dataField);
    });

    this.hubConnection.on('DataFieldCreated', (dataField: DataField) => {
      this.dataFieldDataService.updateStore(dataField);
    });

    this.hubConnection.on('DataFieldDeleted', (id: string) => {
      this.dataFieldDataService.deleteFromStore(id);
    });
  }

  private addDataOptionHandlers() {
    this.hubConnection.on('DataOptionUpdated', (dataOption: DataOption) => {
      this.dataOptionDataService.updateStore(dataOption);
    });

    this.hubConnection.on('DataOptionCreated', (dataOption: DataOption) => {
      this.dataOptionDataService.updateStore(dataOption);
    });

    this.hubConnection.on('DataOptionDeleted', (id: string) => {
      this.dataOptionDataService.deleteFromStore(id);
    });
  }

  private addDataValueHandlers() {
    this.hubConnection.on('DataValueUpdated', (dataValue: DataValue) => {
      this.dataValueDataService.updateStore(dataValue);
    });

    this.hubConnection.on('DataValueCreated', (dataValue: DataValue) => {
      this.dataValueDataService.updateStore(dataValue);
    });

    this.hubConnection.on('DataValueDeleted', (id: string) => {
      this.dataValueDataService.deleteFromStore(id);
    });
  }

  private addInjectmHandlers() {
    this.hubConnection.on('InjectUpdated', (injectm: Injectm) => {
      this.injectmDataService.updateStore(injectm);
    });

    this.hubConnection.on('InjectCreated', (injectm: Injectm) => {
      this.injectmDataService.updateStore(injectm);
    });

    this.hubConnection.on('InjectDeleted', (id: string) => {
      this.injectmDataService.deleteFromStore(id);
    });
  }

  private addInjectTypeHandlers() {
    this.hubConnection.on('InjectTypeUpdated', (injectType: InjectType) => {
      this.injectTypeDataService.updateStore(injectType);
    });

    this.hubConnection.on('InjectTypeCreated', (injectType: InjectType) => {
      this.injectTypeDataService.updateStore(injectType);
    });

    this.hubConnection.on('InjectTypeDeleted', (id: string) => {
      this.injectTypeDataService.deleteFromStore(id);
    });
  }

  private addMoveHandlers() {
    this.hubConnection.on('MoveUpdated', (move: Move) => {
      this.moveDataService.updateStore(move);
    });

    this.hubConnection.on('MoveCreated', (move: Move) => {
      this.moveDataService.updateStore(move);
    });

    this.hubConnection.on('MoveDeleted', (id: string) => {
      this.moveDataService.deleteFromStore(id);
    });
  }

  private addMselHandlers() {
    this.hubConnection.on('MselUpdated', (msel: Msel) => {
      this.mselDataService.updateStore(msel);
    });

    this.hubConnection.on('MselCreated', (msel: Msel) => {
      this.mselDataService.updateStore(msel);
    });

    this.hubConnection.on('MselDeleted', (id: string) => {
      this.mselDataService.deleteFromStore(id);
    });

    this.hubConnection.on('MselPushStatusChange', (mselPushStatus: string) => {
      this.mselDataService.mselPushStatusChange(mselPushStatus);
    });
  }

  private addMselUnitHandlers() {
    this.hubConnection.on('MselUnitUpdated', (mselUnit: MselUnit) => {
      this.mselUnitDataService.updateStore(mselUnit);
    });

    this.hubConnection.on('MselUnitCreated', (mselUnit: MselUnit) => {
      this.mselUnitDataService.updateStore(mselUnit);
    });

    this.hubConnection.on('MselUnitDeleted', (id: string) => {
      this.mselUnitDataService.deleteFromStore(id);
    });
  }

  private addOrganizationHandlers() {
    this.hubConnection.on(
      'OrganizationUpdated',
      (organization: Organization) => {
        this.organizationDataService.updateStore(organization);
      }
    );

    this.hubConnection.on(
      'OrganizationCreated',
      (organization: Organization) => {
        this.organizationDataService.updateStore(organization);
      }
    );

    this.hubConnection.on('OrganizationDeleted', (id: string) => {
      this.organizationDataService.deleteFromStore(id);
    });
  }

  private addPlayerApplicationHandlers() {
    this.hubConnection.on(
      'PlayerApplicationUpdated',
      (playerApplication: PlayerApplication) => {
        this.playerApplicationDataService.updateStore(playerApplication);
      }
    );

    this.hubConnection.on(
      'PlayerApplicationCreated',
      (playerApplication: PlayerApplication) => {
        this.playerApplicationDataService.updateStore(playerApplication);
      }
    );

    this.hubConnection.on('PlayerApplicationDeleted', (id: string) => {
      this.playerApplicationDataService.deleteFromStore(id);
    });
  }

  private addPlayerApplicationTeamHandlers() {
    this.hubConnection.on(
      'PlayerApplicationTeamUpdated',
      (playerApplicationTeam: PlayerApplicationTeam) => {
        this.playerApplicationTeamDataService.updateStore(
          playerApplicationTeam
        );
      }
    );

    this.hubConnection.on(
      'PlayerApplicationTeamCreated',
      (playerApplicationTeam: PlayerApplicationTeam) => {
        this.playerApplicationTeamDataService.updateStore(
          playerApplicationTeam
        );
      }
    );

    this.hubConnection.on('PlayerApplicationTeamDeleted', (id: string) => {
      this.playerApplicationTeamDataService.deleteFromStore(id);
    });
  }

  private addScenarioEventHandlers() {
    this.hubConnection.on(
      'ScenarioEventUpdated',
      (scenarioEvent: ScenarioEvent) => {
        this.scenarioEventDataService.updateStore(scenarioEvent);
      }
    );

    this.hubConnection.on(
      'ScenarioEventCreated',
      (scenarioEvent: ScenarioEvent) => {
        this.scenarioEventDataService.updateStore(scenarioEvent);
      }
    );

    this.hubConnection.on('ScenarioEventDeleted', (id: string) => {
      this.scenarioEventDataService.deleteFromStore(id);
    });
  }

  private addTeamHandlers() {
    this.hubConnection.on('TeamUpdated', (team: Team) => {
      this.teamDataService.updateStore(team);
    });

    this.hubConnection.on('TeamCreated', (team: Team) => {
      this.teamDataService.updateStore(team);
    });

    this.hubConnection.on('TeamDeleted', (id: string) => {
      this.teamDataService.deleteFromStore(id);
    });
  }

  private addTeamUserHandlers() {
    this.hubConnection.on('TeamUserUpdated', (teamUser: TeamUser) => {
      this.teamUserDataService.updateStore(teamUser);
    });

    this.hubConnection.on('TeamUserCreated', (teamUser: TeamUser) => {
      this.teamUserDataService.updateStore(teamUser);
    });

    this.hubConnection.on('TeamUserDeleted', (teamUser: TeamUser) => {
      this.teamUserDataService.deleteFromStore(teamUser.id);
    });
  }

  private addUserHandlers() {
    this.hubConnection.on('UserUpdated', (user: User) => {
      this.userDataService.updateStore(user);
    });

    this.hubConnection.on('UserCreated', (user: User) => {
      this.userDataService.updateStore(user);
    });

    this.hubConnection.on('UserDeleted', (id: string) => {
      this.userDataService.deleteFromStore(id);
    });
  }

  private addUserMselRoleHandlers() {
    this.hubConnection.on(
      'UserMselRoleCreated',
      (userMselRole: UserMselRole) => {
        this.userMselRoleDataService.updateStore(userMselRole);
      }
    );

    this.hubConnection.on('UserMselRoleDeleted', (id: string) => {
      this.userMselRoleDataService.deleteFromStore(id);
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}

class RetryPolicy {
  constructor(
    private maxSeconds: number,
    private minJitterSeconds: number,
    private maxJitterSeconds: number
  ) {}

  nextRetryDelayInMilliseconds(
    retryContext: signalR.RetryContext
  ): number | null {
    let nextRetrySeconds = Math.pow(2, retryContext.previousRetryCount + 1);

    if (retryContext.elapsedMilliseconds / 1000 > this.maxSeconds) {
      location.reload();
    }

    nextRetrySeconds +=
      Math.floor(
        Math.random() * (this.maxJitterSeconds - this.minJitterSeconds + 1)
      ) + this.minJitterSeconds; // Add Jitter

    return nextRetrySeconds * 1000;
  }
}
