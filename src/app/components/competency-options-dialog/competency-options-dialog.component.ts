// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { DataOption } from 'src/app/generated/blueprint.api';
import { DataOptionEditDialogComponent } from '../data-option-edit-dialog/data-option-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

export interface CompetencyPreviewItem {
  optionName: string;
  optionValue: string;
  willImport: boolean;
  exists: boolean;
}

@Component({
    selector: 'app-competency-options-dialog',
    templateUrl: './competency-options-dialog.component.html',
    styleUrls: ['./competency-options-dialog.component.scss'],
    standalone: false
})
export class CompetencyOptionsDialogComponent {
  searchText = '';
  parseError = '';
  isProcessing = false;
  previewItems: CompetencyPreviewItem[] = [];

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
    return [...this.data.dataOptions].sort((a, b) =>
      +a.displayOrder < +b.displayOrder ? -1 : 1
    );
  }

  // --- File Import ---

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isProcessing = true;
      this.parseError = '';
      this.previewItems = [];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          this.parseNiceFramework(e.target.result);
        } catch (error) {
          this.parseError = `Error reading file: ${error.message}`;
        } finally {
          this.isProcessing = false;
        }
      };
      reader.readAsText(file);
    }
  }

  parseNiceFramework(jsonContent: string) {
    try {
      const parsed = JSON.parse(jsonContent);
      const items: CompetencyPreviewItem[] = [];

      if (parsed.response && parsed.response.elements && parsed.response.elements.elements) {
        // NICE v2.0.0 format
        const elements = parsed.response.elements.elements;
        for (const element of elements) {
          if (element.element_type === 'task' && element.element_identifier) {
            items.push(this.createPreviewItem(element.element_identifier, element.text || ''));
          }
        }
      } else if (parsed.elements && Array.isArray(parsed.elements)) {
        // NICE v1.0.0 format
        for (const element of parsed.elements) {
          if (element.element_type === 'task' && element.element_identifier) {
            items.push(this.createPreviewItem(element.element_identifier, element.text || ''));
          }
        }
      } else {
        this.parseError = 'Unrecognized JSON format. Expected NICE Framework format.';
        return;
      }

      if (items.length === 0) {
        this.parseError = 'No tasks/competencies found in JSON.';
      } else {
        this.previewItems = items;
      }
    } catch (error) {
      this.parseError = `Error parsing JSON: ${error.message}`;
    }
  }

  private createPreviewItem(optionName: string, optionValue: string): CompetencyPreviewItem {
    const exists = this.data.dataOptions.some(opt => opt.optionName === optionName);
    return { optionName, optionValue, willImport: !exists, exists };
  }

  getImportCount(): number {
    return this.previewItems.filter(item => item.willImport).length;
  }

  getSkipCount(): number {
    return this.previewItems.filter(item => !item.willImport).length;
  }

  getAvailableCount(): number {
    return this.previewItems.filter(item => !item.exists).length;
  }

  areAllSelected(): boolean {
    const available = this.previewItems.filter(item => !item.exists);
    return available.length > 0 && available.every(item => item.willImport);
  }

  isSomeSelected(): boolean {
    const available = this.previewItems.filter(item => !item.exists);
    const selected = available.filter(item => item.willImport);
    return selected.length > 0 && selected.length < available.length;
  }

  toggleAll(checked: boolean) {
    this.previewItems.forEach(item => {
      if (!item.exists) {
        item.willImport = checked;
      }
    });
  }

  handleImport() {
    const itemsToImport = this.previewItems
      .filter(item => item.willImport)
      .map((item, index) => ({
        id: uuidv4(),
        dataFieldId: this.data.dataFieldId,
        optionName: item.optionName,
        optionValue: item.optionValue,
        displayOrder: this.data.dataOptions.length + index + 1
      } as DataOption));

    this.data.dataOptions.push(...itemsToImport);
    this.previewItems = [];
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
      data: { dataOption }
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
