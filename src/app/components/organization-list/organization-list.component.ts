// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import {
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
  standalone: false
})
export class OrganizationListComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  organizationList: Organization[] = [];
  changedOrganization: Organization = {};
  filteredOrganizationList: Organization[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  sortedOrganizations: Organization[] = [];
  templateOrganizations: Organization[] = [];
  editingId = '';
  organizationDataSource = new MatTableDataSource<Organization>(new Array<Organization>());
  templateDataSource = new MatTableDataSource<Organization>(new Array<Organization>());
  displayedColumns: string[] = ['action', 'shortname', 'name', 'summary'];
  private unsubscribe$ = new Subject();

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
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
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.sortChanged(this.sort);
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
  }

  ngOnInit() {
    if (this.showTemplates) {
      this.organizationDataService.loadTemplates();
    }
  }

  addOrEditOrganization(organization: Organization, makeTemplate: boolean) {
    let dialogTitle = 'Add an Organization';
    if (!organization) {
      organization = {
        name: '',
        shortName: '',
        email: '',
        summary: '',
        description: '',
        mselId: this.msel.id,
        isTemplate: makeTemplate
      };
    } else {
      if (makeTemplate === organization.isTemplate) {
        dialogTitle = dialogTitle.replace('Add an', 'Edit');
      } else {
        organization.id = null;
        if (makeTemplate) {
          dialogTitle = dialogTitle.replace('Add', 'Make');
        }
      }
      organization = {
        id: makeTemplate === organization.isTemplate ? organization.id : null,
        name: organization.name,
        shortName: organization.shortName,
        email: organization.email,
        summary: organization.summary,
        description: organization.description,
        mselId: makeTemplate ? null : this.msel.id,
        isTemplate: makeTemplate
      };
    }
    if (organization.isTemplate) {
      dialogTitle += ' Template';
    }
    const dialogRef = this.dialog.open(OrganizationEditDialogComponent, {
      width: '800px',
      data: {
        organization: organization,
        title: dialogTitle,
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
    this.organizationDataSource.data = this.getFilteredAndSortedOrganizations(this.msel.id, this.organizationList);
    this.templateDataSource.data = this.getFilteredAndSortedOrganizations(null, this.organizationList);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredAndSortedOrganizations(mselId: string, organizations: Organization[]): Organization[] {
    let filteredAndSortedOrganizations: Organization[] = [];
    if (organizations) {
      organizations.forEach(se => {
        if (se.mselId === mselId) {
          filteredAndSortedOrganizations.push({ ...se });
        }
      });
      if (filteredAndSortedOrganizations && filteredAndSortedOrganizations.length > 0 && this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filteredAndSortedOrganizations = filteredAndSortedOrganizations
          .filter((a) =>
            a.summary?.toLowerCase().includes(filterString) ||
            a.shortName?.toLowerCase().includes(filterString) ||
            a.name?.toLowerCase().includes(filterString)
          );
      }
    }
    if (filteredAndSortedOrganizations) {
      filteredAndSortedOrganizations.sort((a, b) => this.sortOrganizations(a, b, this.sort.active, this.sort.direction));
    }
    return filteredAndSortedOrganizations;
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
        return ((a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      case 'shortname':
        return ((a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      case 'summary':
        return ((a.summary.toLowerCase() < b.summary.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      default:
        return 0;
    }
  }

}
