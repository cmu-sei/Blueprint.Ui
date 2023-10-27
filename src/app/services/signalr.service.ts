/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable } from '@angular/core';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import * as signalR from '@microsoft/signalr';
import {
  DataField,
  DataOption,
  DataValue,
  Move,
  Msel,
  MselTeam,
  Organization,
  ScenarioEvent,
  Team,
  TeamUser,
  User,
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { DataFieldDataService } from '../data/data-field/data-field-data.service';
import { DataOptionDataService } from '../data/data-option/data-option-data.service';
import { DataValueDataService } from '../data/data-value/data-value-data.service';
import { MoveDataService } from '../data/move/move-data.service';
import { MselDataService } from '../data/msel/msel-data.service';
import { MselTeamDataService } from '../data/msel-team/msel-team-data.service';
import { OrganizationDataService } from '../data/organization/organization-data.service';
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

  constructor(
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private dataFieldDataService: DataFieldDataService,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselTeamDataService: MselTeamDataService,
    private organizationDataService: OrganizationDataService,
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
      .withAutomaticReconnect(new RetryPolicy(120, 0, 5))
      .build();

    this.hubConnection.onreconnected(() => {
      this.join();
    });

    this.addHandlers();
    this.connectionPromise = this.hubConnection.start();
    this.connectionPromise.then((x) => this.join());

    return this.connectionPromise;
  }

  public join() {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('Join' + this.applicationArea);
    }
    this.isJoined = true;
  }

  public leave() {
    if (this.isJoined) {
      this.hubConnection.invoke('Leave' + this.applicationArea);
    }
    this.isJoined = false;
  }

  public selectMsel(mselId: string) {
    if (this.isJoined && this.applicationArea !== ApplicationArea.admin) {
      this.hubConnection.invoke('selectMsel', [mselId]);
    }
  }

  private addHandlers() {
    this.addDataFieldHandlers();
    this.addDataOptionHandlers();
    this.addDataValueHandlers();
    this.addMoveHandlers();
    this.addMselHandlers();
    this.addMselTeamHandlers();
    this.addOrganizationHandlers();
    this.addScenarioEventHandlers();
    this.addTeamHandlers();
    this.addTeamUserHandlers();
    this.addUserHandlers();
    this.addUserMselRoleHandlers();
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

  private addMselTeamHandlers() {
    this.hubConnection.on(
      'MselTeamUpdated', (mselTeam: MselTeam) => {
        this.mselTeamDataService.updateStore(mselTeam);
      }
    );

    this.hubConnection.on('MselTeamCreated', (mselTeam: MselTeam) => {
      this.mselTeamDataService.updateStore(mselTeam);
    });

    this.hubConnection.on('MselTeamDeleted', (id: string) => {
      this.mselTeamDataService.deleteFromStore(id);
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

  private reconnect() {
    if (this.hubConnection != null) {
      this.hubConnection.stop().then(() => {
        this.connectionPromise = this.hubConnection.start();
        this.connectionPromise.then(() => this.join());
      });
    }
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
