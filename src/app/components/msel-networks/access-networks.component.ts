// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Network, NetworkService } from 'src/app/generated/blueprint.api';

/**
 * The networks a team or an organization has access to, read-only, for its edit dialog. Access is set on the
 * network, so changing it is done on the Networks tab. Nothing shows when there are none, and a failure to load
 * them is said, so it is not mistaken for there being none.
 */
@Component({
  selector: 'app-access-networks',
  template: `
    @if (failed()) {
      <p class="access-hint" role="alert">
        The networks with access could not be loaded.
      </p>
    }
    @if (networks().length) {
      <div class="access-networks">
        <p class="access-label">Networks with access</p>
        <ul>
          @for (network of networks(); track network.id) {
            <li>
              {{ network.name }}
              @if (network.range) {
                <span class="access-range">{{ network.range }}</span>
              }
            </li>
          }
        </ul>
        <p class="access-hint">
          To change which networks it has access to, use the Networks tab.
        </p>
      </div>
    }
  `,
  styles: `
    .access-networks {
      margin: 8px 0;
    }
    .access-label {
      margin: 0;
      font-size: 13px;
    }
    ul {
      margin: 4px 0;
      padding-left: 20px;
    }
    .access-range {
      margin-left: 8px;
      font-family: monospace;
      opacity: 0.75;
    }
    .access-hint {
      margin: 0;
      font-size: 12px;
      opacity: 0.75;
    }
  `,
})
export class AccessNetworksComponent implements OnInit {
  readonly kind = input.required<'team' | 'organization'>();
  /** The team's or organization's id; a new one has none, and so has no networks */
  readonly ownerId = input<string | null | undefined>();
  /** The MSEL the networks belong to */
  readonly mselId = input<string | null | undefined>();

  private networkService = inject(NetworkService);

  readonly networks = signal<Network[]>([]);
  readonly failed = signal(false);

  ngOnInit(): void {
    const mselId = this.mselId();
    const ownerId = this.ownerId();
    if (!mselId || !ownerId) {
      return;
    }
    this.networkService.getNetworksByMsel(mselId).subscribe({
      next: (networks) =>
        this.networks.set(
          networks
            .filter((n) =>
              (this.kind() === 'team'
                ? n.teamIds
                : n.organizationIds
              )?.includes(ownerId),
            )
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        ),
      // a list that only informs does not stop the dialog, but it says it could not load
      error: () => {
        this.networks.set([]);
        this.failed.set(true);
      },
    });
  }
}
