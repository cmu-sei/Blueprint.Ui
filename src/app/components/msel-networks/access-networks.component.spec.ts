// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { Network, NetworkService } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AccessNetworksComponent } from './access-networks.component';

const NETWORKS: Network[] = [
  {
    id: 'n-lan',
    mselId: 'm',
    name: 'bank-lan',
    range: '10.20.0.0/24',
    teamIds: ['t-blue'],
  },
  { id: 'n-dmz', mselId: 'm', name: 'bank-dmz', teamIds: [] },
];

async function render(getNetworksByMsel: () => unknown) {
  const rendered = await renderComponent(AccessNetworksComponent, {
    providers: [{ provide: NetworkService, useValue: { getNetworksByMsel } }],
    inputs: { kind: 'team', ownerId: 't-blue', mselId: 'm' },
  });
  rendered.fixture.detectChanges();
  return rendered;
}

describe('AccessNetworksComponent', () => {
  /**
   * Verifies: only the networks the team has access to are listed, with their range.
   * Data: bank-lan is open to t-blue, bank-dmz to no team.
   */
  it('lists the networks the owner has access to', async () => {
    await render(vi.fn(() => of(NETWORKS)));

    expect(screen.getByText('bank-lan')).toBeInTheDocument();
    expect(screen.getByText('10.20.0.0/24')).toBeInTheDocument();
    expect(screen.queryByText('bank-dmz')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /**
   * Verifies: a failed load is said, so it is not mistaken for the owner having no networks.
   */
  it('says when the networks could not be loaded', async () => {
    await render(vi.fn(() => throwError(() => new Error('down'))));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The networks with access could not be loaded.',
    );
    expect(screen.queryByText('Networks with access')).toBeNull();
  });
});
