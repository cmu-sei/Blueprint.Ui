// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataOption } from 'src/app/generated/blueprint.api';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

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
    }
  ) {
    dialogRef.disableClose = true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isProcessing = true;
      this.parseError = '';
      this.previewItems = [];
      this.fileName = file.name;
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            this.parseJson(e.target.result);
          } catch (error) {
            this.parseError = `Error reading file: ${error.message}`;
          } finally {
            this.isProcessing = false;
          }
        };
        reader.readAsText(file);
      } else if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            this.parseCsv(e.target.result);
          } catch (error) {
            this.parseError = `Error reading file: ${error.message}`;
          } finally {
            this.isProcessing = false;
          }
        };
        reader.readAsText(file);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            this.parseXlsx(e.target.result);
          } catch (error) {
            this.parseError = `Error reading file: ${error.message}`;
          } finally {
            this.isProcessing = false;
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        this.parseError = 'Unsupported file type. Please use JSON, CSV, or XLSX.';
        this.isProcessing = false;
      }
    }
  }

  parseJson(content: string) {
    const parsed = JSON.parse(content);
    const items: ImportPreviewItem[] = [];

    // NICE Framework format (v1.0.0 / v2.0.0+)
    if (parsed.response?.elements?.elements || (parsed.elements && Array.isArray(parsed.elements))) {
      const elements = parsed.response?.elements?.elements || parsed.elements;
      const skipTypes = ['sort', 'opm_code'];
      for (const item of elements) {
        if (skipTypes.includes(item.element_type)) continue;
        if (item.element_identifier) {
          const description = item.text || item.title || '';
          items.push(this.createPreviewItem(item.element_identifier, description));
        }
      }
    } else if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const pair = this.extractPair(item);
        if (pair) {
          items.push(this.createPreviewItem(pair.id, pair.value));
        }
      }
    } else if (typeof parsed === 'object') {
      // Generic object — try to find an array property
      const arrayProp = Object.values(parsed).find(v => Array.isArray(v)) as any[];
      if (arrayProp) {
        for (const item of arrayProp) {
          const pair = this.extractPair(item);
          if (pair) {
            items.push(this.createPreviewItem(pair.id, pair.value));
          }
        }
      }
    }

    if (items.length === 0) {
      this.parseError = 'No options found. Expected an array of objects with ID and description fields.';
    } else {
      this.previewItems = items;
    }
  }

  private extractPair(item: any): { id: string; value: string } | null {
    if (typeof item !== 'object' || !item) return null;
    const id = item.id || item.identifier || item.code || item.optionName || item.name || item.element_identifier;
    const value = item.description || item.text || item.value || item.optionValue || item.name;
    if (id) {
      return { id: String(id), value: value ? String(value) : '' };
    }
    return null;
  }

  parseCsv(content: string) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      this.parseError = 'CSV file must have a header row and at least one data row.';
      return;
    }

    const headers = this.parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const idCol = this.findColumn(headers, ['id', 'identifier', 'code', 'optionname', 'name']);
    const valueCol = this.findColumn(headers, ['description', 'text', 'value', 'optionvalue']);

    if (idCol < 0) {
      // Fall back to positional: first column = ID, second = description
      if (headers.length >= 1) {
        const items: ImportPreviewItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = this.parseCsvLine(lines[i]);
          if (cols[0]?.trim()) {
            items.push(this.createPreviewItem(cols[0].trim(), (cols[1] || '').trim()));
          }
        }
        this.setPreviewItems(items);
        return;
      }
      this.parseError = 'Could not identify columns. Use headers like "ID" and "Description".';
      return;
    }

    const items: ImportPreviewItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const id = cols[idCol]?.trim();
      const value = valueCol >= 0 ? (cols[valueCol] || '').trim() : '';
      if (id) {
        items.push(this.createPreviewItem(id, value));
      }
    }
    this.setPreviewItems(items);
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  private findColumn(headers: string[], candidates: string[]): number {
    for (const candidate of candidates) {
      const index = headers.indexOf(candidate);
      if (index >= 0) return index;
    }
    return -1;
  }

  parseXlsx(data: ArrayBuffer) {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      this.parseError = 'Spreadsheet must have a header row and at least one data row.';
      return;
    }

    const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
    const idCol = this.findColumn(headers, ['id', 'identifier', 'code', 'optionname', 'name']);
    const valueCol = this.findColumn(headers, ['description', 'text', 'value', 'optionvalue']);

    const items: ImportPreviewItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      let id: string, value: string;
      if (idCol >= 0) {
        id = String(cols[idCol] || '').trim();
        value = valueCol >= 0 ? String(cols[valueCol] || '').trim() : '';
      } else {
        // Positional fallback
        id = String(cols[0] || '').trim();
        value = String(cols[1] || '').trim();
      }
      if (id) {
        items.push(this.createPreviewItem(id, value));
      }
    }
    this.setPreviewItems(items);
  }

  private setPreviewItems(items: ImportPreviewItem[]) {
    if (items.length === 0) {
      this.parseError = 'No options found in file.';
    } else {
      this.previewItems = items;
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
