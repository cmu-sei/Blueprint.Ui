/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
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
import { AdminContainerComponent } from './components/admin/admin-container/admin-container.component';
import { AdminUnitsComponent } from './components/admin/admin-units/admin-units.component';
import { AdminUnitEditDialogComponent } from './components/admin/admin-unit-edit-dialog/admin-unit-edit-dialog.component';
import { AdminUnitUsersComponent } from './components/admin/admin-unit-users/admin-unit-users.component';
import { AdminUsersComponent } from './components/admin/admin-users/admin-users.component';
import { CardEditDialogComponent } from './components/card-edit-dialog/card-edit-dialog.component';
import { CardListComponent } from './components/card-list/card-list.component';
import { CardTeamsComponent } from './components/card-teams/card-teams.component';
import { CiteActionEditDialogComponent } from './components/cite-action-edit-dialog/cite-action-edit-dialog.component';
import { CiteActionListComponent } from './components/cite-action-list/cite-action-list.component';
import { CiteRoleEditDialogComponent } from './components/cite-role-edit-dialog/cite-role-edit-dialog.component';
import { CiteRoleListComponent } from './components/cite-role-list/cite-role-list.component';
import { DataFieldEditDialogComponent } from './components/data-field-edit-dialog/data-field-edit-dialog.component';
import { DataFieldListComponent } from './components/data-field-list/data-field-list.component';
import { DataOptionEditDialogComponent } from './components/data-option-edit-dialog/data-option-edit-dialog.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { InvitationListComponent } from './components/invitation-list/invitation-list.component';
import { LaunchComponent } from './components/launch/launch.component';
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
import { UserAddDialogComponent } from './components/user-add-dialog/user-add-dialog.component';
import { UserDataService } from './data/user/user-data.service';
import { DialogService } from './services/dialog/dialog.service';
import { ErrorService } from './services/error/error.service';
import { SystemMessageService } from './services/system-message/system-message.service';
import { BASE_PATH } from './generated/blueprint.api';
import { ApiModule as SwaggerCodegenApiModule } from './generated/blueprint.api/api.module';
import { DisplayOrderPipe, SortByPipe } from 'src/app/utilities/sort-by-pipe';
import { QuillModule } from 'ngx-quill';
import { PlainTextPipe } from './utilities/plain-text-pipe';
import { NgxMatDatetimePickerModule, NgxMatTimepickerModule, NgxMatNativeDateModule } from '@angular-material-components/datetime-picker';
import { DurationEditComponent } from './components/shared/duration-edit/duration-edit.component';
import { DurationViewComponent } from './components/shared/duration-view/duration-view.component';

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
    CiteActionEditDialogComponent,
    CiteActionListComponent,
    CiteRoleEditDialogComponent,
    CiteRoleListComponent,
    DataFieldEditDialogComponent,
    DataFieldListComponent,
    DataOptionEditDialogComponent,
    HomeAppComponent,
    InvitationListComponent,
    LaunchComponent,
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
    UserAddDialogComponent,
    AdminContainerComponent,
    AdminUnitsComponent,
    AdminUnitEditDialogComponent,
    AdminUnitUsersComponent,
    AdminUsersComponent,
    TopbarComponent,
    DisplayOrderPipe,
    SortByPipe,
    PlainTextPipe,
    DurationEditComponent,
    DurationViewComponent
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
    QuillModule.forRoot({
      bounds: '.left',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
          ['blockquote', 'code-block'],

          [{ 'header': 1 }, { 'header': 2 }],               // custom button values
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
          [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
          [{ 'direction': 'rtl' }],                         // text direction

          [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

          [{ 'color': [
            '#b5b5b5',
            'rgb(163, 235, 163)',
            'rgb(250, 235, 100)',
            'rgb(250, 163, 2)',
            '#ff3333',
            '#ff3838',
            '#ebb3b3',
            '#e00',
            '#d00',
            '#c00',
            '#b00',
            '#a00',
            '#900',
            '#800',
            '#700',
            '#a60',
            '#067',
            '#247',
            '#085',
            '#2d69b4',
            '#336fba',
            '#2d69b4',
            '#242526',
            '#373739',
            '#306cb7',
            '#4e8ad5'
          ] },
          { 'background': [] }],      // dropdown with defaults from theme
          [{ 'font': [] }],
          [{ 'align': [] }],
          ['clean'],                  // remove formatting button
          ['link', 'image', 'video']  // link and image, video
        ],
        history: {
          delay: 2000,
          maxStack: 200
        }
      }
    }),
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
