import { NgModule, ModuleWithProviders, SkipSelf, Optional } from '@angular/core';
import { Configuration } from './configuration';
import { HttpClient } from '@angular/common/http';

import { CardService } from './api/card.service';
import { CardTeamService } from './api/cardTeam.service';
import { CatalogService } from './api/catalog.service';
import { CatalogInjectService } from './api/catalogInject.service';
import { CatalogUnitService } from './api/catalogUnit.service';
import { CiteService } from './api/cite.service';
import { CiteActionService } from './api/citeAction.service';
import { CiteRoleService } from './api/citeRole.service';
import { DataFieldService } from './api/dataField.service';
import { DataOptionService } from './api/dataOption.service';
import { DataValueService } from './api/dataValue.service';
import { HealthCheckService } from './api/healthCheck.service';
import { InjectService } from './api/inject.service';
import { InjectTypeService } from './api/injectType.service';
import { InvitationService } from './api/invitation.service';
import { MoveService } from './api/move.service';
import { MselService } from './api/msel.service';
import { MselPageService } from './api/mselPage.service';
import { MselUnitService } from './api/mselUnit.service';
import { OrganizationService } from './api/organization.service';
import { PermissionService } from './api/permission.service';
import { PlayerService } from './api/player.service';
import { PlayerApplicationService } from './api/playerApplication.service';
import { PlayerApplicationTeamService } from './api/playerApplicationTeam.service';
import { ScenarioEventService } from './api/scenarioEvent.service';
import { TeamService } from './api/team.service';
import { TeamUserService } from './api/teamUser.service';
import { UnitService } from './api/unit.service';
import { UnitUserService } from './api/unitUser.service';
import { UserService } from './api/user.service';
import { UserMselRoleService } from './api/userMselRole.service';
import { UserPermissionService } from './api/userPermission.service';
import { UserTeamRoleService } from './api/userTeamRole.service';

@NgModule({
  imports:      [],
  declarations: [],
  exports:      [],
  providers: []
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
