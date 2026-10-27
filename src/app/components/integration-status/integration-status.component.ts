// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselItemStatus } from 'src/app/generated/blueprint.api';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-integration-status',
    templateUrl: './integration-status.component.html',
    styleUrls: ['./integration-status.component.scss'],
    imports: [MatProgressBar, MatButton, MatIcon]
})
export class IntegrationStatusComponent {
  private mselDataService = inject(MselDataService);
  private dialogService = inject(CrucibleDialogService);
  // true from a Retry Caster click until its request answers, so a second click cannot send a second retry
  readonly retrying = signal(false);

  readonly msel = input<MselPlus>(undefined);
  // the MSEL's Caster workspace, once the push has created it; empty otherwise
  readonly casterWorkspaceUrl = input('');
  readonly closed = output<void>();
  cancelClicked = false;

  get isError(): boolean {
    return this.msel()?.integrationStatus?.startsWith('ERROR') || false;
  }

  get isCancelling(): boolean {
    return this.cancelClicked || this.msel()?.integrationStatus?.startsWith('Cancelling') || false;
  }

  get isPulling(): boolean {
    return this.msel()?.integrationStatus?.startsWith('Pulling') || false;
  }

  // only a push that failed at its last step, Caster, can redo that step alone
  get canRetryCaster(): boolean {
    return this.isError && this.msel()?.status === MselItemStatus.Pushing &&
      this.msel().integrationStatus.startsWith('ERROR: Caster - ');
  }

  get statusMessage(): string {
    if (this.isError) {
      return this.msel().integrationStatus.substring(7);
    }
    return this.msel()?.integrationStatus || '';
  }

  cancelPush() {
    this.cancelClicked = true;
    this.mselDataService.cancelIntegrations(this.msel().id);
  }

  retryCaster() {
    this.retrying.set(true);
    this.mselDataService
      .retryCaster(this.msel().id)
      .pipe(finalize(() => this.retrying.set(false)))
      // the data service reports a failure; here it only re-enables the button
      .subscribe({ error: () => {} });
  }

  pullIntegrations() {
    this.dialogService
      .confirm({ title: 'Remove Integrations', message: 'Are you sure that you want to remove partial integrations from the associated applications?'
       }).afterClosed().subscribe((result) => {
        if (result) {
          this.mselDataService.pullIntegrations(this.msel().id);
          this.closed.emit();
        }
      });
  }

  close() {
    this.closed.emit();
  }
}
