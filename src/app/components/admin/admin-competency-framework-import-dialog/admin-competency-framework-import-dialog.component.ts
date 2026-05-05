// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CompetencyFramework, Competency, CompetencyFrameworkService } from 'src/app/generated/blueprint.api';
import { take } from 'rxjs/operators';

interface ElementTypeCount {
  type: string;
  count: number;
}

export interface ImportResult {
  type: 'csv' | 'json' | 'xlsx';
  file?: File;
  source: string;
  version: string;
}

@Component({
    selector: 'app-admin-competency-framework-import-dialog',
    templateUrl: './admin-competency-framework-import-dialog.component.html',
    styleUrls: ['./admin-competency-framework-import-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyFrameworkImportDialogComponent {
  @Output() importComplete = new EventEmitter<ImportResult | null>();
  fileName = '';
  parseError = '';
  successMessage = '';
  importSucceeded = false;
  source = '';
  version = '';
  selectedFile: File | null = null;
  fileType: 'csv' | 'json' | 'xlsx' | null = null;
  elementTypeCounts: ElementTypeCount[] = [];
  totalElements = 0;
  totalRelationships = 0;
  frameworkName = '';
  isProcessing = false;

  constructor(
    public dialogRef: MatDialogRef<AdminCompetencyFrameworkImportDialogComponent>,
    private competencyFrameworkService: CompetencyFrameworkService
  ) {
    dialogRef.disableClose = true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileName = file.name;
    this.parseError = '';
    this.elementTypeCounts = [];
    this.totalElements = 0;
    this.totalRelationships = 0;
    this.frameworkName = '';
    this.selectedFile = file;
    this.isProcessing = true;

    if (file.name.endsWith('.csv')) {
      this.fileType = 'csv';
      // Extract source/version from filename
      const versionMatch = file.name.match(/_v([\d.]+)/i);
      if (versionMatch) this.version = versionMatch[1];
      const sourceMatch = file.name.match(/^([A-Z]+)/i);
      if (sourceMatch) this.source = sourceMatch[1].toUpperCase();

      // Call preview API
      this.competencyFrameworkService.previewCompetencyFrameworkCsv(this.source, this.version, file)
        .pipe(take(1))
        .subscribe({
          next: (preview) => this.handlePreview(preview),
          error: (err) => {
            this.parseError = `Error previewing CSV: ${err.error?.title || err.message || 'Unknown error'}`;
            this.isProcessing = false;
          }
        });
    } else if (file.name.endsWith('.json')) {
      this.fileType = 'json';
      // Call preview API
      this.competencyFrameworkService.previewCompetencyFrameworkJson(file)
        .pipe(take(1))
        .subscribe({
          next: (preview) => this.handlePreview(preview),
          error: (err) => {
            this.parseError = `Error previewing JSON: ${err.error?.title || err.message || 'Unknown error'}`;
            this.isProcessing = false;
          }
        });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      this.fileType = 'xlsx';
      // Extract version from filename
      const versionMatch = file.name.match(/_v([\d.]+)\./i);
      this.source = 'DCWF';
      this.version = versionMatch ? versionMatch[1] : '';

      // Call preview API
      this.competencyFrameworkService.previewCompetencyFrameworkXlsx(this.source, this.version, file)
        .pipe(take(1))
        .subscribe({
          next: (preview) => this.handlePreview(preview),
          error: (err) => {
            this.parseError = `Error previewing XLSX: ${err.error?.title || err.message || 'Unknown error'}`;
            this.isProcessing = false;
          }
        });
    } else {
      this.parseError = 'Supported formats: .csv (Moodle), .json (NICE), .xlsx (DCWF)';
      this.selectedFile = null;
      this.fileType = null;
      this.isProcessing = false;
    }
  }

  private handlePreview(preview: any): void {
    console.log('Preview response:', preview);
    if (preview.error) {
      this.parseError = preview.error;
    } else {
      this.source = preview.source || this.source;
      this.version = preview.version || this.version;
      this.frameworkName = preview.frameworkName || '';
      this.elementTypeCounts = preview.elementTypeCounts || [];
      this.totalElements = preview.totalElements || 0;
      this.totalRelationships = preview.totalRelationships || 0;
    }
    this.isProcessing = false;
  }


  get ready(): boolean {
    if (this.fileType === 'csv') return !!this.selectedFile && !!this.source && !!this.version;
    if (this.fileType === 'json') return !!this.selectedFile; // Allow import without preview
    if (this.fileType === 'xlsx') return !!this.selectedFile && !!this.source && !!this.version;
    return false;
  }

  handleImport(): void {
    if (this.fileType === 'csv' && this.selectedFile) {
      this.importComplete.emit({
        type: 'csv',
        file: this.selectedFile,
        source: this.source,
        version: this.version,
      });
    } else if (this.fileType === 'json' && this.selectedFile) {
      this.importComplete.emit({
        type: 'json',
        file: this.selectedFile,
        source: this.source,
        version: this.version,
      });
    } else if (this.fileType === 'xlsx' && this.selectedFile) {
      this.importComplete.emit({
        type: 'xlsx',
        file: this.selectedFile,
        source: this.source,
        version: this.version,
      });
    }
  }

  handleCancel(): void {
    this.importComplete.emit(null);
  }
}
