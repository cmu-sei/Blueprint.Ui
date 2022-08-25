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
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { OrganizationEditDialogComponent } from '../organization-edit-dialog/organization-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-organization-list',
  templateUrl: './organization-list.component.html',
  styleUrls: ['./organization-list.component.scss'],
})
export class OrganizationListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  organizationList: Organization[] = [];
  changedOrganization: Organization = {};
  filteredOrganizationList: Organization[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedOrganizations: Organization[] = [];
  templateOrganizations: Organization[] = [];
  showTemplates = false;
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
      this.sortChanged(this.sort);
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.msel, msel);
        this.organizationDataService.loadByMsel(msel.id);
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
  }

  getSortedOrganizations(organizations: Organization[]) {
    if (organizations) {
      organizations.sort((a, b) => this.sortOrganizations(a, b, this.sort.active, this.sort.direction));
    }
    return organizations;
  }

  addOrEditOrganization(organization: Organization, makeTemplate: boolean) {
    if (!organization) {
      organization = {
        name: '',
        summary: '',
        description: '',
        mselId: this.msel.id,
        isTemplate: makeTemplate
      };
    } else {
      organization = {
        id: makeTemplate == organization.isTemplate ? organization.id : null,
        name: organization.name,
        summary: organization.summary,
        description: organization.description,
        mselId: makeTemplate ? null : this.msel.id,
        isTemplate: makeTemplate
      }
    }
    const dialogRef = this.dialog.open(OrganizationEditDialogComponent, {
      width: '800px',
      data: {
        organization: organization
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.organization) {
        this.saveOrganization(result.organization);
      }
      dialogRef.close();
    });
  }

  saveOrganization(organization: Organization) {
    if (organization.id) {
      this.organizationDataService.updateOrganization(organization);
    } else {
      organization.id = uuidv4();
      this.organizationDataService.add(organization);
    }
  }

  deleteOrganization(organization: Organization): void {
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
    this.sortedOrganizations = this.getSortedOrganizations(this.getFilteredOrganizations(this.msel.id, this.organizationList));
    this.templateOrganizations = this.getSortedOrganizations(this.getFilteredOrganizations(null, this.organizationList));
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
        return ( (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case "description":
        return ( (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case "summary":
        return ( (a.summary.toLowerCase() < b.summary.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getFilteredOrganizations(mselId: string, organizations: Organization[]): Organization[] {
    let filteredOrganizations: Organization[] = [];
    if (organizations) {
      organizations.forEach(se => {
        if (se.mselId === mselId) {
          filteredOrganizations.push({... se});
        }
      });
      if (filteredOrganizations && filteredOrganizations.length > 0 && this.filterString) {
        var filterString = this.filterString.toLowerCase();
        filteredOrganizations = filteredOrganizations
          .filter((a) =>
            a.description.toLowerCase().includes(filterString) ||
            a.summary.toLowerCase().includes(filterString) ||
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
