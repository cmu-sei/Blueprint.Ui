// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Network } from 'src/app/generated/blueprint.api';
import { networkProblem, networksValid } from './network-list-edit.component';

describe('networkProblem', () => {
  const lan: Network = { name: 'lan', range: '10.20.0.0/24', hostCount: 4 };

  /**
   * Verifies: a named network with a CIDR range (IPv4 or IPv6), or no range, has no problem.
   * Data: lan 10.20.0.0/24; lan 2001:db8::/64; lan with no range.
   */
  it.each([
    lan,
    { name: 'lan', range: '2001:db8::/64' },
    { name: 'lan', range: null },
  ])('accepts $range', (network) => {
    expect(networkProblem(network, [network])).toBeNull();
  });

  /**
   * Verifies: each kind of problem a save would be refused for is named.
   * Data: no name, a range with no prefix, a range that is not an address, a negative host count.
   */
  it.each([
    [{ name: ' ' }, 'Name is required'],
    [{ name: 'lan', range: '10.20.0.0' }, 'Range must be CIDR notation'],
    [{ name: 'lan', range: 'office' }, 'Range must be CIDR notation'],
    [{ name: 'lan', hostCount: -1 }, 'Hosts cannot be negative'],
  ])('refuses %o', (network: Network, message) => {
    expect(networkProblem(network, [network])).toContain(message);
  });

  /**
   * Verifies: two networks of one name, whatever their case, are both refused.
   * Data: lan and LAN.
   */
  it('refuses a name used twice', () => {
    const networks = [lan, { name: 'LAN' }];

    expect(networkProblem(networks[1], networks)).toBe(
      'Another network has this name',
    );
    expect(networksValid(networks)).toBe(false);
  });

  /**
   * Verifies: no list, an empty list and a list of good networks are all valid.
   */
  it('treats no networks as valid', () => {
    expect(networksValid(null)).toBe(true);
    expect(networksValid([])).toBe(true);
    expect(networksValid([lan])).toBe(true);
  });
});
