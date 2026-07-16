// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { Subject, takeUntil } from 'rxjs';
import { DataField } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-admin-catalog-edit-dialog',
    templateUrl: './admin-catalog-edit-dialog.component.html',
    styleUrls: ['./admin-catalog-edit-dialog.component.scss'],
    standalone: false
})
export class AdminCatalogEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  dataFieldList: DataField[] = [];
  private dataFieldsLoaded = false;
  private unsubscribe$ = new Subject();

  constructor(
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.dataFieldList = dataFields
          .filter((m) => m.injectTypeId === this.data.catalog.injectTypeId)
          .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
      });
  }

  errorFree() {
    return (
      this.data.catalog.name &&
      this.data.catalog.description &&
      this.data.catalog.injectTypeId
    );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, catalog: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          catalog: this.data.catalog,
        });
      }
    }
  }

  getInjectTypeDataFields() {
    if (!this.dataFieldsLoaded && this.data.catalog.injectTypeId) {
      this.loadDataFields();
    }
    return this.dataFieldList;
  }

  isInListDataFields(id: string) {
    return this.data.catalog.listDataFields
      ? this.data.catalog.listDataFields.indexOf(id) > -1
      : false;
  }

  setDataFieldInList(id: string) {
    let idArray = this.data.catalog.listDataFields
      ? this.data.catalog.listDataFields.split(',')
      : [];
    const index = idArray ? idArray.indexOf(id) : -1;
    if (index > -1) {
      idArray = idArray.pop(index, 1);
    } else {
      idArray.push(id);
    }
    this.data.catalog.listDataFields = idArray.join(',');
  }

  loadDataFields() {
    this.dataFieldsLoaded = true;
    this.dataFieldDataService.loadByInjectType(this.data.catalog.injectTypeId);
  }
}
