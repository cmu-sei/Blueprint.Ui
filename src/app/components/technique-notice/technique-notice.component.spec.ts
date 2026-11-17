// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TechniqueNoticeComponent } from './technique-notice.component';

const ATTACK: TechniqueRelease = {
  id: 'a', domain: 'enterprise-attack', name: 'Enterprise ATT&CK', version: '20.1', source: 'MITRE ATT&CK',
  notice: '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.\nMITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation.',
  termsUrl: 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/',
};
const CAPEC: TechniqueRelease = {
  id: 'c', domain: 'capec', name: 'MITRE CAPEC', version: '3.9', source: 'MITRE CAPEC',
  notice: '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.\nMITRE CAPEC™ is a trademark of The MITRE Corporation.',
  termsUrl: 'https://capec.mitre.org/about/termsofuse.html',
};
const CUSTOM: TechniqueRelease = { id: 'x', domain: 'acme-ttp', name: 'Acme Techniques', version: '1.0' };

describe('TechniqueNoticeComponent', () => {
  it('shows nothing for a custom release that carries no notice', async () => {
    const { container } = await renderComponent(TechniqueNoticeComponent, { inputs: { releases: [CUSTOM] } });

    expect(container.querySelector('.attribution')).toBeNull();
    expect(screen.queryByText(/MITRE/)).toBeNull();
  });

  it('shows the ATT&CK trademark line only when an ATT&CK release is among them', async () => {
    const { container } = await renderComponent(TechniqueNoticeComponent, { inputs: { releases: [CAPEC] } });

    expect(container.textContent).toContain('MITRE CAPEC™ is a trademark');
    expect(container.textContent).not.toContain('ATT&CK');
  });

  it('shows the shared copyright line once and a terms link for each publisher', async () => {
    const { container } = await renderComponent(TechniqueNoticeComponent, { inputs: { releases: [ATTACK, CAPEC, CUSTOM] } });

    expect((container.textContent.match(/© 2026 The MITRE Corporation/g) || []).length).toBe(1);
    expect(container.textContent).toContain('MITRE ATT&CK and ATT&CK are registered trademarks');
    expect(screen.getByText('MITRE ATT&CK Terms of Use').getAttribute('href')).toBe(ATTACK.termsUrl);
    expect(screen.getByText('MITRE CAPEC Terms of Use').getAttribute('href')).toBe(CAPEC.termsUrl);
  });

  it('shows the notice an administrator gave a custom release', async () => {
    const custom = { ...CUSTOM, notice: '© Acme Corp', termsUrl: 'https://acme.example/terms' };
    await renderComponent(TechniqueNoticeComponent, { inputs: { releases: [custom] } });

    expect(screen.getByText('© Acme Corp')).toBeTruthy();
    expect(screen.getByText('Terms of Use').getAttribute('href')).toBe('https://acme.example/terms');
  });
});
