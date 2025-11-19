// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Catalog, InjectType, Team } from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatTable } from '@angular/material/table';
import { CatalogDataService } from 'src/app/data/catalog/catalog-data.service';
import { CatalogQuery } from 'src/app/data/catalog/catalog.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AdminCatalogEditDialogComponent } from '../admin-catalog-edit-dialog/admin-catalog-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';

@Component({
    selector: 'app-admin-catalog-list',
    templateUrl: './admin-catalog-list.component.html',
    styleUrls: ['./admin-catalog-list.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
            state('expanded', style({ height: '*', visibility: 'visible' })),
            transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
        ]),
    ],
    standalone: false
})
export class AdminCatalogListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @ViewChild('catalogTable', { static: false }) catalogTable: MatTable<any>;
  @ViewChild('jsonInput') jsonInput: ElementRef<HTMLInputElement>;
  contextMenuPosition = { x: '0px', y: '0px' };
  catalogList: Catalog[] = [];
  changedCatalog: Catalog = {};
  filteredAdminCatalogs: Catalog[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  sortedCatalogs: Catalog[] = [];
  templateCatalogs: Catalog[] = [];
  editingId = '';
  catalogDataSource = new MatTableDataSource<Catalog>(new Array<Catalog>());
  displayedColumns: string[] = [
    'action',
    'ispublic',
    'name',
    'injecttype',
    'description',
  ];
  injectTypeList: InjectType[] = [];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) =>
    (row as Catalog).id === this.expandedElementId;
  expandedElementId = '';
  uploadProgress = 0;
  uploadCatalogId = '';

  constructor(
    private catalogDataService: CatalogDataService,
    private catalogQuery: CatalogQuery,
    public dialog: MatDialog,
    public dialogService: DialogService,
    private injectTypeQuery: InjectTypeQuery
  ) {
    // subscribe to catalogs
    this.catalogQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((catalogs) => {
        this.catalogList = catalogs;
        this.sortChanged(this.sort);
      });
    // subscribe to InjectTypes
    this.injectTypeQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((injectTypes) => {
        this.injectTypeList = injectTypes.sort((a, b) =>
          a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1
        );
      });
    // subscribe to filter control changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
    // load catalogs
    this.catalogDataService.load();
  }

  getSortedCatalogs(catalogs: Catalog[]) {
    if (catalogs) {
      catalogs.sort((a, b) =>
        this.sortCatalogs(a, b, this.sort.active, this.sort.direction)
      );
    }
    return catalogs;
  }

  addOrEditCatalog(catalog: Catalog) {
    if (!catalog) {
      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 30);
      catalog = {};
    }
    const dialogRef = this.dialog.open(AdminCatalogEditDialogComponent, {
      width: '800px',
      data: {
        catalog: catalog,
        injectTypeList: this.injectTypeList,
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.catalog) {
        this.saveCatalog(result.catalog);
      }
      dialogRef.close();
    });
  }

  saveCatalog(catalog: Catalog) {
    if (catalog.id) {
      this.catalogDataService.update(catalog);
    } else {
      catalog.id = uuidv4();
      this.catalogDataService.add(catalog);
    }
  }

  deleteCatalog(catalog: Catalog): void {
    this.dialogService
      .confirm(
        'Delete Catalog',
        'Are you sure that you want to delete ' + catalog.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.catalogDataService.delete(catalog.id);
          this.editingId = '';
        }
      });
  }

  copyCatalog(catalog: Catalog): void {
    this.dialogService
      .confirm(
        'Copy Catalog',
        'Are you sure that you want to copy ' + catalog.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.catalogDataService.copy(catalog.id);
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.catalogDataSource.data = this.getSortedCatalogs(
      this.getFilteredCatalogs(this.catalogList)
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredCatalogs(catalogs: Catalog[]): Catalog[] {
    let filteredCatalogs: Catalog[] = [];
    if (catalogs) {
      catalogs.forEach((se) => {
        filteredCatalogs.push({ ...se });
      });
      if (
        filteredCatalogs &&
        filteredCatalogs.length > 0 &&
        this.filterString
      ) {
        const filterString = this.filterString?.toLowerCase();
        filteredCatalogs = filteredCatalogs.filter((catalog) =>
          catalog.name?.toLowerCase().includes(filterString)
        );
      }
    }
    return filteredCatalogs;
  }

  private sortCatalogs(
    a: Catalog,
    b: Catalog,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      default:
        return 0;
    }
  }

  rowClicked(row: Catalog) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.catalogTable.renderRows();
  }

  getRowClass(id: string) {
    const rowClass =
      this.expandedElementId === id
        ? 'element-row element-row-expanded'
        : 'element-row element-row-not-expanded';
    return rowClass;
  }

  getInjectTypeName(injectTypeId: string) {
    const injectType = this.injectTypeList.find((m) => m.id === injectTypeId);
    return injectType ? injectType.name : '';
  }

  uploadFile(fileType: string, catalogId: string, teamId: string) {
    this.uploadCatalogId = catalogId ? catalogId : '';
  }

  /**
   * Selects the file(s) to be uploaded. Called when file selection is changed
   */
  selectFile(e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    this.uploadProgress = 0;
    this.catalogDataService.uploadJson(file, 'events', true);
    this.jsonInput.nativeElement.value = null;
  }

  /**
   * Trigger a download for a file.
   *
   * @param catalogId: The GUID of the file to download
   * @param name: The name to use when triggering the download
   */
  downloadJsonFile(catalog: Catalog) {
    this.catalogDataService.downloadJson(catalog.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = catalog.name + '-catalog.json';
        link.click();
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }
}
