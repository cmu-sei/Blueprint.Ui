/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, ErrorHandler, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { provideNativeDateAdapter } from '@angular/material/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  ComnAuthModule,
  ComnSettingsConfig,
  ComnSettingsModule,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { ClipboardModule } from 'ngx-clipboard';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AdminCatalogEditDialogComponent } from './components/admin/admin-catalog-edit-dialog/admin-catalog-edit-dialog.component';
import { AdminCatalogListComponent } from './components/admin/admin-catalog-list/admin-catalog-list.component';
import { AdminContainerComponent } from './components/admin/admin-container/admin-container.component';
import { AdminInjectTypesComponent } from './components/admin/admin-inject-types/admin-inject-types.component';
import { AdminInjectTypeEditDialogComponent } from './components/admin/admin-inject-type-edit-dialog/admin-inject-type-edit-dialog.component';
import { AdminUnitsComponent } from './components/admin/admin-units/admin-units.component';
import { AdminUnitEditDialogComponent } from './components/admin/admin-unit-edit-dialog/admin-unit-edit-dialog.component';
import { AdminUnitUsersComponent } from './components/admin/admin-unit-users/admin-unit-users.component';
import { AdminUsersComponent } from './components/admin/admin-users/admin-users.component';
import { AdminUserListComponent } from './components/admin/admin-users/admin-user-list/admin-user-list.component';
import { AdminRolesComponent } from './components/admin/admin-roles/admin-roles.component';
import { AdminGroupsComponent } from './components/admin/admin-groups/admin-groups.component';
import { CardEditDialogComponent } from './components/card-edit-dialog/card-edit-dialog.component';
import { CardListComponent } from './components/card-list/card-list.component';
import { CardTeamsComponent } from './components/card-teams/card-teams.component';
import { CatalogUnitsComponent } from './components/catalog-units/catalog-units.component';
import { CiteActionEditDialogComponent } from './components/cite-action-edit-dialog/cite-action-edit-dialog.component';
import { CiteActionListComponent } from './components/cite-action-list/cite-action-list.component';
import { CiteDutyEditDialogComponent } from './components/cite-duty-edit-dialog/cite-duty-edit-dialog.component';
import { CiteDutyListComponent } from './components/cite-duty-list/cite-duty-list.component';
import { DashboardComponent } from './components/landing/dashboard/dashboard.component';
import { DataFieldEditDialogComponent } from './components/data-field-edit-dialog/data-field-edit-dialog.component';
import { DataFieldListComponent } from './components/data-field-list/data-field-list.component';
import { DataOptionEditDialogComponent } from './components/data-option-edit-dialog/data-option-edit-dialog.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { InjectEditDialogComponent } from './components/inject-edit-dialog/inject-edit-dialog.component';
import { InjectListComponent } from './components/inject-list/inject-list.component';
import { InjectSelectDialogComponent } from './components/inject-select-dialog/inject-select-dialog.component';
import { InvitationEditDialogComponent } from './components/invitation-edit-dialog/invitation-edit-dialog.component';
import { InvitationListComponent } from './components/invitation-list/invitation-list.component';
import { JoinComponent } from './components/landing/join/join.component';
import { LaunchComponent } from './components/landing/launch/launch.component';
import { ManageComponent } from './components/landing/manage/manage.component';
import { MoveEditDialogComponent } from './components/move-edit-dialog/move-edit-dialog.component';
import { MoveListComponent } from './components/move-list/move-list.component';
import { MselComponent } from './components/msel/msel.component';
import { MselContributorsComponent } from './components/msel-contributors/msel-contributors.component';
import { MselInfoComponent } from './components/msel-info/msel-info.component';
import { MselListComponent } from './components/msel-list/msel-list.component';
import { MselPageComponent } from './components/msel-page/msel-page.component';
import { MselTeamsComponent } from './components/msel-teams/msel-teams.component';
import { MselViewComponent } from './components/msel-view/msel-view.component';
import { OrganizationEditDialogComponent } from './components/organization-edit-dialog/organization-edit-dialog.component';
import { OrganizationListComponent } from './components/organization-list/organization-list.component';
import { PlayerApplicationEditDialogComponent } from './components/player-application-edit-dialog/player-application-edit-dialog.component';
import { PlayerApplicationListComponent } from './components/player-application-list/player-application-list.component';
import { PlayerApplicationTeamsComponent } from './components/player-application-teams/player-application-teams.component';
import { PlayerTeamAppOrderComponent } from './components/player-team-app-order/player-team-app-order.component';
import { ScenarioEventCopyDialogComponent } from './components/scenario-event-copy-dialog/scenario-event-copy-dialog.component';
import { ScenarioEventEditDialogComponent } from './components/scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventListComponent } from './components/scenario-event-list/scenario-event-list.component';
import { StarterComponent } from './components/starter/starter.component';
import { SteamfitterTaskComponent } from './components/steamfitter-task/steamfitter-task.component';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog/confirm-dialog.component';
import { SystemMessageComponent } from './components/shared/system-message/system-message.component';
import { TeamAddDialogComponent } from './components/team-add-dialog/team-add-dialog.component';
import { TeamEditDialogComponent } from './components/team-edit-dialog/team-edit-dialog.component';
import { TeamUsersComponent } from './components/team-users/team-users.component';
import { TopbarComponent } from './components/shared/top-bar/topbar.component';
import { UIDataService } from './data/ui/ui-data.service';
import { UserDataService } from './data/user/user-data.service';
import { DialogService } from './services/dialog/dialog.service';
import { ErrorService } from './services/error/error.service';
import { SystemMessageService } from './services/system-message/system-message.service';
import { BASE_PATH } from './generated/blueprint.api';
import { ApiModule as SwaggerCodegenApiModule } from './generated/blueprint.api/api.module';
import { DisplayOrderPipe, SortByPipe } from 'src/app/utilities/sort-by-pipe';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { PlainTextPipe } from './utilities/plain-text-pipe';
import { DynamicThemeService } from './services/dynamic-theme.service';
import { FaviconService } from './services/favicon.service';
import { initializeTheme } from './services/theme-initializer.factory';
import {
  NgxMatDatepickerActions,
  NgxMatDatepickerApply,
  NgxMatDatepickerCancel,
  NgxMatDatepickerClear,
  NgxMatDatepickerInput,
  NgxMatDatepickerToggle,
  NgxMatDatetimepicker,
} from '@ngxmc/datetime-picker';
import { DurationEditComponent } from './components/shared/duration-edit/duration-edit.component';
import { DurationViewComponent } from './components/shared/duration-view/duration-view.component';
import { EventDetailPageComponent } from './components/event-detail-page/event-detail-page.component';
import { MselPlaybookComponent } from './components/msel-playbook/msel-playbook.component';
import { DataValueComponent } from './components/data-value/data-value.component';

