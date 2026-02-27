// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataOption } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-data-option-list-dialog',
    templateUrl: './data-option-list-dialog.component.html',
    styleUrls: ['./data-option-list-dialog.component.scss'],
    standalone: false
})
export class DataOptionListDialogComponent {
  searchText = '';

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
    return [...this.data.dataOptions].sort((a, b) =>
      +a.displayOrder < +b.displayOrder ? -1 : 1
    );
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
