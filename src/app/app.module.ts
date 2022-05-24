// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
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
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AdminContainerComponent } from './components/admin/admin-container/admin-container.component';
import { AdminMovesComponent } from './components/admin/admin-moves/admin-moves.component';
import { AdminTeamsComponent } from './components/admin/admin-teams/admin-teams.component';
import { AdminTeamEditDialogComponent } from './components/admin/admin-team-edit-dialog/admin-team-edit-dialog.component';
import { AdminTeamUsersComponent } from './components/admin/admin-team-users/admin-team-users.component';
import { AdminUsersComponent } from './components/admin/admin-users/admin-users.component';
import { DataFieldListComponent } from './components/data-field-list/data-field-list.component';
import { DataOptionEditDialogComponent } from './components/data-option-edit-dialog/data-option-edit-dialog.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { MselComponent } from './components/msel/msel.component';
import { MselInfoComponent } from './components/msel-info/msel-info.component';
import { MselListComponent } from './components/msel-list/msel-list.component';
import { MselViewComponent } from './components/msel-view/msel-view.component';
import { ScenarioEventListComponent } from './components/scenario-event-list/scenario-event-list.component';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog/confirm-dialog.component';
import { SystemMessageComponent } from './components/shared/system-message/system-message.component';
import { TopbarComponent } from './components/shared/top-bar/topbar.component';
import { UserDataService } from './data/user/user-data.service';
import { DialogService } from './services/dialog/dialog.service';
import { ErrorService } from './services/error/error.service';
import { SystemMessageService } from './services/system-message/system-message.service';
import { BASE_PATH } from './generated/blueprint.api';
import { ApiModule as SwaggerCodegenApiModule } from './generated/blueprint.api/api.module';
import { DisplayOrderPipe, SortByPipe } from 'src/app/utilities/sort-by-pipe';

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
    DataFieldListComponent,
    DataOptionEditDialogComponent,
    HomeAppComponent,
    MselComponent,
    MselInfoComponent,
    MselListComponent,
    MselViewComponent,
    ScenarioEventListComponent,
    SystemMessageComponent,
    ConfirmDialogComponent,
    AdminContainerComponent,
    AdminMovesComponent,
    AdminTeamsComponent,
    AdminTeamEditDialogComponent,
    AdminTeamUsersComponent,
    AdminUsersComponent,
    TopbarComponent,
    DisplayOrderPipe,
    SortByPipe
  ],
  imports: [
    AkitaNgDevtools,
    AkitaNgRouterStoreModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SwaggerCodegenApiModule,
    HttpClientModule,
    FlexLayoutModule,
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
    CdkTableModule,
    MatTreeModule,
    CdkTreeModule,
    NgxMaterialTimepickerModule,
    ClipboardModule,
    ComnAuthModule.forRoot(),
    ComnSettingsModule.forRoot(),
  ],
  exports: [MatSortModule],
  providers: [
    DialogService,
    SystemMessageService,
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
