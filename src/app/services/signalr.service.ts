/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable } from '@angular/core';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import * as signalR from '@microsoft/signalr';
import {
  Card,
  CardTeam,
  CiteAction,
  CiteRole,
  DataField,
  DataOption,
  DataValue,
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
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { CardDataService } from '../data/card/card-data.service';
import { CardTeamDataService } from '../data/team/card-team-data.service';
import { CiteActionDataService } from '../data/cite-action/cite-action-data.service';
import { CiteRoleDataService } from '../data/cite-role/cite-role-data.service';
import { DataFieldDataService } from '../data/data-field/data-field-data.service';
import { DataOptionDataService } from '../data/data-option/data-option-data.service';
import { DataValueDataService } from '../data/data-value/data-value-data.service';
import { MoveDataService } from '../data/move/move-data.service';
import { MselDataService } from '../data/msel/msel-data.service';
import { MselUnitDataService } from '../data/msel-unit/msel-unit-data.service';
import { OrganizationDataService } from '../data/organization/organization-data.service';
import { PlayerApplicationDataService } from '../data/player-application/player-application-data.service';
import { PlayerApplicationTeamDataService } from '../data/team/player-application-team-data.service';
import { ScenarioEventDataService } from '../data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from 'src/app/data/user/team-user-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserMselRoleDataService } from '../data/user-msel-role/user-msel-role-data.service';

