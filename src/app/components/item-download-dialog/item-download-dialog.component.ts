// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

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
  standalone: false,
})
export class ItemDownloadDialogComponent {
  selected: Set<string>;

  constructor(
    public dialogRef: MatDialogRef<ItemDownloadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ItemDownloadDialogData
  ) {
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

  cancel() {
    this.dialogRef.close();
  }

  download() {
    this.dialogRef.close([...this.selected]);
  }
}
