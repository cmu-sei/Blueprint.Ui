// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselStore } from 'src/app/data/msel/msel.store';
import { OrganizationStore } from 'src/app/data/organization/organization.store';
import { TeamStore } from 'src/app/data/team/team.store';
import {
  Host,
  HostService,
  Network,
  NetworkService,
} from 'src/app/generated/blueprint.api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselNetworksComponent } from './msel-networks.component';

const NETWORKS: Network[] = [
  {
    id: 'n-dmz',
    mselId: 'msel-1',
    name: 'bank-dmz',
    range: '10.20.9.0/28',
    teamIds: [],
    organizationIds: ['o-bank'],
  },
  {
    id: 'n-lan',
    mselId: 'msel-1',
    name: 'bank-lan',
    range: '10.20.0.0/24',
    purpose: 'Office LAN',
    teamIds: ['t-blue'],
    organizationIds: [],
  },
];
const HOSTS: Host[] = [
  {
    id: 'h-ws',
    mselId: 'msel-1',
    name: 'ws',
    count: 40,
    role: 'Workstation',
    interfaces: [{ networkId: 'n-lan', address: null }],
    teamIds: ['t-blue'],
    organizationIds: [],
  },
  {
    id: 'h-fw',
    mselId: 'msel-1',
    name: 'fw01',
    count: 1,
    role: 'Firewall',
    interfaces: [
      { networkId: 'n-lan', address: '10.20.0.1' },
      { networkId: 'n-dmz', address: '10.20.9.1' },
    ],
    teamIds: [],
    organizationIds: ['o-bank'],
  },
];

async function renderNetworks(
  options: { canEdit?: boolean; dialogResult?: unknown } = {},
) {
  const networkApi = {
    getNetworksByMsel: vi.fn(() => of(structuredClone(NETWORKS))),
    createNetwork: vi.fn((n: Network) => of({ ...n, id: 'n-new' })),
    updateNetwork: vi.fn((_id: string, n: Network) => of(n)),
    deleteNetwork: vi.fn(() => of<unknown>(null)),
  };
  const hostApi = {
    getHostsByMsel: vi.fn(() => of(structuredClone(HOSTS))),
    createHost: vi.fn((h: Host) => of({ ...h, id: 'h-new' })),
    updateHost: vi.fn((_id: string, h: Host) => of(h)),
    deleteHost: vi.fn(() => of<unknown>(null)),
  };
  const open = vi.fn(
    () => dialogRefStub<unknown, unknown>(options.dialogResult).dialogRef,
  );
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const rendered = await renderComponent(MselNetworksComponent, {
    providers: [
      { provide: NetworkService, useValue: networkApi },
      { provide: HostService, useValue: hostApi },
      { provide: MatDialog, useValue: { open } },
      { provide: CrucibleDialogService, useValue: { confirm } },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([{ id: 'msel-1', name: 'MSEL' }]);
          store.setActive('msel-1');
          return store;
        },
      },
      {
        provide: TeamStore,
        useFactory: () => {
          const store = new TeamStore();
          store.set([
            { id: 't-blue', mselId: 'msel-1', name: 'Blue Team' },
            { id: 't-other', mselId: 'msel-2', name: 'Other MSEL Team' },
          ]);
          return store;
        },
      },
      {
        provide: OrganizationStore,
        useFactory: () => {
          const store = new OrganizationStore();
          store.set([
            { id: 'o-bank', mselId: 'msel-1', name: 'Meridian Bank' },
            { id: 'o-template', mselId: null, name: 'A Template' },
          ]);
          return store;
        },
      },
    ],
    inputs: { canEdit: options.canEdit ?? true },
  });
  rendered.fixture.detectChanges();
  return { ...rendered, networkApi, hostApi, open, confirm };
}

// the first cell of each row is its name, so a row is found by the cell that starts it
const rowOf = (name: string) =>
  screen
    .getAllByText(name, { selector: 'td' })
    .find((cell) => cell === cell.parentElement?.firstElementChild)
    ?.closest('tr') as HTMLElement;

