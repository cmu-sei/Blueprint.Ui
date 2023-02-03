/*
Copyright 2022 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
*/

import { NgModule, ModuleWithProviders, SkipSelf, Optional } from '@angular/core';
import { Configuration } from './configuration';
import { HttpClient } from '@angular/common/http';


import { CardService } from './api/card.service';
import { CiteActionService } from './api/citeAction.service';
import { CiteRoleService } from './api/citeRole.service';
import { DataFieldService } from './api/dataField.service';
import { DataOptionService } from './api/dataOption.service';
import { DataValueService } from './api/dataValue.service';
import { HealthCheckService } from './api/healthCheck.service';
import { MoveService } from './api/move.service';
import { MselService } from './api/msel.service';
import { OrganizationService } from './api/organization.service';
import { PermissionService } from './api/permission.service';
import { ScenarioEventService } from './api/scenarioEvent.service';
import { TeamService } from './api/team.service';
import { TeamUserService } from './api/teamUser.service';
import { UserService } from './api/user.service';
import { UserMselRoleService } from './api/userMselRole.service';
import { UserPermissionService } from './api/userPermission.service';

@NgModule({
  imports:      [],
  declarations: [],
  exports:      [],
  providers: [
    CardService,
    CiteActionService,
    CiteRoleService,
    DataFieldService,
    DataOptionService,
    DataValueService,
    HealthCheckService,
    MoveService,
    MselService,
    OrganizationService,
    PermissionService,
    ScenarioEventService,
    TeamService,
    TeamUserService,
    UserService,
    UserMselRoleService,
    UserPermissionService ]
})
export class ApiModule {
    public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders<ApiModule> {
        return {
            ngModule: ApiModule,
            providers: [ { provide: Configuration, useFactory: configurationFactory } ]
        };
    }

    constructor( @Optional() @SkipSelf() parentModule: ApiModule,
                 @Optional() http: HttpClient) {
        if (parentModule) {
            throw new Error('ApiModule is already loaded. Import in your base AppModule only.');
        }
        if (!http) {
            throw new Error('You need to import the HttpClientModule in your AppModule! \n' +
            'See also https://github.com/angular/angular/issues/20575');
        }
    }
}
