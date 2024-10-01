// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  Component,
  EventEmitter,
  Inject,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Msel } from 'src/app/generated/blueprint.api';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
} from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-scenario-event-copy-dialog',
  templateUrl: './scenario-event-copy-dialog.component.html',
  styleUrls: ['./scenario-event-copy-dialog.component.scss'],
})
export class ScenarioEventCopyDialogComponent implements OnDestroy, OnInit {
  @Output() editComplete = new EventEmitter<any>();
  mselList: Msel[] = [];
  selectedMselId = '';

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<ScenarioEventCopyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {}

  /**
   * Closes the edit screen
   */
  handleEditComplete(goForIt: boolean): void {
    if (!goForIt) {
      this.editComplete.emit({ mselId: '' });
    } else {
      this.editComplete.emit({
        mselId: this.selectedMselId,
      });
    }
  }

  ngOnDestroy() {}
}