describe('MselNetworksComponent', () => {
  /**
   * Verifies: the networks list their range, the hosts on them (counting each row's count), the teams that defend them ("Shared" for none) and the organizations they belong to.
   * Interacts with: getNetworksByMsel, getHostsByMsel, TeamStore, OrganizationStore.
   * Data: bank-lan defended by Blue Team with ws x 40 and fw01 on it; bank-dmz belonging to Meridian Bank with fw01 on it.
   */
  it('lists the networks with their hosts and links', async () => {
    const { networkApi } = await renderNetworks();

    expect(networkApi.getNetworksByMsel).toHaveBeenCalledWith('msel-1');
    const lan = rowOf('bank-lan');
    expect(lan).toHaveTextContent('10.20.0.0/24');
    expect(lan).toHaveTextContent('Office LAN');
    expect(lan).toHaveTextContent('41');
    expect(lan).toHaveTextContent('Blue Team');
    const dmz = rowOf('bank-dmz');
    expect(dmz).toHaveTextContent('Shared');
    expect(dmz).toHaveTextContent('Meridian Bank');
  });

  /**
   * Verifies: a host lists its count and each interface as network and address.
   * Data: fw01 on bank-lan 10.20.0.1 and bank-dmz 10.20.9.1; ws x 40 on bank-lan with no address.
   */
  it('lists the hosts with their interfaces', async () => {
    await renderNetworks();

    expect(rowOf('fw01')).toHaveTextContent(
      'bank-dmz 10.20.9.1, bank-lan 10.20.0.1',
    );
    expect(rowOf('ws')).toHaveTextContent('40');
    expect(rowOf('ws')).toHaveTextContent('bank-lan');
  });

  /**
   * Verifies: a caller who can't edit the MSEL sees no add, edit or delete buttons.
   */
  it('shows no editing buttons without canEdit', async () => {
    await renderNetworks({ canEdit: false });

    expect(screen.queryByRole('button', { name: 'Add a network' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Delete network bank-lan' }),
    ).toBeNull();
  });

  /**
   * Verifies: Add a network opens the dialog with only this MSEL's teams and organizations, and saves what it returns, then reloads.
   * Interacts with: MatDialog.open, createNetwork, getNetworksByMsel.
   * Data: the dialog returns network wan.
   */
  it('creates the network the dialog returns', async () => {
    const { open, networkApi } = await renderNetworks({
      dialogResult: { mselId: 'msel-1', name: 'wan' },
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add a network' }));

    const data = (open.mock.calls[0] as unknown[])[1] as {
      data: { teams: { id: string }[]; organizations: { id: string }[] };
    };
    expect(data.data.teams.map((t) => t.id)).toEqual(['t-blue']);
    expect(data.data.organizations.map((o) => o.id)).toEqual(['o-bank']);
    expect(networkApi.createNetwork).toHaveBeenCalledWith({
      mselId: 'msel-1',
      name: 'wan',
    });
    expect(networkApi.getNetworksByMsel).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: editing a host saves it with updateHost.
   * Data: the dialog returns fw01 renamed fw02.
   */
  it('updates the host the dialog returns', async () => {
    const { hostApi } = await renderNetworks({
      dialogResult: { ...HOSTS[1], name: 'fw02' },
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit host fw01' }));

    expect(hostApi.updateHost).toHaveBeenCalledWith(
      'h-fw',
      expect.objectContaining({ name: 'fw02' }),
    );
  });

  /**
   * Verifies: a dismissed dialog saves nothing.
   */
  it('saves nothing when the dialog is dismissed', async () => {
    const { networkApi } = await renderNetworks({ dialogResult: undefined });
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit network bank-lan' }),
    );

    expect(networkApi.updateNetwork).not.toHaveBeenCalled();
  });

  /**
   * Verifies: deleting a network asks first, says hosts on it keep their other interfaces, and deletes it.
   * Data: bank-dmz, which fw01 is on.
   */
  it('deletes a network after confirming', async () => {
    const { confirm, networkApi } = await renderNetworks();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Delete network bank-dmz' }),
    );

    const options = (confirm.mock.calls[0] as unknown[])[0] as {
      message: string;
    };
    expect(options.message).toContain('bank-dmz');
    expect(options.message).toContain('keeps its other interfaces');
    expect(networkApi.deleteNetwork).toHaveBeenCalledWith('n-dmz');
  });
});
