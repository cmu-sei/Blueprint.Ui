// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  Msel,
  Organization
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-organization-list',
  templateUrl: './organization-list.component.html',
  styleUrls: ['./organization-list.component.scss'],
})
export class OrganizationListComponent implements OnDestroy {
  msel: Msel = {};
  organizationList: Organization[] = [];
  changedOrganization: Organization = {};
  filteredOrganizationList: Organization[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedOrganizations: Organization[] = [];
  isAddingOrganization = false;
  editingId = '';

  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private organizationDataService: OrganizationDataService,
    private organizationQuery: OrganizationQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to organizations
    this.organizationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(organizations => {
      this.organizationList = organizations;
      this.sortedOrganizations = this.getSortedOrganizations(this.getFilteredOrganizations(this.organizationList));
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        this.msel = {... msel};
        this.organizationDataService.loadByMsel(msel.id);
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedOrganizations = this.getSortedOrganizations(this.getFilteredOrganizations(this.organizationList));
      });
  }

  getSortedOrganizations(organizations: Organization[]) {
    if (organizations) {
      organizations.sort((a, b) => this.sortOrganizations(a, b, this.sort.active, this.sort.direction));
    }
    return organizations;
  }

  noExpansionChangeAllowed() {
    return this.isAddingOrganization || this.valuesHaveBeenChanged();
  }

  editOrganization(organization: Organization) {
    if (this.isAddingOrganization) {
      return;
    }
    // previous edit has not been saved, so prompt
    if (this.valuesHaveBeenChanged()) {
      this.dialogService
      .confirm(
        'Changes have been made!',
        'Do you want to save them?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.organizationDataService.updateOrganization(this.changedOrganization);
        }
        this.setEditing(organization);
      });
    // if adding a new organization, don't start editing another one
    } else {
      this.setEditing(organization);
    }
  }

  setEditing(organization) {
    if (organization.id === this.editingId) {
      this.editingId = '';
      this.changedOrganization = {};
    } else {
      this.editingId = organization.id;
      this.changedOrganization = {... organization};
    }
  }

  valuesHaveBeenChanged() {
    let isChanged = false;
    const original = this.organizationList.find(df => df.id === this.editingId);
    if (original) {
      isChanged = this.changedOrganization.name !== original.name ||
                  this.changedOrganization.description !== original.description;
    }
    return isChanged;
  }

  saveOrganization() {
    this.organizationDataService.updateOrganization(this.changedOrganization);
    this.editingId = '';
  }

  resetOrganization() {
    this.changedOrganization = {};
    this.editingId = '';
  }

  addOrganization() {
    this.changedOrganization = {
      id: uuidv4(),
      mselId: this.msel.id
    };
    this.isAddingOrganization = true;
  }

  saveNewOrganization() {
    this.isAddingOrganization = false;
    this.organizationDataService.add(this.changedOrganization);
  }

  cancelNewOrganization() {
    this.isAddingOrganization = false;
  }

  deleteOrganization(organization: Organization): void {
    if (this.isAddingOrganization || (this.editingId && this.editingId !== organization.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete Organization',
        'Are you sure that you want to delete ' + organization.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.organizationDataService.delete(organization.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedOrganizations = this.getSortedOrganizations(this.getFilteredOrganizations(this.organizationList));
  }

  private sortOrganizations(
    a: Organization,
    b: Organization,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        return ( (a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case "description":
        return ( (a.description < b.description ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getFilteredOrganizations(organizations: Organization[]): Organization[] {
    let filteredOrganizations: Organization[] = [];
    if (organizations) {
      organizations.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredOrganizations.push({... se});
        }
      });
      if (filteredOrganizations && filteredOrganizations.length > 0 && this.filterString) {
        var filterString = this.filterString.toLowerCase();
        filteredOrganizations = filteredOrganizations
          .filter((a) =>
            a.description.toLowerCase().includes(filterString) ||
            a.name.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredOrganizations;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