export enum ApplicationArea {
  home = '',
  admin = 'Admin'
}
@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection: signalR.HubConnection;
  private applicationArea: ApplicationArea;
  private connectionPromise: Promise<void>;
  private isJoined = false;
  private retryArray = [0, 10, 10, 10, 10,
    100, 100, 100, 100,
    1000, 1000, 1000, 1000,
    10000, 10000, 10000, 10000,
    30000, 30000, 30000, null];

  constructor(
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private cardDataService: CardDataService,
    private cardTeamDataService: CardTeamDataService,
    private citeActionDataService: CiteActionDataService,
    private citeRoleDataService: CiteRoleDataService,
    private dataFieldDataService: DataFieldDataService,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
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
    this.authService.user$.subscribe(() => {
      this.reconnect();
    });
  }

  public startConnection(applicationArea: ApplicationArea): Promise<void> {
    if (this.connectionPromise && this.applicationArea === applicationArea) {
      return this.connectionPromise;
    }

    this.applicationArea = applicationArea;
    const accessToken = this.authService.getAuthorizationToken();
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${this.settingsService.settings.ApiUrl}/hubs/main?bearer=${accessToken}`
      )
      .withAutomaticReconnect(this.retryArray)
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection.onreconnected(() => {
      this.join();
    });

    this.hubConnection.onclose(() => location.reload());

    this.addHandlers();
    this.connectionPromise = this.hubConnection.start();
    this.connectionPromise.then((x) => this.join());

    return this.connectionPromise;
  }

  public join() {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('Join' + this.applicationArea);
      this.isJoined = true;
    } else {
      this.isJoined = false;
      this.reconnect();
    }
  }

  public leave() {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected && this.isJoined) {
      this.hubConnection.invoke('Leave' + this.applicationArea);
    }
    this.isJoined = false;
  }

  public selectMsel(mselId: string) {
    if (this.hubConnection.state !== signalR.HubConnectionState.Disconnected &&
      this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      setTimeout(() => {
        this.selectMsel(mselId);
      }, 100);
    } else if (!this.hubConnection || this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
      this.connectionPromise = this.hubConnection.start();
      this.connectionPromise.then((x) => {
        this.join();
        setTimeout(() => {
          this.selectMsel(mselId);
        }, 100);
      });
    } else if (this.isJoined) {
      if (this.applicationArea !== ApplicationArea.admin) {
        this.hubConnection.invoke('selectMsel', [mselId]);
      }
    } else {
      this.join();
      setTimeout(() => {
        this.selectMsel(mselId);
      }, 100);
    }
  }

  private reconnect() {
    if (this.hubConnection != null) {
      this.hubConnection.stop().then(() => {
        this.connectionPromise = this.hubConnection.start();
        this.connectionPromise.then(() => this.join());
      });
    }
  }

  private addHandlers() {
    this.addCardHandlers();
    this.addCardTeamHandlers();
    this.addCiteActionHandlers();
    this.addCiteRoleHandlers();
    this.addDataFieldHandlers();
    this.addDataOptionHandlers();
    this.addDataValueHandlers();
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
    this.hubConnection.on(
      'CardUpdated', (card: Card) => {
        this.cardDataService.updateStore(card);
      }
    );

    this.hubConnection.on('CardCreated', (card: Card) => {
      this.cardDataService.updateStore(card);
    });

    this.hubConnection.on('CardDeleted', (id: string) => {
      this.cardDataService.deleteFromStore(id);
    });
  }

  private addCardTeamHandlers() {
    this.hubConnection.on(
      'CardTeamUpdated', (cardTeam: CardTeam) => {
        this.cardTeamDataService.updateStore(cardTeam);
      }
    );

    this.hubConnection.on('CardTeamCreated', (cardTeam: CardTeam) => {
      this.cardTeamDataService.updateStore(cardTeam);
    });

    this.hubConnection.on('CardTeamDeleted', (id: string) => {
      this.cardTeamDataService.deleteFromStore(id);
    });
  }

  private addCiteActionHandlers() {
    this.hubConnection.on(
      'CiteActionUpdated', (citeAction: CiteAction) => {
        this.citeActionDataService.updateStore(citeAction);
      }
    );

    this.hubConnection.on('CiteActionCreated', (citeAction: CiteAction) => {
      this.citeActionDataService.updateStore(citeAction);
    });

    this.hubConnection.on('CiteActionDeleted', (id: string) => {
      this.citeActionDataService.deleteFromStore(id);
    });
  }

  private addCiteRoleHandlers() {
    this.hubConnection.on(
      'CiteRoleUpdated', (citeRole: CiteRole) => {
        this.citeRoleDataService.updateStore(citeRole);
      }
    );

    this.hubConnection.on('CiteRoleCreated', (citeRole: CiteRole) => {
      this.citeRoleDataService.updateStore(citeRole);
    });

    this.hubConnection.on('CiteRoleDeleted', (id: string) => {
      this.citeRoleDataService.deleteFromStore(id);
    });
  }

  private addDataFieldHandlers() {
    this.hubConnection.on(
      'DataFieldUpdated', (dataField: DataField) => {
        this.dataFieldDataService.updateStore(dataField);
      }
    );

    this.hubConnection.on('DataFieldCreated', (dataField: DataField) => {
      this.dataFieldDataService.updateStore(dataField);
    });

    this.hubConnection.on('DataFieldDeleted', (id: string) => {
      this.dataFieldDataService.deleteFromStore(id);
    });
  }

  private addDataOptionHandlers() {
    this.hubConnection.on(
      'DataOptionUpdated', (dataOption: DataOption) => {
        this.dataOptionDataService.updateStore(dataOption);
      }
    );

    this.hubConnection.on('DataOptionCreated', (dataOption: DataOption) => {
      this.dataOptionDataService.updateStore(dataOption);
    });

    this.hubConnection.on('DataOptionDeleted', (id: string) => {
      this.dataOptionDataService.deleteFromStore(id);
    });
  }

  private addDataValueHandlers() {
    this.hubConnection.on(
      'DataValueUpdated', (dataValue: DataValue) => {
        this.dataValueDataService.updateStore(dataValue);
      }
    );

    this.hubConnection.on('DataValueCreated', (dataValue: DataValue) => {
      this.dataValueDataService.updateStore(dataValue);
    });

    this.hubConnection.on('DataValueDeleted', (id: string) => {
      this.dataValueDataService.deleteFromStore(id);
    });
  }

  private addMoveHandlers() {
    this.hubConnection.on(
      'MoveUpdated', (move: Move) => {
        this.moveDataService.updateStore(move);
      }
    );

    this.hubConnection.on('MoveCreated', (move: Move) => {
      this.moveDataService.updateStore(move);
    });

    this.hubConnection.on('MoveDeleted', (id: string) => {
      this.moveDataService.deleteFromStore(id);
    });
  }

  private addMselHandlers() {
    this.hubConnection.on(
      'MselUpdated', (msel: Msel) => {
        this.mselDataService.updateStore(msel);
      }
    );

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
    this.hubConnection.on(
      'MselUnitUpdated', (mselUnit: MselUnit) => {
        this.mselUnitDataService.updateStore(mselUnit);
      }
    );

    this.hubConnection.on('MselUnitCreated', (mselUnit: MselUnit) => {
      this.mselUnitDataService.updateStore(mselUnit);
    });

    this.hubConnection.on('MselUnitDeleted', (id: string) => {
      this.mselUnitDataService.deleteFromStore(id);
    });
  }

  private addOrganizationHandlers() {
    this.hubConnection.on(
      'OrganizationUpdated', (organization: Organization) => {
        this.organizationDataService.updateStore(organization);
      }
    );

    this.hubConnection.on('OrganizationCreated', (organization: Organization) => {
      this.organizationDataService.updateStore(organization);
    });

    this.hubConnection.on('OrganizationDeleted', (id: string) => {
      this.organizationDataService.deleteFromStore(id);
    });
  }

  private addPlayerApplicationHandlers() {
    this.hubConnection.on(
      'PlayerApplicationUpdated', (playerApplication: PlayerApplication) => {
        this.playerApplicationDataService.updateStore(playerApplication);
      }
    );

    this.hubConnection.on('PlayerApplicationCreated', (playerApplication: PlayerApplication) => {
      this.playerApplicationDataService.updateStore(playerApplication);
    });

    this.hubConnection.on('PlayerApplicationDeleted', (id: string) => {
      this.playerApplicationDataService.deleteFromStore(id);
    });
  }

  private addPlayerApplicationTeamHandlers() {
    this.hubConnection.on(
      'PlayerApplicationTeamUpdated', (playerApplicationTeam: PlayerApplicationTeam) => {
        this.playerApplicationTeamDataService.updateStore(playerApplicationTeam);
      }
    );

    this.hubConnection.on('PlayerApplicationTeamCreated', (playerApplicationTeam: PlayerApplicationTeam) => {
      this.playerApplicationTeamDataService.updateStore(playerApplicationTeam);
    });

    this.hubConnection.on('PlayerApplicationTeamDeleted', (id: string) => {
      this.playerApplicationTeamDataService.deleteFromStore(id);
    });
  }

  private addScenarioEventHandlers() {
    this.hubConnection.on('ScenarioEventUpdated', (scenarioEvent: ScenarioEvent) => {
      this.scenarioEventDataService.updateStore(scenarioEvent);
    }
    );

    this.hubConnection.on('ScenarioEventCreated', (scenarioEvent: ScenarioEvent) => {
      this.scenarioEventDataService.updateStore(scenarioEvent);
    });

    this.hubConnection.on('ScenarioEventDeleted', (id: string) => {
      this.scenarioEventDataService.deleteFromStore(id);
    });
  }

  private addTeamHandlers() {
    this.hubConnection.on('TeamUpdated', (team: Team) => {
      this.teamDataService.updateStore(team);
    }
    );

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
    }
    );

    this.hubConnection.on('TeamUserCreated', (teamUser: TeamUser) => {
      this.teamUserDataService.updateStore(teamUser);
    });

    this.hubConnection.on('TeamUserDeleted', (teamUser: TeamUser) => {
      this.teamUserDataService.deleteFromStore(teamUser);
    });
  }

  private addUserHandlers() {
    this.hubConnection.on('UserUpdated', (user: User) => {
      this.userDataService.updateStore(user);
    }
    );

    this.hubConnection.on('UserCreated', (user: User) => {
      this.userDataService.updateStore(user);
    });

    this.hubConnection.on('UserDeleted', (id: string) => {
      this.userDataService.deleteFromStore(id);
    });
  }

  private addUserMselRoleHandlers() {
    this.hubConnection.on('UserMselRoleCreated', (userMselRole: UserMselRole) => {
      this.userMselRoleDataService.updateStore(userMselRole);
    });

    this.hubConnection.on('UserMselRoleDeleted', (id: string) => {
      this.userMselRoleDataService.deleteFromStore(id);
    });
  }
}
