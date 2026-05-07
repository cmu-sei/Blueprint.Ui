// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataOption, DataOptionService } from 'src/app/generated/blueprint.api';
import { v4 as uuidv4 } from 'uuid';
import { take } from 'rxjs/operators';

export interface ImportPreviewItem {
  optionName: string;
  optionValue: string;
  optionDescription: string;
  willImport: boolean;
  exists: boolean;
}

@Component({
    selector: 'app-data-option-import-dialog',
    templateUrl: './data-option-import-dialog.component.html',
    styleUrls: ['./data-option-import-dialog.component.scss'],
    standalone: false
})
export class DataOptionImportDialogComponent {
  previewItems: ImportPreviewItem[] = [];
  parseError: string = '';
  isProcessing = false;
  fileName = '';

  constructor(
    public dialogRef: MatDialogRef<DataOptionImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataFieldId: string;
      existingOptions: DataOption[];
      instructions?: string;
      showDescription?: boolean;
    },
    private dataOptionService: DataOptionService
  ) {
    dialogRef.disableClose = true;
  }

  get hasDescription(): boolean {
    return this.data.showDescription === true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!this.data.dataFieldId) {
        this.parseError = 'Data field ID is missing';
        return;
      }

      this.isProcessing = true;
      this.parseError = '';
      this.previewItems = [];
      this.fileName = file.name;

      // Upload file to API for server-side parsing
      this.dataOptionService.previewDataOptionImport(this.data.dataFieldId, file)
        .pipe(take(1))
        .subscribe({
          next: (preview) => {
            if (preview.error) {
              this.parseError = preview.error;
            } else {
              this.previewItems = preview.items.map(item => ({
                optionName: item.optionName,
                optionValue: item.optionValue,
                optionDescription: item.optionDescription,
                willImport: !item.exists,
                exists: item.exists
              }));
            }
            this.isProcessing = false;
          },
          error: (err) => {
            this.parseError = `Error processing file: ${err.error?.title || err.message || 'Unknown error'}`;
            this.isProcessing = false;
          }
        });
    }
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
        optionDescription: item.optionDescription || null,
        displayOrder: this.data.existingOptions.length + index + 1
      }));

    this.dialogRef.close(itemsToImport);
  }

  handleCancel() {
    this.dialogRef.close();
  }
}
