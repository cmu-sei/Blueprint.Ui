// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogTitleDirective,
} from '@cmusei/crucible-common';

export interface CapabilityData {
  title: string;
  icon: string;
  description: string;
  features: string[];
  benefits: string[];
}

@Component({
  selector: 'app-capability-dialog',
  templateUrl: './capability-dialog.component.html',
  styleUrls: ['./capability-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogTitleDirective,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatIcon,
    MatButton,
  ],
})
export class CapabilityDialogComponent {
  dialogRef = inject<MatDialogRef<CapabilityDialogComponent>>(MatDialogRef);
  data = inject<CapabilityData>(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }
}
