// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-integration-status',
  templateUrl: './integration-status.component.html',
  styleUrls: ['./integration-status.component.scss'],
  standalone: false
})
export class IntegrationStatusComponent {
  @Input() msel: MselPlus;
  @Output() closed = new EventEmitter<void>();
  cancelClicked = false;

  constructor(
    private mselDataService: MselDataService,
    private dialogService: DialogService
  ) {}

  get isError(): boolean {
    return this.msel?.integrationStatus?.startsWith('ERROR') || false;
  }

  get isCancelling(): boolean {
    return this.cancelClicked || this.msel?.integrationStatus?.startsWith('Cancelling') || false;
  }

  get isPulling(): boolean {
    return this.msel?.integrationStatus?.startsWith('Pulling') || false;
  }

  get statusMessage(): string {
    if (this.isError) {
      return this.msel.integrationStatus.substring(7);
    }
    return this.msel?.integrationStatus || '';
  }

  cancelPush() {
    this.cancelClicked = true;
    this.mselDataService.cancelIntegrations(this.msel.id);
  }

  pullIntegrations() {
    this.dialogService
      .confirm(
        'Remove Integrations',
        'Are you sure you want to remove partial integrations from the associated applications?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pullIntegrations(this.msel.id);
          this.closed.emit();
        }
      });
  }

  close() {
    this.closed.emit();
  }
}
