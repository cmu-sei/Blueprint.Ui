// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { compareReleases, groupLabel, techniqueNotices } from './technique-notices';

const copyright = '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.';
const attackTerms = 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';

function release(over: Partial<TechniqueRelease>): TechniqueRelease {
  return { id: 'x', domain: 'd', version: '1', name: 'R', ...over };
}

const attack = release({ source: 'MITRE ATT&CK', notice: `${copyright}\nMITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation.`, termsUrl: attackTerms });
const atlas = release({ source: 'MITRE ATLAS', notice: `${copyright}\nMITRE ATLAS™ is a trademark of The MITRE Corporation.`, termsUrl: attackTerms });
const capec = release({ source: 'MITRE CAPEC', notice: `${copyright}\nMITRE CAPEC™ is a trademark of The MITRE Corporation.`, termsUrl: 'https://capec.mitre.org/about/termsofuse.html' });

describe('techniqueNotices', () => {
  it('shows nothing for no releases', () => {
    expect(techniqueNotices([])).toEqual({ lines: [], terms: [] });
    expect(techniqueNotices([null, undefined])).toEqual({ lines: [], terms: [] });
  });

  it('shows nothing for a custom release that carries no notice or terms', () => {
    expect(techniqueNotices([release({ domain: 'acme-ttp' })])).toEqual({ lines: [], terms: [] });
  });

  it('shows the ATT&CK trademark line only when an ATT&CK release is present', () => {
    expect(techniqueNotices([capec]).lines.join('\n')).not.toContain('ATT&CK');
    expect(techniqueNotices([attack]).lines.join('\n')).toContain('ATT&CK and ATT&CK are registered trademarks');
  });

  it('shows a copyright line shared by several releases once, then each release\'s own mark', () => {
    const { lines } = techniqueNotices([attack, atlas, capec]);

    expect(lines.filter(l => l.startsWith('© 2026'))).toHaveLength(1);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(copyright);
  });

  it('lists each distinct terms address once, labelled with its publisher', () => {
    const { terms } = techniqueNotices([attack, atlas, capec]);

    expect(terms).toEqual([
      { label: 'MITRE ATT&CK Terms of Use', url: attackTerms },
      { label: 'MITRE CAPEC Terms of Use', url: 'https://capec.mitre.org/about/termsofuse.html' },
    ]);
  });

  it('uses a release a planner gave a notice, with a plain label when it names no source', () => {
    const custom = release({ notice: '© Acme Corp', termsUrl: 'https://acme.example/terms' });

    expect(techniqueNotices([custom])).toEqual({
      lines: ['© Acme Corp'],
      terms: [{ label: 'Terms of Use', url: 'https://acme.example/terms' }],
    });
  });
});

describe('groupLabel', () => {
  it('is Tactics unless the release says otherwise', () => {
    expect(groupLabel(release({}))).toBe('Tactics');
    expect(groupLabel(null)).toBe('Tactics');
    expect(groupLabel(release({ groupLabel: 'Categories' }))).toBe('Categories');
  });
});

describe('compareReleases', () => {
  it('orders newest first, then by name, without naming a domain', () => {
    const older = release({ id: 'a', name: 'B', releaseDate: new Date('2025-01-01') });
    const newer = release({ id: 'b', name: 'C', releaseDate: new Date('2026-01-01') });
    const undated = release({ id: 'c', name: 'A' });

    expect([undated, older, newer].sort(compareReleases).map(r => r.id)).toEqual(['b', 'a', 'c']);
  });
});
