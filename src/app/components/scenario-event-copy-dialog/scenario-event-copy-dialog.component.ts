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
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-scenario-event-copy-dialog',
    templateUrl: './scenario-event-copy-dialog.component.html',
    styleUrls: ['./scenario-event-copy-dialog.component.scss'],
    standalone: false
})
export class ScenarioEventCopyDialogComponent implements OnDestroy, OnInit {
  @Output() editComplete = new EventEmitter<any>();
  mselList: Msel[] = [];
  selectedMselId = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() { }

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

  ngOnDestroy() { }
}
