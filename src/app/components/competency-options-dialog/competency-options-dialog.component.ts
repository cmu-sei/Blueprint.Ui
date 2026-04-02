// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Sort } from '@angular/material/sort';
import { DataOption } from 'src/app/generated/blueprint.api';
import { DataOptionEditDialogComponent } from '../data-option-edit-dialog/data-option-edit-dialog.component';
import { DataOptionImportDialogComponent } from '../data-option-import-dialog/data-option-import-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-competency-options-dialog',
    templateUrl: './competency-options-dialog.component.html',
    styleUrls: ['./competency-options-dialog.component.scss'],
    standalone: false
})
export class CompetencyOptionsDialogComponent {
  searchText = '';
  sortActive = 'displayOrder';
  sortDirection = 'asc';

  displayedColumns: string[];

  constructor(
    public dialogRef: MatDialogRef<CompetencyOptionsDialogComponent>,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataFieldId: string;
      dataOptions: DataOption[];
      canEdit: boolean;
    }
  ) {
    dialogRef.disableClose = true;
    this.displayedColumns = this.data.canEdit
      ? ['actions', 'displayOrder', 'optionName', 'optionValue', 'optionDescription']
      : ['displayOrder', 'optionName', 'optionValue', 'optionDescription'];
  }

  get filteredOptions(): DataOption[] {
    if (!this.searchText) {
      return this.sortedOptions;
    }
    const search = this.searchText.toLowerCase();
    return this.sortedOptions.filter(option =>
      option.optionName?.toLowerCase().includes(search) ||
      option.optionValue?.toLowerCase().includes(search) ||
      option.optionDescription?.toLowerCase().includes(search)
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
        case 'optionDescription':
          valA = (a.optionDescription || '').toLowerCase();
          valB = (b.optionDescription || '').toLowerCase();
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

  // --- Import ---

  handleImport() {
    const dialogRef = this.dialog.open(DataOptionImportDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: {
        dataFieldId: this.data.dataFieldId,
        existingOptions: this.data.dataOptions,
        instructions: 'Upload a file containing competencies (e.g., NICE Framework JSON). Supported formats: JSON, CSV, or XLSX. The file should have columns for ID, Name, and Description.',
        showDescription: true
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result && Array.isArray(result)) {
        this.data.dataOptions.push(...result);
      }
    });
  }

  // --- Option Management ---

  handleAdd() {
    const dataOption: DataOption = {
      displayOrder: this.data.dataOptions.length + 1,
      dataFieldId: this.data.dataFieldId
    };
    this.openEditDialog(dataOption);
  }

  handleEdit(option: DataOption) {
    const selected = { ...option };
    this.openEditDialog(selected);
  }

  handleDelete(option: DataOption) {
    const index = this.data.dataOptions.findIndex(x => x.id === option.id);
    if (index >= 0) {
      this.data.dataOptions.splice(index, 1);
    }
  }

  private openEditDialog(dataOption: DataOption) {
    const dialogRef = this.dialog.open(DataOptionEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: { dataOption, showDescription: true }
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.dataOption) {
        if (dataOption.id) {
          const index = this.data.dataOptions.findIndex(x => x.id === dataOption.id);
          this.data.dataOptions[index] = dataOption;
        } else {
          dataOption.id = uuidv4();
          this.data.dataOptions.push(dataOption);
        }
      }
      dialogRef.close();
    });
  }

  handleClose() {
    this.dialogRef.close();
  }
}
