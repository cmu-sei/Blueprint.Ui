// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  TechniqueNoticeComponent,
  hasTechniqueNotice,
} from './technique-notice.component';

const WITH_NOTICE: TechniqueRelease = {
  id: 'a',
  domain: 'enterprise-attack',
  name: 'Enterprise ATT&CK',
  version: '20.1',
  source: 'MITRE ATT&CK',
  notice:
    'Copyright 2015-2026, The MITRE Corporation.\nMITRE ATT&CK is a registered trademark of The MITRE Corporation.',
  termsUrl:
    'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/',
};
const CUSTOM: TechniqueRelease = {
  id: 'x',
  domain: 'acme-ttp',
  name: 'Acme Techniques',
  version: '1.0',
};

describe('hasTechniqueNotice', () => {
  it('is true for a notice, a terms link or a source link, and false for none or blanks', () => {
    expect(hasTechniqueNotice(WITH_NOTICE)).toBe(true);
    expect(
      hasTechniqueNotice({ ...CUSTOM, termsUrl: 'https://acme.example/terms' }),
    ).toBe(true);
    expect(
      hasTechniqueNotice({ ...CUSTOM, sourceUrl: 'https://acme.example' }),
    ).toBe(true);
    expect(hasTechniqueNotice(CUSTOM)).toBe(false);
    expect(hasTechniqueNotice({ ...CUSTOM, notice: '  ', termsUrl: '' })).toBe(
      false,
    );
    expect(hasTechniqueNotice(null)).toBe(false);
  });
});

describe('TechniqueNoticeComponent', () => {
  /**
   * Verifies: a release that carries nothing gets no link, so content that is not MITRE's shows no notice.
   * Interacts with: hasTechniqueNotice.
   * Data: a custom release with no notice.
   */
  it('shows no link for a release that carries no notice, terms or source', async () => {
    await renderComponent(TechniqueNoticeComponent, {
      inputs: { release: CUSTOM },
    });

    expect(
      screen.queryByRole('button', { name: 'Copyright & terms' }),
    ).toBeNull();
  });

  /**
   * Verifies: the link opens a dialog with the release's own notice, with nothing shown inline before it is opened.
   * Interacts with: TechniqueNoticeDialogComponent.
   * Data: an ATT&CK release with a two-line notice and a terms link.
   */
  it("opens the release's notice and terms in a dialog", async () => {
    await renderComponent(TechniqueNoticeComponent, {
      imports: [...CRUCIBLE_DIALOG_IMPORTS],
      inputs: { release: WITH_NOTICE },
    });
    const user = userEvent.setup();

    expect(screen.queryByText(/registered trademark/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Copyright & terms' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Copyright & Terms: Enterprise ATT&CK 20.1',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/MITRE ATT&CK is a registered trademark/),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'MITRE ATT&CK Terms of Use' })
        .getAttribute('href'),
    ).toBe(WITH_NOTICE.termsUrl);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('heading', { name: /Copyright & Terms/ }),
    ).toBeNull();
  });
});
