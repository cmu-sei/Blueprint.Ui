// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fireEvent, screen, waitFor } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import userEvent from '@testing-library/user-event';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueFramework,
  TechniqueFrameworkService,
  TechniqueReleaseService,
} from 'src/app/generated/blueprint.api';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import {
  AdminTechniqueFrameworksComponent,
  definitionsIn,
} from './admin-technique-frameworks.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';

// definitions as an administrator entered them (test data)
const ONTOLOGY: TechniqueFramework = {
  id: 'fw-1',
  name: 'Defences',
  domain: 'defences',
  isDefensive: true,
  format: 'JsonLdOntology',
  settings: {
    match: { property: 'ex:id' },
    jsonLd: { idProperty: 'ex:id', techniqueClass: 'ex:T', tacticType: 'ex:A' },
  },
  releaseCount: 2,
};
const BUNDLE: TechniqueFramework = {
  id: 'fw-2',
  name: 'Attacks',
  domain: 'attacks',
  isDefensive: false,
  format: 'StixBundle',
  settings: { match: { stixDomain: 'attacks' } },
  releaseCount: 0,
};

async function renderFrameworks(
  frameworks: TechniqueFramework[],
  canEdit = true,
) {
  const frameworkApi = {
    getTechniqueFrameworks: vi.fn(() => of(structuredClone(frameworks))),
    createTechniqueFramework: vi.fn((f: TechniqueFramework) =>
      of({ ...f, id: `fw-new-${f.domain}`, releaseCount: 0 }),
    ),
    updateTechniqueFramework: vi.fn((id: string, f: TechniqueFramework) =>
      of({ ...f, id, releaseCount: 0 }),
    ),
    deleteTechniqueFramework: vi.fn(() => of(null)),
  } satisfies ApiStub<TechniqueFrameworkService>;
  const releaseApi = {
    getTechniqueReleases: vi.fn(() => of([])),
  } satisfies ApiStub<TechniqueReleaseService>;
  const messages = { displayMessage: vi.fn() };
  const rendered = await renderComponent(AdminTechniqueFrameworksComponent, {
    imports: [MatButtonModule, MatIconModule, MatTableModule, MatTooltipModule],
    declarations: [AdminTechniqueFrameworksComponent],
    providers: [
      { provide: TechniqueFrameworkService, useValue: frameworkApi },
      { provide: TechniqueReleaseService, useValue: releaseApi },
      { provide: SystemMessageService, useValue: messages },
      unstubbed(CrucibleDialogService),
    ],
    inputs: { canEdit },
  });
  return { ...rendered, frameworkApi, messages };
}

describe('definitionsIn', () => {
  /**
   * Verifies: an import file holds one definition or a list, and only the definition is kept: no id or counts.
   * Interacts with: definitionsIn, toDefinition.
   * Data: one exported definition, a list of two, and files that hold none.
   */
  it('reads one definition or a list, keeping only the definition', () => {
    expect(definitionsIn(JSON.stringify(ONTOLOGY))).toEqual([
      {
        name: 'Defences',
        description: undefined,
        domain: 'defences',
        isDefensive: true,
        format: 'JsonLdOntology',
        settings: ONTOLOGY.settings,
      },
    ]);
    expect(
      definitionsIn(JSON.stringify([ONTOLOGY, BUNDLE])).map((d) => d.domain),
    ).toEqual(['defences', 'attacks']);
    expect(() => definitionsIn('[]')).toThrow(
      'no technique framework definitions',
    );
    expect(() => definitionsIn('[1]')).toThrow(
      'no technique framework definitions',
    );
  });
});

