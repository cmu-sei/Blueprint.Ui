// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// The checks the Networks tab makes before it saves: names, CIDR ranges, IP addresses and an address inside
// its network's range. The API makes the same checks and says what is wrong when it refuses a save.

// no leading zeros: the API reads 010 as octal, so the same text would mean two addresses
const OCTET = '(0|[1-9]\\d{0,2})';
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

/** The address as a number and its bit length (32 or 128), or null when it is not an IP address */
function parseAddress(text: string): { value: bigint; bits: number } | null {
  const v4 = IPV4.exec(text);
  if (v4) {
    const octets = v4.slice(1).map(Number);

    return octets.every((o) => o <= 255)
      ? { value: octets.reduce((n, o) => (n << 8n) | BigInt(o), 0n), bits: 32 }
      : null;
  }
  if (!/^[0-9a-fA-F:.]+$/.test(text) || !text.includes(':')) {
    return null;
  }
  // an IPv6 address may end in an IPv4 address, which stands for two groups
  let groups = text;
  const tail = text.slice(text.lastIndexOf(':') + 1);
  if (tail.includes('.')) {
    const embedded = parseAddress(tail);
    if (embedded?.bits !== 32) {
      return null;
    }
    const high = ((embedded.value >> 16n) & 0xffffn).toString(16);
    const low = (embedded.value & 0xffffn).toString(16);
    groups = `${text.slice(0, text.lastIndexOf(':') + 1)}${high}:${low}`;
  }
  const halves = groups.split('::');
  if (halves.length > 2) {
    return null;
  }
  const side = (part: string): string[] | null => {
    if (part === '') {
      return [];
    }
    const items = part.split(':');

    return items.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) ? items : null;
  };
  const head = side(halves[0]);
  const rest = halves.length === 2 ? side(halves[1]) : [];
  if (!head || !rest) {
    return null;
  }
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) {
    return null;
  }
  const all = [
    ...head,
    ...Array<string>(Math.max(missing, 0)).fill('0'),
    ...rest,
  ];

  return {
    value: all.reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n),
    bits: 128,
  };
}

/** The range's network address and prefix length, or null when it is not CIDR notation */
function parseRange(
  text: string,
): { value: bigint; bits: number; prefix: number } | null {
  const parts = text.split('/');
  if (parts.length !== 2 || !/^\d{1,3}$/.test(parts[1])) {
    return null;
  }
  const address = parseAddress(parts[0]);
  const prefix = Number(parts[1]);

  return address && prefix <= address.bits ? { ...address, prefix } : null;
}

/** Why a name can't be used, or null when it can */
export function nameProblem(
  name: string | null | undefined,
  id: string | undefined,
  others: { id?: string; name?: string | null }[],
  what: string,
): string | null {
  const text = name?.trim() ?? '';
  if (!text) {
    return 'Name is required';
  }
  if (
    others.some(
      (o) => o.id !== id && o.name?.trim().toLowerCase() === text.toLowerCase(),
    )
  ) {
    return `The MSEL already has a ${what} with this name`;
  }

  return null;
}

/** Why a range isn't CIDR notation, or null when it is or is empty */
export function rangeProblem(range: string | null | undefined): string | null {
  const text = range?.trim() ?? '';

  return text && !parseRange(text)
    ? 'Range must be CIDR notation, such as 10.20.0.0/24'
    : null;
}

/** Why an address isn't a single IP address, or null when it is or is empty */
export function addressProblem(
  address: string | null | undefined,
): string | null {
  const text = address?.trim() ?? '';

  return text && !parseAddress(text)
    ? 'Address must be a single IP address, such as 10.20.0.10'
    : null;
}

/** Why an address is not inside the network's range, or null when it is, or either is empty or invalid (reported on its own) */
export function addressInRangeProblem(
  address: string | null | undefined,
  range: string | null | undefined,
): string | null {
  const a = parseAddress(address?.trim() ?? '');
  const r = parseRange(range?.trim() ?? '');
  if (!a || !r) {
    return null;
  }
  const inside =
    a.bits === r.bits &&
    a.value >> BigInt(r.bits - r.prefix) ===
      r.value >> BigInt(r.bits - r.prefix);

  return inside
    ? null
    : `The address is not inside the network's range, ${range?.trim()}`;
}

/** Trimmed text, or null when empty */
export function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';

  return text ? text : null;
}
