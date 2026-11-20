// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  MatError,
  MatFormField,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { Network } from 'src/app/generated/blueprint.api';

// an address, a slash and a prefix length; the API checks the address and the length
const CIDR = /^[0-9a-fA-F:.]+\/\d{1,3}$/;

/** Why a network can't be saved as it is, or null when it can */
export function networkProblem(
  network: Network,
  networks: Network[],
): string | null {
  const name = network.name?.trim() ?? '';
  if (!name) {
    return 'Name is required';
  }
  if (
    networks.filter((n) => n.name?.trim().toLowerCase() === name.toLowerCase())
      .length > 1
  ) {
    return 'Another network has this name';
  }
  const range = network.range?.trim() ?? '';
  if (range && !CIDR.test(range)) {
    return 'Range must be CIDR notation, such as 10.20.0.0/24';
  }
  if (network.hostCount != null && network.hostCount < 0) {
    return 'Hosts cannot be negative';
  }

  return null;
}

/** Whether every network in the list can be saved */
export function networksValid(networks: Network[] | null | undefined): boolean {
  return (networks ?? []).every((n) => !networkProblem(n, networks ?? []));
}

/**
 * Edits the list of networks a team or an organization has: each with a name,
 * a range, a purpose and a host count. Works on its own copy of the list and
 * hands back a new list on each change.
 */
@Component({
  selector: 'app-network-list-edit',
  templateUrl: './network-list-edit.component.html',
  styleUrls: ['./network-list-edit.component.scss'],
  imports: [
    FormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatButton,
    MatIconButton,
    MatIcon,
  ],
})
export class NetworkListEditComponent {
  readonly networks = model<Network[] | null | undefined>([]);

  rows(): Network[] {
    return this.networks() ?? [];
  }

  problem(network: Network): string | null {
    return networkProblem(network, this.rows());
  }

  add(): void {
    this.networks.set([
      ...this.rows(),
      { name: '', range: null, purpose: null, hostCount: null },
    ]);
  }

  remove(index: number): void {
    this.networks.set(this.rows().filter((_, i) => i !== index));
  }

  change(index: number, field: keyof Network, value: string): void {
    const text = value?.toString() ?? '';
    const row: Network = { ...this.rows()[index] };
    if (field === 'hostCount') {
      row.hostCount =
        text.trim() === '' || isNaN(Number(text))
          ? null
          : Math.trunc(Number(text));
    } else if (field === 'name') {
      row.name = text.trim();
    } else if (field === 'range' || field === 'purpose') {
      row[field] = text.trim() || null;
    }
    this.networks.set(this.rows().map((n, i) => (i === index ? row : n)));
  }
}
