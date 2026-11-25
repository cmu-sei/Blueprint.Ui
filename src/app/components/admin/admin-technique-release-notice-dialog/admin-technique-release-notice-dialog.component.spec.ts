// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  TechniqueFramework,
  TechniqueRelease,
  TechniqueReleaseNotice,
} from 'src/app/generated/blueprint.api';
import {
  AdminTechniqueReleaseNoticeDialogComponent,
  isWebAddress,
} from './admin-technique-release-notice-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const RELEASE: TechniqueRelease = {
  id: 'rel-5',
  domain: 'acme-ttp',
  name: 'Acme Techniques',
  version: '1.0',
};

async function renderDialog(
  notice: TechniqueReleaseNotice = {
    source: '',
    sourceUrl: '',
    notice: '',
    termsUrl: '',
  },
) {
  const data = { release: RELEASE, notice };
  return renderWith(data);
}

async function renderWith(data: {
  release: TechniqueRelease;
  notice: TechniqueReleaseNotice;
  frameworks?: TechniqueFramework[];
}) {
  const rendered = await renderComponent(
    AdminTechniqueReleaseNoticeDialogComponent,
    {
      imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
      declarations: [AdminTechniqueReleaseNoticeDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
    },
  );
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) =>
    results.push(r),
  );
  return { ...rendered, data, results };
}

describe('isWebAddress', () => {
  it('accepts blank, http and https, and nothing a link could run', () => {
    expect(isWebAddress('')).toBe(true);
    expect(isWebAddress(null)).toBe(true);
    expect(isWebAddress('  ')).toBe(true);
    expect(isWebAddress('https://acme.example/terms')).toBe(true);
    expect(isWebAddress('http://acme.example')).toBe(true);
    expect(isWebAddress('javascript:alert(1)')).toBe(false);
    expect(isWebAddress('data:text/html,x')).toBe(false);
    expect(isWebAddress('acme.example/terms')).toBe(false);
  });
});

describe('AdminTechniqueReleaseNoticeDialogComponent', () => {
  /**
   * Verifies: the dialog names the release and starts a custom release's four fields empty.
   * Interacts with: crucible-dialog.
   * Data: a custom release with no notice.
   */
  it('starts a custom release with all four fields empty', async () => {
    await renderDialog();

    expect(
      screen.getByRole('heading', {
        name: 'Edit Release: Acme Techniques 1.0',
      }),
    ).toBeInTheDocument();
    for (const label of ['Source', 'Source URL', 'Notice', 'Terms URL']) {
      expect(screen.getByRole('textbox', { name: label })).toHaveValue('');
    }
  });

  /**
   * Verifies: Save emits the four fields and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: a custom release; a source and notice typed in.
   */
  it('emits the notice on Save and none on Cancel', async () => {
    const { data, results } = await renderDialog();
    const user = userEvent.setup();

    await user.type(
      screen.getByRole('textbox', { name: 'Source' }),
      'Acme Corp',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, notice: data.notice },
      { saveChanges: false, notice: null },
    ]);
    expect(data.notice.source).toBe('Acme Corp');
  });

  /**
   * Verifies: the Framework select offers the frameworks of the release's domain and family, and keeps the one the
   * release is linked to even after that framework's domain changed, so the link does not show blank.
   * Interacts with: frameworks, mat-select.
   * Data: a release linked to a framework since moved to another domain; a matching framework; an unrelated one.
   */
  it('keeps the linked framework in the select when it no longer matches', async () => {
    const frameworks: TechniqueFramework[] = [
      { id: 'fw-linked', name: 'Renamed', domain: 'acme', isDefensive: false },
      { id: 'fw-match', name: 'Acme', domain: 'acme-ttp', isDefensive: false },
      { id: 'fw-other', name: 'Other', domain: 'other', isDefensive: false },
    ];
    const { fixture } = await renderWith({
      release: { ...RELEASE, techniqueFrameworkId: 'fw-linked' },
      notice: { techniqueFrameworkId: 'fw-linked' },
      frameworks,
    });

    expect(fixture.componentInstance.frameworks.map((f) => f.id)).toEqual([
      'fw-linked',
      'fw-match',
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      screen.getByRole('combobox', { name: 'Framework' }),
    ).toHaveTextContent('Renamed');
  });

  /**
   * Verifies: Save is disabled, and nothing is emitted, while a link is not an http or https address.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a source URL of javascript:alert(1).
   */
  it('refuses a link that is not a web address', async () => {
    const { results } = await renderDialog({
      source: 'Acme',
      sourceUrl: 'javascript:alert(1)',
      notice: '',
      termsUrl: '',
    });

    expect(
      screen.getByText('Enter an http or https address'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(results).toEqual([]);
  });
});
