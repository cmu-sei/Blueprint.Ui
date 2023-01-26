// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { Injectable } from '@angular/core';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import * as signalR from '@microsoft/signalr';
import {
  Msel,
  Organization,
  Team,
  TeamUser,
  User,
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { MselDataService } from '../data/msel/msel-data.service';
import { OrganizationDataService } from '../data/organization/organization-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from 'src/app/data/user/team-user-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';

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
    private mselDataService: MselDataService,
    private organizationDataService: OrganizationDataService,
    private teamDataService: TeamDataService,
    private teamUserDataService: TeamUserDataService,
    private userDataService: UserDataService
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
      .withAutomaticReconnect(new RetryPolicy(60, 0, 5))
      .build();

    this.hubConnection.onreconnected(() => {
      this.join();
    });

    this.addHandlers();
    this.connectionPromise = this.hubConnection.start();
    this.connectionPromise.then((x) => this.join());

    return this.connectionPromise;
  }

  private reconnect() {
    if (this.hubConnection != null) {
      this.hubConnection.stop().then(() => {
        console.log('Reconnecting to the hub.');
        this.connectionPromise = this.hubConnection.start();
        this.connectionPromise.then(() => this.join());
      });
    }
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

  private addHandlers() {
    this.addMselHandlers();
    this.addOrganizationHandlers();
    this.addTeamHandlers();
    this.addTeamUserHandlers();
    this.addUserHandlers();
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

  private addTeamHandlers() {
    this.hubConnection.on('TeamUpdated', (team: Team) => {
      console.log('Team updated');
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
      console.log('UserMselRole updated');
      this.mselDataService.addUserRole(userMselRole);
    });

    this.hubConnection.on('UserMselRoleDeleted', (userMselRole: UserMselRole) => {
      this.mselDataService.deleteUserRole(userMselRole);
    });
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

    if (nextRetrySeconds > this.maxSeconds) {
      nextRetrySeconds = this.maxSeconds;
    }

    nextRetrySeconds +=
      Math.floor(
        Math.random() * (this.maxJitterSeconds - this.minJitterSeconds + 1)
      ) + this.minJitterSeconds; // Add Jitter

    return nextRetrySeconds * 1000;
  }
}
