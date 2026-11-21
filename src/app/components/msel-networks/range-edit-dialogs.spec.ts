// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  HostEditDialogComponent,
  HostEditDialogData,
} from './host-edit-dialog.component';
import {
  NetworkEditDialogComponent,
  NetworkEditDialogData,
} from './network-edit-dialog.component';
import { addressProblem, nameProblem, rangeProblem } from './range-rules';

const actions = () =>
  within(document.querySelector<HTMLElement>('mat-dialog-actions'));

async function renderDialog<T>(
  component: new (...args: never[]) => T,
  data: unknown,
) {
  const ref = dialogRefStub<T>();
  const rendered = await renderComponent(component, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  const close = ref.close;
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, close };
}

describe('range rules', () => {
  it.each([
    ['', 'Name is required'],
    ['LAN', 'already has a network'],
  ])('refuses the name %o', (name, message) => {
    expect(
      nameProblem(name, undefined, [{ id: 'n-1', name: 'lan' }], 'network'),
    ).toContain(message);
  });

  it('lets a network keep its own name', () => {
    expect(
      nameProblem('lan', 'n-1', [{ id: 'n-1', name: 'lan' }], 'network'),
    ).toBeNull();
  });

  it.each(['10.20.0.0', 'office', '10.20.0.0/24/8'])(
    'refuses the range %o',
    (range) => {
      expect(rangeProblem(range)).toContain('CIDR');
    },
  );

  it.each(['', '10.20.0.0/24', '2001:db8::/64'])(
    'accepts the range %o',
    (range) => {
      expect(rangeProblem(range)).toBeNull();
    },
  );

  it.each(['10.20.0.0/24', 'mail01'])('refuses the address %o', (address) => {
    expect(addressProblem(address)).toContain('single IP address');
  });
});

describe('NetworkEditDialogComponent', () => {
  const data = (): NetworkEditDialogData => ({
    network: { mselId: 'msel-1', name: '', teamIds: [], organizationIds: [] },
    networks: [{ id: 'n-1', name: 'lan' }],
    teams: [{ id: 't-blue', name: 'Blue Team' }],
    organizations: [{ id: 'o-bank', name: 'Meridian Bank' }],
  });

  /**
   * Verifies: Save stays disabled for a name another network has, and the dialog says why.
   */
  it('disables Save for a name the MSEL already has', async () => {
    await renderDialog(NetworkEditDialogComponent, data());
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Name/), 'LAN');

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByText('The MSEL already has a network with this name'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Save closes the dialog with the network, its text trimmed and an empty range as none.
   */
  it('closes with the trimmed network on Save', async () => {
    const { close } = await renderDialog(NetworkEditDialogComponent, data());
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Name/), ' wan ');
    await user.type(screen.getByLabelText('Purpose'), ' Internet edge ');
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        mselId: 'msel-1',
        name: 'wan',
        range: null,
        purpose: 'Internet edge',
      }),
    );
  });
});

describe('HostEditDialogComponent', () => {
  const data = (): HostEditDialogData => ({
    host: {
      mselId: 'msel-1',
      name: '',
      count: 1,
      interfaces: [],
      teamIds: [],
      organizationIds: [],
    },
    hosts: [],
    networks: [
      { id: 'n-lan', name: 'bank-lan', range: '10.20.0.0/24' },
      { id: 'n-dmz', name: 'bank-dmz' },
    ],
    teams: [],
    organizations: [],
  });

  /**
   * Verifies: Add Interface puts the host on the first network it isn't on yet, and Save closes with the interfaces and count.
   */
  it('adds interfaces on networks the host is not on yet', async () => {
    const { close } = await renderDialog(HostEditDialogComponent, data());
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Name/), 'fw01');
    await user.click(screen.getByRole('button', { name: /Add Interface/ }));
    await user.click(screen.getByRole('button', { name: /Add Interface/ }));
    const addresses = screen.getAllByLabelText('Address');
    await user.type(addresses[0], '10.20.0.1');
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'fw01',
        count: 1,
        interfaces: [
          { networkId: 'n-lan', address: '10.20.0.1' },
          { networkId: 'n-dmz', address: null },
        ],
      }),
    );
  });

  /**
   * Verifies: Save stays disabled for an address that isn't a single IP address, and for a count below 1.
   */
  it('disables Save for a bad address or count', async () => {
    await renderDialog(HostEditDialogComponent, data());
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Name/), 'ws');
    await user.click(screen.getByRole('button', { name: /Add Interface/ }));
    await user.type(screen.getByLabelText('Address'), '10.20.0.0/24');

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(/single IP address/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Address'));
    await user.clear(screen.getByLabelText('Count'));
    await user.type(screen.getByLabelText('Count'), '0');

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: with no networks on the MSEL, the dialog says to add one instead of offering an interface.
   */
  it('asks for a network first when the MSEL has none', async () => {
    await renderDialog(HostEditDialogComponent, { ...data(), networks: [] });

    expect(screen.queryByRole('button', { name: /Add Interface/ })).toBeNull();
    expect(
      screen.getByText('Add a network first to put the host on it.'),
    ).toBeInTheDocument();
  });
});
