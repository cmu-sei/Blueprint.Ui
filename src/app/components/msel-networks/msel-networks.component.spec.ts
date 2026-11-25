// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
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
    role: 'Workstation',
    interfaces: [{ networkId: 'n-lan', address: null }],
    teamIds: ['t-blue'],
    organizationIds: [],
  },
  {
    id: 'h-fw',
    mselId: 'msel-1',
    name: 'fw01',
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
  options: { canEdit?: boolean; dialogResult?: unknown; hosts?: Host[] } = {},
) {
  const networkApi = {
    getNetworksByMsel: vi.fn(() => of(structuredClone(NETWORKS))),
    createNetwork: vi.fn((n: Network) => of({ ...n, id: 'n-new' })),
    updateNetwork: vi.fn((_id: string, n: Network) => of(n)),
    deleteNetwork: vi.fn(() => of<unknown>(null)),
  };
  const hostApi = {
    getHostsByMsel: vi.fn(() => of(structuredClone(options.hosts ?? HOSTS))),
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
            {
              id: 't-blue',
              mselId: 'msel-1',
              name: 'Blue Team',
              domain: 'blue.example',
            },
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
            {
              id: 'o-bank',
              mselId: 'msel-1',
              name: 'Meridian Bank',
              domain: 'meridian-bank.com',
            },
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

// a row is found by its Name cell
const rowOf = (name: string) =>
  screen
    .getAllByText(name, { selector: 'td.column-name' })[0]
    .closest('tr') as HTMLElement;

describe('MselNetworksComponent', () => {
  /**
   * Verifies: the networks list their range, the number of hosts on them, the teams with access ("Shared" for none) and the organizations with access.
   * Interacts with: getNetworksByMsel, getHostsByMsel, TeamStore, OrganizationStore.
   * Data: bank-lan open to Blue Team with ws and fw01 on it; bank-dmz open to Meridian Bank with fw01 on it.
   */
  it('lists the networks with their hosts and links', async () => {
    const { networkApi } = await renderNetworks();

    expect(networkApi.getNetworksByMsel).toHaveBeenCalledWith('msel-1');
    const lan = rowOf('bank-lan');
    expect(lan).toHaveTextContent('10.20.0.0/24');
    expect(lan).toHaveTextContent('Office LAN');
    expect(lan).toHaveTextContent('2');
    expect(lan).toHaveTextContent('Blue Team');
    const dmz = rowOf('bank-dmz');
    expect(dmz).toHaveTextContent('Shared');
    expect(dmz).toHaveTextContent('Meridian Bank');
    // the domains of the teams and organizations with access, none when neither has one
    expect(lan).toHaveTextContent('blue.example');
    expect(dmz).toHaveTextContent('meridian-bank.com');
    expect(
      screen.getAllByRole('columnheader', { name: 'Teams with access' }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('columnheader', { name: 'Organizations with access' }),
    ).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Domains' })).toBeTruthy();
    expect(screen.queryByText('Defended by')).toBeNull();
    expect(screen.queryByText('Belongs to')).toBeNull();
  });

  /**
   * Verifies: searching the networks keeps the rows that match, as on the other tabs.
   * Data: bank-lan (Office LAN) and bank-dmz.
   */
  it('searches the networks', async () => {
    await renderNetworks();
    const user = userEvent.setup();

    await user.type(
      screen.getByRole('textbox', { name: 'Search networks' }),
      'office',
    );

    expect(rowOf('bank-lan')).toBeTruthy();
    expect(
      screen.queryByText('bank-dmz', { selector: 'td.column-name' }),
    ).toBeNull();
  });

  /**
   * Verifies: hosts are only listed under a network, so the tab has no Hosts table, and no row for hosts on no network while every host is on one.
   */
  it('has no Hosts table and no row for hosts on no network when every host is on one', async () => {
    await renderNetworks();

    expect(screen.queryByRole('table', { name: 'Hosts' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Search hosts' })).toBeNull();
    expect(
      screen.queryByText('Hosts on no network', { selector: 'td.column-name' }),
    ).toBeNull();
  });

  /**
   * Verifies: a host on no network gets a last row, "Hosts on no network", that opens to the host with edit and delete, and no add or network buttons.
   * Data: the hosts fw01 and ws, and spare with no interfaces.
   */
  it('lists the hosts on no network in a last row', async () => {
    const spare: Host = {
      id: 'h-spare',
      mselId: 'msel-1',
      name: 'spare',
      role: 'Server',
      interfaces: [],
      teamIds: [],
      organizationIds: [],
    };
    const { hostApi } = await renderNetworks({ hosts: [...HOSTS, spare] });
    const user = userEvent.setup();

    const row = rowOf('Hosts on no network');
    const rows = screen.getAllByRole('row').filter((r) => r.matches('.element-row'));
    expect(rows[rows.length - 1]).toBe(row);
    expect(row).toHaveTextContent('1');
    expect(
      screen.queryByRole('button', {
        name: /(Edit|Delete|Add a host to) network Hosts on no network/,
      }),
    ).toBeNull();

    await user.click(rowOf('Hosts on no network'));
    const list = screen.getByRole('table', { name: 'Hosts on Hosts on no network' });
    expect(list).toHaveTextContent('spare');
    await user.click(
      within(list).getByRole('button', {
        name: 'Delete host spare on Hosts on no network',
      }),
    );
    expect(hostApi.deleteHost).toHaveBeenCalledWith('h-spare');
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

    await user.click(rowOf('bank-dmz'));
    await user.click(
      screen.getByRole('button', { name: 'Edit host fw01 on bank-dmz' }),
    );

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

  /**
   * Verifies: a network's hosts are hidden until its row is clicked open, then listed with role, operating system and the address on that network.
   * Data: bank-lan with ws (no address) and fw01 at 10.20.0.1.
   */
  it("lists a network's hosts when its row is expanded", async () => {
    await renderNetworks();
    const user = userEvent.setup();
    expect(rowOf('bank-lan')).not.toHaveClass('element-row-expanded');
    expect(
      screen.queryByRole('table', { name: 'Hosts on bank-lan' }),
    ).toBeNull();

    await user.click(rowOf('bank-lan'));

    expect(rowOf('bank-lan')).toHaveClass('element-row-expanded');
    const list = screen.getByRole('table', { name: 'Hosts on bank-lan' });
    const rows = within(list).getAllByRole('row');
    // the header, then the hosts by name
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('fw01');
    expect(rows[1]).toHaveTextContent('Firewall');
    expect(rows[1]).toHaveTextContent('10.20.0.1');
    expect(rows[2]).toHaveTextContent('ws');
    expect(rows[2]).toHaveTextContent('Workstation');
  });

  /**
   * Verifies: a host on two networks is listed under each, with its address on that one, and the row collapses again.
   * Data: fw01 on bank-lan 10.20.0.1 and bank-dmz 10.20.9.1.
   */
  it('lists a host under each network it is on', async () => {
    await renderNetworks();
    const user = userEvent.setup();

    await user.click(rowOf('bank-lan'));
    await user.click(rowOf('bank-dmz'));

    const dmz = screen.getByRole('table', { name: 'Hosts on bank-dmz' });
    expect(within(dmz).getAllByRole('row')).toHaveLength(2);
    expect(dmz).toHaveTextContent('fw01');
    expect(dmz).toHaveTextContent('10.20.9.1');
    expect(dmz).not.toHaveTextContent('ws');

    await user.click(rowOf('bank-dmz'));
    expect(rowOf('bank-dmz')).not.toHaveClass('element-row-expanded');
    expect(
      screen.queryByRole('table', { name: 'Hosts on bank-dmz' }),
    ).toBeNull();
    expect(
      screen.getByRole('table', { name: 'Hosts on bank-lan' }),
    ).toBeTruthy();
  });

  /**
   * Verifies: a network with no hosts says so when expanded.
   */
  it('says when an expanded network has no hosts', async () => {
    await renderNetworks({ hosts: [] });
    const user = userEvent.setup();
    await user.click(rowOf('bank-dmz'));
    expect(screen.getByText('No hosts on this network.')).toBeTruthy();
  });

  /**
   * Verifies: editing and deleting a host from under a network use the host dialog and API.
   * Data: fw01 under bank-dmz; the dialog returns it renamed.
   */
  it('edits and deletes a host from under its network', async () => {
    const { hostApi, confirm } = await renderNetworks({
      dialogResult: { ...HOSTS[1], name: 'fw02' },
    });
    const user = userEvent.setup();
    await user.click(rowOf('bank-dmz'));

    await user.click(
      screen.getByRole('button', { name: 'Edit host fw01 on bank-dmz' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete host fw01 on bank-dmz' }),
    );

    expect(hostApi.updateHost).toHaveBeenCalledWith(
      'h-fw',
      expect.objectContaining({ name: 'fw02' }),
    );
    expect(confirm).toHaveBeenCalled();
    expect(hostApi.deleteHost).toHaveBeenCalledWith('h-fw');
  });

  /**
   * Verifies: Add a host on a network row opens the host dialog with that network already an interface, and saves the host it returns.
   * Data: bank-dmz; the dialog returns host dns.
   */
  it('adds a host on a network with that network preselected', async () => {
    const { open, hostApi } = await renderNetworks({
      dialogResult: { mselId: 'msel-1', name: 'dns' },
    });
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Add a host to network bank-dmz' }),
    );

    const dialog = (open.mock.calls[0] as unknown[])[1] as {
      data: { host: Host };
    };
    expect(dialog.data.host.id).toBeUndefined();
    expect(dialog.data.host.interfaces).toEqual([
      { networkId: 'n-dmz', address: null },
    ]);
    expect(hostApi.createHost).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dns' }),
    );
  });

  /**
   * Verifies: without canEdit the expanded hosts have no add, edit or delete buttons.
   */
  it('shows no host buttons under a network without canEdit', async () => {
    await renderNetworks({ canEdit: false });
    const user = userEvent.setup();
    await user.click(rowOf('bank-lan'));

    expect(
      screen.queryByRole('button', { name: /Add a host to network/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Edit host fw01 on/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Delete host fw01 on/ }),
    ).toBeNull();
  });

  /**
   * Verifies: hosts are added from a network row; the tab has no Add a host button of its own.
   */
  it('adds hosts only from the network rows', async () => {
    await renderNetworks();

    expect(screen.queryByRole('button', { name: 'Add a host' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add a host to network bank-lan' }),
    ).toBeTruthy();
  });

  /**
   * Verifies: a network open to teams and organizations lists their domains, sorted, and one open to none has a blank Domains cell.
   * Data: Blue Team (blue.example) and Meridian Bank (meridian-bank.com).
   */
  it('lists the domains of those with access, blank when none', async () => {
    const { fixture } = await renderNetworks();
    const component = fixture.componentInstance;
    expect(
      component.domains({
        id: 'x',
        teamIds: ['t-blue'],
        organizationIds: ['o-bank'],
      } as Network),
    ).toBe('blue.example, meridian-bank.com');
    expect(
      component.domains({ id: 'y', teamIds: [], organizationIds: [] } as Network),
    ).toBe('');
  });

  /**
   * Verifies: the hosts under a network are sorted by name until a column header is clicked; each sortable column sorts them, Address by its text, and a second click reverses.
   * Data: bank-lan with fw01 (10.20.0.1, Firewall) and ws (no address, Workstation).
   */
  it('sorts the hosts under a network by each column', async () => {
    await renderNetworks();
    const user = userEvent.setup();
    await user.click(rowOf('bank-lan'));
    const list = () => screen.getByRole('table', { name: 'Hosts on bank-lan' });
    const names = () =>
      within(list())
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelector('td.column-name')?.textContent?.trim());
    const header = (name: string) =>
      within(list()).getByRole('columnheader', { name });

    // by name to begin with
    expect(names()).toEqual(['fw01', 'ws']);

    await user.click(header('Role'));
    expect(names()).toEqual(['fw01', 'ws']);

    // the address text: ws has none, so it comes first
    await user.click(header('Address'));
    expect(names()).toEqual(['ws', 'fw01']);
    await user.click(header('Address'));
    expect(names()).toEqual(['fw01', 'ws']);

    await user.click(header('Host'));
    expect(names()).toEqual(['fw01', 'ws']);
    await user.click(header('Host'));
    expect(names()).toEqual(['ws', 'fw01']);
    expect(header('Operating System')).toBeTruthy();
  });

  /**
   * Verifies: the sort is kept for each network on its own.
   * Data: bank-lan sorted by name descending; bank-dmz left in its default order.
   */
  it('keeps a sort for each network', async () => {
    await renderNetworks();
    const user = userEvent.setup();
    await user.click(rowOf('bank-lan'));
    await user.click(rowOf('bank-dmz'));
    const lan = screen.getByRole('table', { name: 'Hosts on bank-lan' });

    await user.click(within(lan).getByRole('columnheader', { name: 'Host' }));
    await user.click(within(lan).getByRole('columnheader', { name: 'Host' }));

    const first = (table: HTMLElement) =>
      within(table).getAllByRole('row')[1].querySelector('td.column-name')
        ?.textContent?.trim();
    expect(first(lan)).toBe('ws');
    expect(
      first(screen.getByRole('table', { name: 'Hosts on bank-dmz' })),
    ).toBe('fw01');
  });
});
