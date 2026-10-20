// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject, output } from '@angular/core';
import { Msel } from 'src/app/generated/blueprint.api';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-scenario-event-copy-dialog',
    templateUrl: './scenario-event-copy-dialog.component.html',
    styleUrls: ['./scenario-event-copy-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatRadioGroup, FormsModule, MatRadioButton]
})
export class ScenarioEventCopyDialogComponent implements OnDestroy, OnInit {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();
  mselList: Msel[] = [];
  selectedMselId = '';

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
