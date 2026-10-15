/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { DataField, DataFieldType, DataValue } from 'src/app/generated/blueprint.api';

interface ParsedAddress {
  version: 4 | 6;
  bits: bigint;
}

interface ParsedNetwork extends ParsedAddress {
  prefix: number;
}

function parseIpv4(text: string): bigint | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let bits = 0n;
  for (const part of parts) {
    // no leading zeros, since 010 is octal to some tools and decimal to others
    if (!/^(0|[1-9]\d{0,2})$/.test(part) || +part > 255) return null;
    bits = (bits << 8n) | BigInt(part);
  }
  return bits;
}

function parseIpv6(text: string): bigint | null {
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (half: string): string[] | null => {
    if (!half) return [];
    const groups = half.split(':');
    const last = groups[groups.length - 1];
    // an embedded IPv4 address (::ffff:192.0.2.1) fills the last two groups
    if (last.includes('.')) {
      const v4 = parseIpv4(last);
      if (v4 === null) return null;
      groups.splice(-1, 1, (v4 >> 16n).toString(16), (v4 & 0xffffn).toString(16));
    }
    return groups.every(g => /^[0-9a-f]{1,4}$/i.test(g)) ? groups : null;
  };
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || tail === null) return null;
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + tail.length > 7) return null;
  const groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
  return groups.reduce((bits, g) => (bits << 16n) | BigInt(parseInt(g, 16)), 0n);
}

function parseAddress(text: string): ParsedAddress | null {
  const v4 = parseIpv4(text);
  if (v4 !== null) return { version: 4, bits: v4 };
  const v6 = text.includes(':') ? parseIpv6(text) : null;
  return v6 !== null ? { version: 6, bits: v6 } : null;
}

function parseNetwork(text: string): ParsedNetwork | null {
  const match = /^([^/]+)\/(\d{1,3})$/.exec(text);
  const address = match ? parseAddress(match[1]) : null;
  if (!address) return null;
  const prefix = +match[2];
  return prefix <= (address.version === 4 ? 32 : 128) ? { ...address, prefix } : null;
}

function width(version: 4 | 6): bigint {
  return version === 4 ? 32n : 128n;
}

function formatAddress(address: ParsedAddress): string {
  if (address.version === 4) {
    return [24n, 16n, 8n, 0n].map(shift => ((address.bits >> shift) & 0xffn).toString()).join('.');
  }
  const groups = [...Array(8)].map((_, i) => ((address.bits >> BigInt(112 - i * 16)) & 0xffffn).toString(16));
  // shorten the longest run of two or more zero groups to ::
  let best = { start: -1, length: 1 };
  for (let i = 0; i < 8; i++) {
    let j = i;
    while (j < 8 && groups[j] === '0') j++;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = j;
  }
  if (best.start < 0) return groups.join(':');
  return groups.slice(0, best.start).join(':') + '::' + groups.slice(best.start + best.length).join(':');
}

// '' when the value is empty or a single IPv4 or IPv6 address
export function ipAddressError(value: string): string {
  const text = (value || '').trim();
  if (!text || parseAddress(text)) return '';
  if (parseNetwork(text)) return 'Enter a single address, without a prefix length. Use a Network field for a CIDR block.';
  return 'Enter an IPv4 or IPv6 address, for example 192.0.2.10 or 2001:db8::10.';
}

// '' when the value is empty or a CIDR block with no host bits set
export function networkError(value: string): string {
  const text = (value || '').trim();
  if (!text) return '';
  const network = parseNetwork(text);
  if (!network) {
    return parseAddress(text)
      ? 'Add a prefix length, for example 10.1.0.0/24.'
      : 'Enter a network in CIDR form, for example 10.1.0.0/24 or 2001:db8::/48.';
  }
  const hostBits = width(network.version) - BigInt(network.prefix);
  const base = (network.bits >> hostBits) << hostBits;
  if (base !== network.bits) {
    return `The address has host bits set for /${network.prefix}. Did you mean ${formatAddress({ ...network, bits: base })}/${network.prefix}?`;
  }
  return '';
}

export function dataValueError(dataType: DataFieldType, value: string): string {
  switch (dataType) {
    case DataFieldType.IpAddress:
      return ipAddressError(value);
    case DataFieldType.Network:
      return networkError(value);
    default:
      return '';
  }
}

// A key that sorts addresses numerically as plain strings: IPv4 before IPv6,
// then by address, then by prefix length. Values that don't parse sort last, as typed.
export function ipSortKey(value: string): string {
  const text = (value || '').trim();
  if (!text) return '';
  const parsed: ParsedNetwork | null = text.includes('/')
    ? parseNetwork(text)
    : (() => {
        const address = parseAddress(text);
        return address ? { ...address, prefix: Number(width(address.version)) } : null;
      })();
  if (!parsed) return 'z ' + text;
  return parsed.version + parsed.bits.toString(16).padStart(32, '0') + parsed.prefix.toString().padStart(3, '0');
}

// true when any typed IP address or network value would not pass its field's check;
// values chosen from an option list are left alone, since the planner set the options
export function hasInvalidAddress(dataFields: DataField[], dataValues: DataValue[]): boolean {
  return (dataFields || []).some(df => !df.isChosenFromList &&
    (dataValues || []).some(dv => dv.dataFieldId === df.id && !!dataValueError(df.dataType, dv.value))
  );
}