describe('AdminTechniqueFrameworksComponent', () => {
  /**
   * Verifies: the definitions are listed by name with their domain, family, format and release count.
   * Interacts with: TechniqueFrameworkService.getTechniqueFrameworks (stub), formatName.
   * Data: an ontology and a bundle framework; then none.
   */
  it('lists the definitions by name', async () => {
    await renderFrameworks([ONTOLOGY, BUNDLE]);

    const rows = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) =>
        Array.from(r.querySelectorAll('[role=cell]'))
          .map((c) => c.textContent.trim())
          .filter((t) => t)
          .join(' '),
      );
    expect(rows).toEqual([
      'Attacks attacks Attack STIX bundle 0',
      'Defences defences Defensive JSON-LD ontology 2',
    ]);
    expect(
      screen.queryByText(/No technique frameworks are defined/),
    ).not.toBeInTheDocument();
  });

  it('says a definition is needed when there are none', async () => {
    await renderFrameworks([]);

    expect(
      screen.getByText(/No technique frameworks are defined/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: importing a file creates each definition it holds, and a file that holds none is reported.
   * Interacts with: selectFile, TechniqueFrameworkService.createTechniqueFramework (stub), SystemMessageService.
   * Data: a file of two definitions; a file of an empty list.
   */
  it('creates each definition an imported file holds', async () => {
    const { frameworkApi, messages, fixture } = await renderFrameworks([]);
    const input = screen.getByTestId('definition-file');

    fireEvent.change(input, {
      target: {
        files: [
          new File([JSON.stringify([ONTOLOGY, BUNDLE])], 'frameworks.json'),
        ],
      },
    });
    await waitFor(() =>
      expect(frameworkApi.createTechniqueFramework).toHaveBeenCalledTimes(2),
    );
    expect(
      frameworkApi.createTechniqueFramework.mock.calls.map((c) => c[0].domain),
    ).toEqual(['defences', 'attacks']);
    expect(
      frameworkApi.createTechniqueFramework.mock.calls[0][0],
    ).not.toHaveProperty('id');
    fixture.detectChanges();
    expect(screen.getByText('Defences')).toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [new File(['[]'], 'empty.json')] },
    });
    await waitFor(() =>
      expect(messages.displayMessage).toHaveBeenCalledWith(
        'Import Failed',
        'The file holds no technique framework definitions.',
      ),
    );
  });

  /**
   * Verifies: a definition downloads as the JSON an import reads, named for its domain.
   * Interacts with: export, URL.createObjectURL.
   * Data: the ontology framework.
   */
  it('downloads a definition as the JSON an import reads', async () => {
    await renderFrameworks([ONTOLOGY]);
    let blob: Blob;
    const create = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockImplementation((b: Blob) => {
        blob = b;
        return 'blob:x';
      });
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    fireEvent.click(
      screen.getByRole('button', { name: 'Download Defences as JSON' }),
    );

    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(definitionsIn(await blob.text())).toEqual(
      definitionsIn(JSON.stringify(ONTOLOGY)),
    );
    vi.restoreAllMocks();
  });

  /**
   * Verifies: a definition the API refuses stays in the open dialog, so it is not entered again; once a save
   * succeeds the dialog closes. The refusal reaches the app's error handler, as other saves' do.
   * Interacts with: TechniqueFrameworkService.updateTechniqueFramework (stub failing once), AdminTechniqueFrameworkDialogComponent.
   * Data: the Attacks definition, renamed; its first save refused.
   */
  it('keeps the definition dialog open with what was entered when the save is refused', async () => {
    const errors = captureUnhandledRxErrors();
    const { frameworkApi } = await renderFrameworks([BUNDLE]);
    const failure = new Error('400');
    frameworkApi.updateTechniqueFramework.mockReturnValueOnce(
      throwError(() => failure),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit Attacks' }));
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Attacks, renamed');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await flush();

    expect(errors).toEqual([failure]);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Attacks, renamed',
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Name' }),
      ).not.toBeInTheDocument(),
    );
    expect(frameworkApi.updateTechniqueFramework).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: Save and the fields are disabled while a save is under way, so a second save cannot start and the
   * first answer cannot close the dialog over newer input; a refused save enables them again.
   * Interacts with: TechniqueFrameworkService.updateTechniqueFramework (stub answering when the test says), crucible-dialog submitDisabled.
   * Data: the Attacks definition, saved and then refused.
   */
  it('saves one definition at a time', async () => {
    const errors = captureUnhandledRxErrors();
    const { frameworkApi } = await renderFrameworks([BUNDLE]);
    const answer = new Subject<
      TechniqueFramework & { id: string; releaseCount: number }
    >();
    frameworkApi.updateTechniqueFramework.mockReturnValueOnce(answer);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit Attacks' }));
    await screen.findByRole('textbox', { name: 'Name' });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
    );
    // nothing can be typed that the first answer would close the dialog over
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    const failure = new Error('400');
    answer.error(failure);
    await flush();
    expect(errors).toEqual([failure]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(frameworkApi.updateTechniqueFramework).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: without edit permission the definitions can be read and downloaded but not added, edited or deleted.
   * Interacts with: the canEdit input.
   * Data: the bundle framework.
   */
  it('offers only the download without edit permission', async () => {
    await renderFrameworks([BUNDLE], false);

    expect(
      screen.getByRole('button', { name: 'Download Attacks as JSON' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add a technique framework' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Attacks' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Attacks' }),
    ).not.toBeInTheDocument();
  });
});
