// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
  standalone: false
})
export class CapabilityDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CapabilityDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CapabilityData
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
