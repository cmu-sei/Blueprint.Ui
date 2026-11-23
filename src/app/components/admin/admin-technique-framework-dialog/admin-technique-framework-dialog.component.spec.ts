// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { fireEvent, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { TechniqueFileFormat } from 'src/app/generated/blueprint.api';
import { TechniqueFrameworkDefinition } from 'src/app/data/technique-framework/technique-framework-data.service';
import {
  AdminTechniqueFrameworkDialogComponent,
  toForm,
} from './admin-technique-framework-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

// a definition as an administrator entered it (test data)
const DEFINITION: TechniqueFrameworkDefinition = {
  name: 'Acme Techniques',
  description: 'Acme',
  domain: 'acme-ttp',
  isDefensive: false,
  format: TechniqueFileFormat.StixBundle,
  settings: { match: { stixDomain: 'acme-ttp' }, stix: { idSource: 'acme' } },
};

async function renderDialog(definition: TechniqueFrameworkDefinition | null) {
  const data = { title: 'Edit Technique Framework', form: toForm(definition) };
  const rendered = await renderComponent(
    AdminTechniqueFrameworkDialogComponent,
    {
      imports: [
        ...CRUCIBLE_DIALOG_IMPORTS,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
      ],
      declarations: [AdminTechniqueFrameworkDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
    },
  );
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: {
    saveChanges: boolean;
    definition: TechniqueFrameworkDefinition | null;
  }[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) =>
    results.push(r),
  );
  return { ...rendered, data, results };
}

describe('AdminTechniqueFrameworkDialogComponent', () => {
  /**
   * Verifies: a new framework starts empty, with settings holding an empty match, and Save is disabled until it
   * has a name and a domain.
   * Interacts with: toForm, errorFree, crucible-dialog submitDisabled.
   * Data: no definition.
   */
  it('starts a new framework empty and needs a name and domain', async () => {
    const user = userEvent.setup();
    await renderDialog(null);

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    // the JSON sits in a collapsed Advanced section until it is opened
    expect(
      screen.queryByRole('textbox', { name: 'Settings (JSON)' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advanced (JSON)' }));
    expect(
      JSON.parse(
        screen.getByRole<HTMLTextAreaElement>('textbox', {
          name: 'Settings (JSON)',
        }).value,
      ),
    ).toEqual({ match: {} });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'New');
    await user.type(
      screen.getByRole('textbox', { name: 'Domain' }),
      'new-domain',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  /**
   * Verifies: Save emits the definition with its settings parsed from the JSON, trimmed, and Cancel emits none.
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an existing definition, renamed.
   */
  it('emits the edited definition on Save and none on Cancel', async () => {
    const user = userEvent.setup();
    const { results } = await renderDialog(DEFINITION);

    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, '  Acme, renamed ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      {
        saveChanges: true,
        definition: { ...DEFINITION, name: 'Acme, renamed' },
      },
      { saveChanges: false, definition: null },
    ]);
  });

  /**
   * Verifies: settings that are not a JSON object are named as the problem, and Save stays disabled.
   * Interacts with: settingsError, errorFree.
   * Data: unparseable JSON, then a JSON array.
   */
  it('refuses settings that are not a JSON object', async () => {
    const user = userEvent.setup();
    const { results } = await renderDialog(DEFINITION);
    await user.click(screen.getByRole('button', { name: 'Advanced (JSON)' }));
    const settings = screen.getByRole('textbox', { name: 'Settings (JSON)' });

    fireEvent.input(settings, { target: { value: '{ "match": ' } });
    expect(
      await screen.findByText(/The settings are not valid JSON/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.input(settings, { target: { value: '[]' } });
    expect(
      await screen.findByText('The settings must be a JSON object.'),
    ).toBeInTheDocument();
    expect(results).toEqual([]);
  });
});
