// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CompetencyFrameworkService } from 'src/app/generated/blueprint.api';
import { EMPTY, Subscription, timer } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

interface ElementTypeCount {
  type: string;
  count: number;
}

export interface ImportResult {
  type: 'csv' | 'json' | 'xlsx';
  file?: File;
  source: string;
  version: string;
  /** Id the host passes on the import request so this dialog can poll its progress. */
  importId: string;
}

@Component({
    selector: 'app-admin-competency-framework-import-dialog',
    templateUrl: './admin-competency-framework-import-dialog.component.html',
    styleUrls: ['./admin-competency-framework-import-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyFrameworkImportDialogComponent implements OnDestroy {
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

  // Progress of the import itself, polled from the API. Kept apart from isProcessing,
  // which also covers the much shorter preview request.
  importRunning = false;
  importPercent = 0;
  importPhase = '';
  importCounts = '';
  private importId = '';
  private progressSub: Subscription;

  constructor(
    public dialogRef: MatDialogRef<AdminCompetencyFrameworkImportDialogComponent>,
    private competencyFrameworkService: CompetencyFrameworkService
  ) {}

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
    if (!this.fileType || !this.selectedFile || this.importRunning) {
      return;
    }
    // Importing a large framework takes tens of seconds. The API records progress
    // against this id, so the host passes it on the import request and this dialog
    // polls it — a real bar rather than a spinner that gives nothing away.
    this.importId = uuidv4();
    this.importRunning = true;
    this.importPercent = 0;
    this.importPhase = 'Starting';
    this.importCounts = '';
    this.pollProgress(this.importId);
    this.importComplete.emit({
      type: this.fileType,
      file: this.selectedFile,
      source: this.source,
      version: this.version,
      importId: this.importId,
    });
  }

  /** Called by the host when the import request comes back successfully. */
  finishImport(message: string): void {
    this.stopProgressPolling();
    this.isProcessing = false;
    this.importPercent = 100;
    this.importPhase = 'Complete';
    this.importCounts = '';
    this.importSucceeded = true;
    this.successMessage = message;
  }

  /** Called by the host when the import request fails. */
  failImport(message: string): void {
    this.stopProgressPolling();
    this.isProcessing = false;
    this.importRunning = false;
    this.parseError = message;
  }

  private pollProgress(importId: string): void {
    this.progressSub?.unsubscribe();
    this.progressSub = timer(500, 1000)
      .pipe(
        switchMap(() => this.competencyFrameworkService.getCompetencyFrameworkImportStatus(importId)
          // The first poll or two can 404 before the API has registered the import, and
          // a real failure is reported by the import request itself — so a failed poll
          // only means "no news", and must not tear down the timer.
          .pipe(catchError(() => EMPTY)))
      )
      .subscribe((status) => {
        if (importId !== this.importId) {
          return;
        }
        this.importPercent = status.percentComplete ?? 0;
        this.importPhase = status.phase || '';
        this.importCounts = status.total > 0 ? `${status.processed} of ${status.total}` : '';
      });
  }

  private stopProgressPolling(): void {
    this.progressSub?.unsubscribe();
    this.progressSub = null;
    // Blanks the guard in pollProgress, so a poll already in flight is discarded.
    this.importId = '';
  }

  handleCancel(): void {
    this.stopProgressPolling();
    this.importComplete.emit(null);
  }

  ngOnDestroy(): void {
    this.stopProgressPolling();
  }
}
