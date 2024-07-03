/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressBarModule as MatProgressBarModule } from '@angular/material/legacy-progress-bar';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatLegacySliderModule as MatSliderModule } from '@angular/material/legacy-slider';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatTreeModule } from '@angular/material/tree';
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
import { CardEditDialogComponent } from './components/card-edit-dialog/card-edit-dialog.component';
import { CardListComponent } from './components/card-list/card-list.component';
import { CardTeamsComponent } from './components/card-teams/card-teams.component';
import { CatalogUnitsComponent } from './components/catalog-units/catalog-units.component';
import { CiteActionEditDialogComponent } from './components/cite-action-edit-dialog/cite-action-edit-dialog.component';
import { CiteActionListComponent } from './components/cite-action-list/cite-action-list.component';
import { CiteRoleEditDialogComponent } from './components/cite-role-edit-dialog/cite-role-edit-dialog.component';
import { CiteRoleListComponent } from './components/cite-role-list/cite-role-list.component';
import { DashboardComponent } from './components/landing/dashboard/dashboard.component';
import { DataFieldEditDialogComponent } from './components/data-field-edit-dialog/data-field-edit-dialog.component';
import { DataFieldListComponent } from './components/data-field-list/data-field-list.component';
import { DataOptionEditDialogComponent } from './components/data-option-edit-dialog/data-option-edit-dialog.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { InjectEditDialogComponent } from './components/inject-edit-dialog/inject-edit-dialog.component';
import { InjectListComponent } from './components/inject-list/inject-list.component';
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
import { ScenarioEventEditDialogComponent } from './components/scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventListComponent } from './components/scenario-event-list/scenario-event-list.component';
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
import { NgxMatDatetimePickerModule, NgxMatTimepickerModule, NgxMatNativeDateModule } from '@angular-material-components/datetime-picker';
import { DurationEditComponent } from './components/shared/duration-edit/duration-edit.component';
import { DurationViewComponent } from './components/shared/duration-view/duration-view.component';
import { EventDetailPageComponent } from './components/event-detail-page/event-detail-page.component';
import { MselPlaybookComponent } from './components/msel-playbook/msel-playbook.component';

const settings: ComnSettingsConfig = {
  url: 'assets/config/settings.json',
  envUrl: 'assets/config/settings.env.json',
};

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}

@NgModule({
  declarations: [
    AppComponent,
    CardEditDialogComponent,
    CardListComponent,
    CardTeamsComponent,
    CatalogUnitsComponent,
    CiteActionEditDialogComponent,
    CiteActionListComponent,
    CiteRoleEditDialogComponent,
    CiteRoleListComponent,
    DashboardComponent,
    DataFieldEditDialogComponent,
    DataFieldListComponent,
    DataOptionEditDialogComponent,
    HomeAppComponent,
    InjectEditDialogComponent,
    InjectListComponent,
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
    ScenarioEventEditDialogComponent,
    ScenarioEventListComponent,
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
    TopbarComponent,
    DisplayOrderPipe,
    SortByPipe,
    PlainTextPipe,
    DurationEditComponent,
    DurationViewComponent,
    EventDetailPageComponent,
    MselPlaybookComponent
  ],
  imports: [
    AkitaNgDevtools,
    AkitaNgRouterStoreModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SwaggerCodegenApiModule,
    HttpClientModule,
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
    NgxMatTimepickerModule,
    NgxMatDatetimePickerModule,
    NgxMatNativeDateModule,
    CdkTableModule,
    MatTreeModule,
    CdkTreeModule,
    ClipboardModule,
    ComnAuthModule.forRoot(),
    ComnSettingsModule.forRoot(),
    AngularEditorModule,
    DragDropModule
  ],
  exports: [MatSortModule],
  providers: [
    DialogService,
    SystemMessageService,
    UIDataService,
    UserDataService,
    {
      provide: BASE_PATH,
      useFactory: getBasePath,
      deps: [ComnSettingsService],
    },
    {
      provide: ErrorHandler,
      useClass: ErrorService,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
