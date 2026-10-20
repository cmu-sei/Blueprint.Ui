// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, AfterViewInit, inject } from '@angular/core';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
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
import { Sort, MatSort, MatSortHeader } from '@angular/material/sort';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { MatDialog } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { OrganizationEditDialogComponent } from '../organization-edit-dialog/organization-edit-dialog.component';
import { ItemDownloadDialogComponent } from '../item-download-dialog/item-download-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { MatIcon } from '@angular/material/icon';

import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';

@Component({
    selector: 'app-organization-list',
    templateUrl: './organization-list.component.html',
    styleUrls: ['./organization-list.component.scss'],
    imports: [MatIcon, MatFormField, MatInput, FormsModule, ReactiveFormsModule, MatIconButton, MatSuffix, MatPaginator, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatMenuTrigger, MatMenu, MatMenuItem, MatCellDef, MatCell, MatSortHeader, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow]
})
export class OrganizationListComponent implements OnDestroy, OnInit, AfterViewInit {
  private router = inject(Router);
  private settingsService = inject(ComnSettingsService);
  private authQuery = inject(ComnAuthQuery);
  private mselDataService = inject(MselDataService);
  private mselQuery = inject(MselQuery);
  private organizationDataService = inject(OrganizationDataService);
  private organizationQuery = inject(OrganizationQuery);
  dialog = inject(MatDialog);
  dialogService = inject(CrucibleDialogService);

  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild('jsonInput') jsonInput: ElementRef<HTMLInputElement>;
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

  constructor() {
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

  ngAfterViewInit() {
    if (this.showTemplates) {
      this.templateDataSource.paginator = this.paginator;
    } else {
      this.organizationDataSource.paginator = this.paginator;
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
        mselId: makeTemplate ? null : this.msel.id,
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
      maxWidth: '90vw',
      width: 'auto',
      minWidth: '900px',
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

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.organizationDataService.uploadJson(file, 'events', true);
    this.jsonInput.nativeElement.value = null;
  }

  openDownloadDialog() {
    const items = (this.templateDataSource.data || []).map((o) => ({
      id: o.id,
      label: o.name || o.shortName || o.id,
    }));
    const dialogRef = this.dialog.open(ItemDownloadDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      data: {
        title: 'Select Organization templates to download',
        items,
      },
    });
    dialogRef.afterClosed().subscribe((selectedIds: string[] | undefined) => {
      if (selectedIds && selectedIds.length > 0) {
        this.downloadJsonItems(selectedIds);
      }
    });
  }

  downloadJsonItems(ids: string[]) {
    this.organizationDataService.downloadJson(ids).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = 'organization-templates.json';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }

  deleteOrganization(organization: Organization): void {
    this.dialogService
      .confirm({ title: 'Delete Organization', message: 'Are you sure that you want to delete ' + organization.name + '?'
       }).afterClosed().subscribe((result) => {
        if (result) {
          this.organizationDataService.delete(organization.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    const mselData = this.getFilteredAndSortedOrganizations(this.msel.id, this.organizationList);
    const templateData = this.getFilteredAndSortedOrganizations(null, this.organizationList);
    this.organizationDataSource.data = mselData;
    this.templateDataSource.data = templateData;
    if (this.paginator) {
      this.paginator.length = this.showTemplates ? templateData.length : mselData.length;
    }
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
        return (((a.name ?? '').toLowerCase() < (b.name ?? '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      case 'shortname':
        return (((a.shortName ?? '').toLowerCase() < (b.shortName ?? '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      case 'summary':
        return (((a.summary ?? '').toLowerCase() < (b.summary ?? '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      default:
        return 0;
    }
  }

}