const settings: ComnSettingsConfig = {
  url: 'assets/config/settings.json',
  envUrl: 'assets/config/settings.env.json',
};

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideNativeDateAdapter(),
  ],
};

@NgModule({
  declarations: [
    AppComponent,
    CardEditDialogComponent,
    CardListComponent,
    CardTeamsComponent,
    CatalogUnitsComponent,
    CiteActionEditDialogComponent,
    CiteActionListComponent,
    CiteDutyEditDialogComponent,
    CiteDutyListComponent,
    DashboardComponent,
    DataFieldEditDialogComponent,
    DataFieldListComponent,
    DataOptionEditDialogComponent,
    HomeAppComponent,
    InjectEditDialogComponent,
    InjectListComponent,
    InjectSelectDialogComponent,
    InvitationEditDialogComponent,
    InvitationListComponent,
    JoinComponent,
    LaunchComponent,
    ManageComponent,
    MoveEditDialogComponent,
    MoveListComponent,
    MselComponent,
    MselContributorsComponent,
    MselInfoComponent,
    MselListComponent,
    MselPageComponent,
    MselTeamsComponent,
    MselViewComponent,
    OrganizationEditDialogComponent,
    OrganizationListComponent,
    PlayerApplicationEditDialogComponent,
    PlayerApplicationListComponent,
    PlayerApplicationTeamsComponent,
    PlayerTeamAppOrderComponent,
    ScenarioEventCopyDialogComponent,
    ScenarioEventEditDialogComponent,
    ScenarioEventListComponent,
    StarterComponent,
    SteamfitterTaskComponent,
    SystemMessageComponent,
    ConfirmDialogComponent,
    TeamAddDialogComponent,
    TeamEditDialogComponent,
    TeamUsersComponent,
    AdminCatalogEditDialogComponent,
    AdminCatalogListComponent,
    AdminContainerComponent,
    AdminInjectTypesComponent,
    AdminInjectTypeEditDialogComponent,
    AdminUnitsComponent,
    AdminUnitEditDialogComponent,
    AdminUnitUsersComponent,
    AdminUsersComponent,
    AdminUserListComponent,
    AdminRolesComponent,
    AdminGroupsComponent,
    TopbarComponent,
    DisplayOrderPipe,
    SortByPipe,
    PlainTextPipe,
    DurationEditComponent,
    DurationViewComponent,
    EventDetailPageComponent,
    MselPlaybookComponent,
    DataValueComponent,
  ],
  exports: [MatSortModule],
  bootstrap: [AppComponent], imports: [AkitaNgDevtools,
    AkitaNgRouterStoreModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SwaggerCodegenApiModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatRippleModule,
    MatSelectModule,
    MatSidenavModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    MatStepperModule,
    MatBottomSheetModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatDatepickerModule,
    NgxMatDatepickerActions,
    NgxMatDatepickerApply,
    NgxMatDatepickerCancel,
    NgxMatDatepickerClear,
    NgxMatDatepickerInput,
    NgxMatDatepickerToggle,
    NgxMatDatetimepicker,
    CdkTableModule,
    MatTreeModule,
    CdkTreeModule,
    ClipboardModule,
    ComnAuthModule.forRoot(),
    ComnSettingsModule.forRoot(),
    AngularEditorModule,
    DragDropModule], providers: [
      DialogService,
      SystemMessageService,
      UIDataService,
      UserDataService,
      DynamicThemeService,
      FaviconService,
      {
        provide: BASE_PATH,
        useFactory: getBasePath,
        deps: [ComnSettingsService],
      },
      {
        provide: ErrorHandler,
        useClass: ErrorService,
      },
      {
        provide: APP_INITIALIZER,
        useFactory: initializeTheme,
        deps: [ComnSettingsService, DynamicThemeService],
        multi: true,
      },
      provideHttpClient(withInterceptorsFromDi()),
    ]
})
export class AppModule { }
