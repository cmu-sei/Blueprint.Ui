// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// The checks the Networks tab makes before it saves. The API makes the same ones and more (an address
// inside its network's range), and says what is wrong when it refuses a save.

const CIDR = /^[0-9a-fA-F:.]+\/\d{1,3}$/;
const ADDRESS = /^[0-9a-fA-F:.]+$/;

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

  return text && !CIDR.test(text)
    ? 'Range must be CIDR notation, such as 10.20.0.0/24'
    : null;
}

/** Why an address isn't a single IP address, or null when it is or is empty */
export function addressProblem(
  address: string | null | undefined,
): string | null {
  const text = address?.trim() ?? '';

  return text && !ADDRESS.test(text)
    ? 'Address must be a single IP address, such as 10.20.0.10'
    : null;
}

/** Trimmed text, or null when empty */
export function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';

  return text ? text : null;
}
