// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatCheckbox } from '@angular/material/checkbox';

export interface ItemDownloadOption {
  id: string;
  label: string;
}

export interface ItemDownloadDialogData {
  title: string;
  items: ItemDownloadOption[];
}

@Component({
    selector: 'app-item-download-dialog',
    templateUrl: './item-download-dialog.component.html',
    styleUrls: ['./item-download-dialog.component.scss'],
    imports: [
        CrucibleDialogComponent,
        CrucibleDialogContentDirective,
        MatCheckbox,
    ],
})
export class ItemDownloadDialogComponent {
  dialogRef = inject<MatDialogRef<ItemDownloadDialogComponent>>(MatDialogRef);
  data = inject<ItemDownloadDialogData>(MAT_DIALOG_DATA);

  selected: Set<string>;

  constructor() {
    this.selected = new Set(this.data.items.map((i) => i.id));
  }

  isAllSelected(): boolean {
    return this.data.items.length > 0 && this.selected.size === this.data.items.length;
  }

  isIndeterminate(): boolean {
    return this.selected.size > 0 && this.selected.size < this.data.items.length;
  }

  toggleAll(checked: boolean) {
    if (checked) {
      this.selected = new Set(this.data.items.map((i) => i.id));
    } else {
      this.selected = new Set();
    }
  }

  toggle(id: string, checked: boolean) {
    if (checked) {
      this.selected.add(id);
    } else {
      this.selected.delete(id);
    }
  }

  download() {
    this.dialogRef.close([...this.selected]);
  }
}
