// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MatError,
  MatFormField,
  MatHint,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { Network, Organization, Team } from 'src/app/generated/blueprint.api';
import { nameProblem, rangeProblem, textOrNull } from './range-rules';

export interface NetworkEditDialogData {
  network: Network;
  networks: Network[];
  teams: Team[];
  organizations: Organization[];
}

/** Adds or edits one of a MSEL's networks; closes with the network to save, or nothing */
@Component({
  selector: 'app-network-edit-dialog',
  templateUrl: './network-edit-dialog.component.html',
  styleUrls: ['./msel-networks.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
    MatSelect,
    MatOption,
  ],
})
export class NetworkEditDialogComponent {
  readonly data = inject<NetworkEditDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<NetworkEditDialogComponent>);

  network: Network = {
    ...this.data.network,
    teamIds: [...(this.data.network.teamIds ?? [])],
    organizationIds: [...(this.data.network.organizationIds ?? [])],
  };

  // a field is invalid, so its mat-error shows, while its rule is broken
  readonly nameMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.nameProblem(),
  };
  readonly rangeMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.rangeProblem(),
  };

  nameProblem(): string | null {
    return nameProblem(
      this.network.name,
      this.network.id,
      this.data.networks,
      'network',
    );
  }

  rangeProblem(): string | null {
    return rangeProblem(this.network.range);
  }

  canSave(): boolean {
    return !this.nameProblem() && !this.rangeProblem();
  }

  save(): void {
    this.dialogRef.close({
      ...this.network,
      name: this.network.name?.trim(),
      range: textOrNull(this.network.range),
      purpose: textOrNull(this.network.purpose),
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
