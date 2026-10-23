// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselImportResult } from 'src/app/generated/blueprint.api';

export interface MselImportDialogData {
  file: File;
}

@Component({
  selector: 'app-msel-import-dialog',
  templateUrl: './msel-import-dialog.component.html',
  styleUrls: ['./msel-import-dialog.component.scss'],
  standalone: false,
})
export class MselImportDialogComponent implements OnInit {
  isImporting = true;
  result: MselImportResult;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<MselImportDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: MselImportDialogData,
    private mselDataService: MselDataService
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {
    this.mselDataService
      .importJson(this.data.file)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isImporting = false;
          this.dialogRef.disableClose = false;
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err);
          this.isImporting = false;
          this.dialogRef.disableClose = false;
        },
      });
  }

  get counts(): { label: string; value: number }[] {
    const imported = this.result?.imported;
    if (!imported) {
      return [];
    }
    return [
      { label: 'Moves', value: imported.moves },
      { label: 'Scenario Events', value: imported.scenarioEvents },
      { label: 'Cards', value: imported.cards },
      { label: 'Teams', value: imported.teams },
      { label: 'Data Fields', value: imported.dataFields },
      { label: 'Pages', value: imported.pages },
    ];
  }

  openMsel() {
    this.dialogRef.close(this.result.msel.id);
  }

  close() {
    this.dialogRef.close();
  }

  private getErrorMessage(err: any): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail ? `${title} ${detail}` : title;
    }
    return err?.message || 'The import failed.';
  }
}
