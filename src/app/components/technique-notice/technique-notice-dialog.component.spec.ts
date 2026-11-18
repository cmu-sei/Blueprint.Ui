// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TechniqueNoticeDialogComponent } from './technique-notice-dialog.component';

const RELEASE: TechniqueRelease = {
  id: 'rel-1',
  domain: 'acme-ttp',
  name: 'Acme Techniques',
  version: '1.0',
  source: 'Acme Corp',
  sourceUrl: 'https://acme.example',
  termsUrl: 'https://acme.example/terms',
  notice: '© Acme Corp\nAcme is a trademark of Acme Corp.',
};

async function renderDialog(release: TechniqueRelease) {
  const dialogRef = {
    close: vi.fn(),
    disableClose: false,
    keydownEvents: () => ({ pipe: () => ({ subscribe: () => undefined }) }),
  };
  const rendered = await renderComponent(TechniqueNoticeDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    declarations: [TechniqueNoticeDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { release } },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, dialogRef };
}

describe('TechniqueNoticeDialogComponent', () => {
  /**
   * Verifies: the dialog shows the release's source, its whole notice with the line breaks it was given, and both
   * links, each opening in a new tab without giving the page access to the opener.
   * Interacts with: crucible-dialog.
   * Data: a custom release with a source, a two-line notice, a terms link and a source link.
   */
  it('shows the source, the notice with its line breaks, and the links', async () => {
    const { container } = await renderDialog(RELEASE);

    expect(
      screen.getByRole('heading', {
        name: 'Copyright & Terms: Acme Techniques 1.0',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    const notice =
      container.ownerDocument.querySelector<HTMLElement>('.notice');
    expect(notice.textContent).toBe(RELEASE.notice);
    expect(getComputedStyle(notice).whiteSpace).toBe('pre-line');
    const terms = screen.getByRole('link', { name: 'Acme Corp Terms of Use' });
    expect(terms.getAttribute('href')).toBe('https://acme.example/terms');
    expect(terms.getAttribute('target')).toBe('_blank');
    expect(terms.getAttribute('rel')).toBe('noopener');
    expect(
      screen
        .getByRole('link', { name: 'Acme Corp website' })
        .getAttribute('href'),
    ).toBe('https://acme.example');
  });

  /**
   * Verifies: a link that is not an http or https address is not offered, and a release with only a notice shows
   * the notice and no links.
   * Interacts with: isWebAddress.
   * Data: a release whose terms link is a javascript: address and whose source link is blank.
   */
  it('offers no link that is not a web address', async () => {
    await renderDialog({
      ...RELEASE,
      termsUrl: 'javascript:alert(1)',
      sourceUrl: '',
    });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Acme is a trademark/)).toBeTruthy();
  });

  /**
   * Verifies: Close dismisses the dialog.
   * Interacts with: MatDialogRef.close.
   * Data: any release.
   */
  it('closes from the Close button', async () => {
    const { dialogRef } = await renderDialog(RELEASE);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));

    expect(dialogRef.close).toHaveBeenCalled();
  });
});
