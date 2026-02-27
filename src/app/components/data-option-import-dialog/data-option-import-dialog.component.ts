// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataOption } from 'src/app/generated/blueprint.api';
import { v4 as uuidv4 } from 'uuid';

export interface ImportPreviewItem {
  optionName: string;
  optionValue: string;
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
  jsonContent: string = '';
  previewItems: ImportPreviewItem[] = [];
  parseError: string = '';
  isProcessing = false;

  constructor(
    public dialogRef: MatDialogRef<DataOptionImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataFieldId: string;
      existingOptions: DataOption[];
    }
  ) {
    dialogRef.disableClose = true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isProcessing = true;
      this.parseError = '';
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          this.jsonContent = e.target.result;
          this.parseNiceFramework(this.jsonContent);
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
      const items: ImportPreviewItem[] = [];

      // Try to parse as NICE Framework format
      if (parsed.response && parsed.response.elements && parsed.response.elements.elements) {
        // NICE v2.0.0 format
        const elements = parsed.response.elements.elements;
        for (const element of elements) {
          if (element.element_type === 'task' && element.element_identifier) {
            items.push(this.createPreviewItem(
              element.element_identifier,
              element.text || ''
            ));
          }
        }
      } else if (parsed.elements && Array.isArray(parsed.elements)) {
        // NICE v1.0.0 format (flat array)
        for (const element of parsed.elements) {
          if (element.element_type === 'task' && element.element_identifier) {
            items.push(this.createPreviewItem(
              element.element_identifier,
              element.text || ''
            ));
          }
        }
      } else if (Array.isArray(parsed)) {
        // Generic array format [{ id, name }, ...]
        for (const item of parsed) {
          const id = item.id || item.identifier || item.code || item.optionName;
          const value = item.name || item.description || item.text || item.value || item.optionValue;
          if (id && value) {
            items.push(this.createPreviewItem(String(id), String(value)));
          }
        }
      } else {
        this.parseError = 'Unrecognized JSON format. Expected NICE Framework or array of objects with id/name fields.';
        return;
      }

      if (items.length === 0) {
        this.parseError = 'No tasks/competencies found in JSON. Please check the file format.';
      } else {
        this.previewItems = items;
      }
    } catch (error) {
      this.parseError = `Error parsing JSON: ${error.message}`;
    }
  }

  private createPreviewItem(optionName: string, optionValue: string): ImportPreviewItem {
    const exists = this.data.existingOptions.some(
      opt => opt.optionName === optionName
    );
    return {
      optionName,
      optionValue,
      willImport: !exists,
      exists
    };
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
        displayOrder: this.data.existingOptions.length + index + 1
      }));

    this.dialogRef.close(itemsToImport);
  }

  handleCancel() {
    this.dialogRef.close();
  }
}
