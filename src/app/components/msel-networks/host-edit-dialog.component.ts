// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
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
import {
  Host,
  HostInterface,
  Network,
  Organization,
  Team,
} from 'src/app/generated/blueprint.api';
import {
  addressInRangeProblem,
  addressProblem,
  nameProblem,
  textOrNull,
} from './range-rules';

export interface HostEditDialogData {
  host: Host;
  hosts: Host[];
  networks: Network[];
  teams: Team[];
  organizations: Organization[];
}

/** Adds or edits one of a MSEL's hosts; closes with the host to save, or nothing */
@Component({
  selector: 'app-host-edit-dialog',
  templateUrl: './host-edit-dialog.component.html',
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
    MatButton,
    MatIconButton,
    MatIcon,
  ],
})
export class HostEditDialogComponent {
  readonly data = inject<HostEditDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<HostEditDialogComponent>);

  host: Host = {
    ...this.data.host,
    interfaces: (this.data.host.interfaces ?? []).map((i) => ({ ...i })),
    teamIds: [...(this.data.host.teamIds ?? [])],
    organizationIds: [...(this.data.host.organizationIds ?? [])],
  };

  /** An existing host on more than one network is one host, so an edit changes it under each */
  onSeveralNetworks(): boolean {
    return !!this.data.host.id && (this.data.host.interfaces?.length ?? 0) > 1;
  }

  interfaces(): HostInterface[] {
    return this.host.interfaces ?? [];
  }

  /** The first network the host has no interface on, which an added interface starts on */
  private unusedNetwork(): Network | undefined {
    return this.data.networks.find(
      (n) => !this.interfaces().some((i) => i.networkId === n.id),
    );
  }

  /** Whether the host can be put on another network: a host has one interface on each */
  canAddInterface(): boolean {
    return !!this.unusedNetwork();
  }

  addInterface(): void {
    const unused = this.unusedNetwork();
    if (unused) {
      this.host.interfaces = [
        ...this.interfaces(),
        { networkId: unused.id, address: null },
      ];
    }
  }

  /** Marks a field as invalid, so its mat-error shows, while its rule is broken */
  private invalidWhen(problem: () => string | null): ErrorStateMatcher {
    return {
      isErrorState: (control) =>
        !!problem() && !!(control?.touched || control?.dirty),
    };
  }

  readonly nameMatcher = this.invalidWhen(() => this.nameProblem());
  // one matcher per interface, so the bound object does not change on every check
  private readonly interfaceMatchers = new WeakMap<
    HostInterface,
    { network: ErrorStateMatcher; address: ErrorStateMatcher }
  >();

  /** The matchers of one interface's network and address fields */
  matchers(hostInterface: HostInterface): {
    network: ErrorStateMatcher;
    address: ErrorStateMatcher;
  } {
    let matchers = this.interfaceMatchers.get(hostInterface);
    if (!matchers) {
      matchers = {
        network: this.invalidWhen(() =>
          this.networkFieldProblem(hostInterface),
        ),
        address: this.invalidWhen(() =>
          this.addressFieldProblem(hostInterface),
        ),
      };
      this.interfaceMatchers.set(hostInterface, matchers);
    }

    return matchers;
  }

  removeInterface(index: number): void {
    this.host.interfaces = this.interfaces().filter((_, i) => i !== index);
  }

  networkName(networkId: string): string {
    return this.data.networks.find((n) => n.id === networkId)?.name ?? '';
  }

  nameProblem(): string | null {
    return nameProblem(this.host.name, this.host.id, this.data.hosts, 'host');
  }

  /** What is wrong with the interface's network choice, or null */
  networkFieldProblem(hostInterface: HostInterface): string | null {
    if (!hostInterface.networkId) {
      return 'Choose a network';
    }
    if (
      this.interfaces().filter((i) => i.networkId === hostInterface.networkId)
        .length > 1
    ) {
      return 'The host already has an interface on this network';
    }

    return null;
  }

  /** What is wrong with the interface's address, or null */
  addressFieldProblem(hostInterface: HostInterface): string | null {
    const range = this.data.networks.find(
      (n) => n.id === hostInterface.networkId,
    )?.range;

    return (
      addressProblem(hostInterface.address) ??
      addressInRangeProblem(hostInterface.address, range)
    );
  }

  interfaceProblem(hostInterface: HostInterface): string | null {
    return (
      this.networkFieldProblem(hostInterface) ??
      this.addressFieldProblem(hostInterface)
    );
  }

  canSave(): boolean {
    return (
      !this.nameProblem() &&
      this.interfaces().every((i) => !this.interfaceProblem(i))
    );
  }

  save(): void {
    this.dialogRef.close({
      ...this.host,
      name: this.host.name?.trim(),
      role: textOrNull(this.host.role),
      operatingSystem: textOrNull(this.host.operatingSystem),
      description: textOrNull(this.host.description),
      interfaces: this.interfaces().map((i) => ({
        networkId: i.networkId,
        address: textOrNull(i.address),
      })),
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
