// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Sort } from '@angular/material/sort';
import { DataOption } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-data-option-list-dialog',
    templateUrl: './data-option-list-dialog.component.html',
    styleUrls: ['./data-option-list-dialog.component.scss'],
    standalone: false
})
export class DataOptionListDialogComponent {
  searchText = '';
  sortActive = 'displayOrder';
  sortDirection = 'asc';

  constructor(
    public dialogRef: MatDialogRef<DataOptionListDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataOptions: DataOption[];
      canEdit: boolean;
      onEdit: (option: DataOption) => void;
      onDelete: (option: DataOption) => void;
      onAdd: () => void;
      onImport: () => void;
    }
  ) {}

  get displayedColumns(): string[] {
    return this.data.canEdit
      ? ['actions', 'displayOrder', 'optionName', 'optionValue']
      : ['displayOrder', 'optionName', 'optionValue'];
  }

  get filteredOptions(): DataOption[] {
    if (!this.searchText) {
      return this.sortedOptions;
    }
    const search = this.searchText.toLowerCase();
    return this.sortedOptions.filter(option =>
      option.optionName?.toLowerCase().includes(search) ||
      option.optionValue?.toLowerCase().includes(search)
    );
  }

  get sortedOptions(): DataOption[] {
    const data = [...this.data.dataOptions];
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      let valA: any, valB: any;
      switch (this.sortActive) {
        case 'optionName':
          valA = (a.optionName || '').toLowerCase();
          valB = (b.optionName || '').toLowerCase();
          break;
        case 'optionValue':
          valA = (a.optionValue || '').toLowerCase();
          valB = (b.optionValue || '').toLowerCase();
          break;
        default:
          valA = +a.displayOrder;
          valB = +b.displayOrder;
          break;
      }
      return (valA < valB ? -1 : valA > valB ? 1 : 0) * direction;
    });
  }

  onSortChange(sort: Sort) {
    this.sortActive = sort.active;
    this.sortDirection = sort.direction || 'asc';
  }

  handleEdit(option: DataOption) {
    this.data.onEdit(option);
  }

  handleDelete(option: DataOption) {
    this.data.onDelete(option);
  }

  handleAdd() {
    this.data.onAdd();
  }

  handleImport() {
    this.data.onImport();
  }

  handleClose() {
    this.dialogRef.close();
  }
}
