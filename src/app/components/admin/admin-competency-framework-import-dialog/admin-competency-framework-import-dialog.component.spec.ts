// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { CompetencyFrameworkImportPreview, CompetencyFrameworkService } from 'src/app/generated/blueprint.api';
import { AdminCompetencyFrameworkImportDialogComponent } from './admin-competency-framework-import-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const PREVIEW: CompetencyFrameworkImportPreview = {
  source: 'NICE',
  version: '2.1.0',
  frameworkName: 'NICE Framework',
  totalElements: 12,
  totalRelationships: 4,
  elementTypeCounts: [{ type: 'Knowledge', count: 12 }],
};

async function renderImport() {
  const frameworkApi = {
    previewCompetencyFrameworkJson: vi.fn(() => of(structuredClone(PREVIEW))),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const rendered = await renderComponent(AdminCompetencyFrameworkImportDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressBarModule,
      MatProgressSpinnerModule,
    ],
    declarations: [AdminCompetencyFrameworkImportDialogComponent],
    providers: [{ provide: CompetencyFrameworkService, useValue: frameworkApi }],
  });
  const results: unknown[] = [];
  rendered.fixture.componentInstance.importComplete.subscribe((r) => results.push(r));
  return { ...rendered, frameworkApi, results };
}

async function chooseFile(container: Element, file: File) {
  // applyAccept off: the file dialog's accept list would otherwise drop the
  // unsupported file before the component sees it, as a user could still pick it.
  const user = userEvent.setup({ applyAccept: false });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, file);
  return user;
}

describe('AdminCompetencyFrameworkImportDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers with Import disabled until a file is chosen.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: no file.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderImport();

    expect(fixture.componentInstance).toBeInstanceOf(AdminCompetencyFrameworkImportDialogComponent);
    expect(screen.getByRole('heading', { name: 'Import Competency Framework' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  /**
   * Verifies: a NICE JSON file is previewed by the API, its counts are shown, and Import is enabled.
   * Interacts with: the file input, CompetencyFrameworkService.previewCompetencyFrameworkJson (stub).
   * Data: nice.json previewing 12 Knowledge competencies and 4 relationships.
   */
  it('previews a JSON framework', async () => {
    const { container, frameworkApi } = await renderImport();

    await chooseFile(container, new File(['{}'], 'nice.json', { type: 'application/json' }));

    expect(frameworkApi.previewCompetencyFrameworkJson).toHaveBeenCalledWith(expect.any(File));
    expect(screen.getByText('Competencies to import: 12')).toBeInTheDocument();
    expect(screen.getByText('Relationships: 4')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Version' })).toHaveValue('2.1.0');
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  /**
   * Verifies: an unsupported file type is refused with the list of supported formats, and Cancel reports no import.
   * Interacts with: the file input, importComplete output.
   * Data: framework.txt; then Cancel.
   */
  it('refuses an unsupported file', async () => {
    const { container, frameworkApi, results } = await renderImport();

    const user = await chooseFile(container, new File(['x'], 'framework.txt', { type: 'text/plain' }));
    expect(screen.getByText('Supported formats: .csv (Moodle), .json (NICE), .xlsx (DCWF)')).toBeInTheDocument();
    expect(frameworkApi.previewCompetencyFrameworkJson).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([null]);
  });
});
