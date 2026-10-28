// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  CompetencyFrameworkService,
  DataFieldType,
  MselDraftImport,
  MselDraftResult,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselDraftDialogComponent, MselDraftDialogData } from './msel-draft-dialog.component';

function draftResult(): MselDraftResult {
  return {
    templateMselId: 'tpl-1',
    templateName: 'Template',
    fields: [{ name: 'Title', dataType: DataFieldType.String }],
    warnings: [],
    competencies: [
      { idNumber: 'T0161', shortName: 'Analyze network traffic' },
      { idNumber: 'T0175', shortName: 'Respond to incidents' },
    ],
    draft: {
      name: 'Port closure',
      description: 'A hurricane closes the port.',
      durationMinutes: 120,
      moves: [{ moveNumber: 0, description: 'Landfall', startMinutes: 0 }],
      teams: [{ name: 'Blue Team', shortName: 'BLUE', competencies: ['T0175'] }],
      organizations: [],
      injects: [{ minutes: 10, eventType: 'Inject', values: { Title: 'Port closed' }, competencies: ['T0161', 'T0175'] }],
      competencies: ['T0161', 'T0175'],
      plannerNotes: [],
    },
  };
}

async function renderDraftDialog(result: MselDraftResult = draftResult()) {
  const draftMsel = vi.fn(() => of(result));
  const mselData = { draftMsel } as Partial<MselDataService>;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of([{ id: 'fw-nice', name: 'NICE 2.0.0' }, { id: 'fw-dcwf', name: 'DCWF 5.1' }])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const ref = dialogRefStub<MselDraftDialogComponent, MselDraftImport>();
  const data: MselDraftDialogData = { templates: [{ id: 'tpl-1', name: 'Template' }] };
  const rendered = await renderComponent(MselDraftDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatProgressSpinnerModule,
      MatIconModule,
      MatChipsModule,
      MatTooltipModule,
    ],
    declarations: [MselDraftDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
      { provide: MselDataService, useValue: mselData },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, draftMsel, close: ref.close };
}

async function draftWithDcwf(result?: MselDraftResult) {
  const rendered = await renderDraftDialog(result);
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Competency frameworks' }));
  await user.click(await screen.findByRole('option', { name: 'DCWF 5.1' }));
  await user.keyboard('{Escape}');
  await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A hurricane closes the port.');
  await user.click(screen.getByRole('button', { name: 'Draft' }));
  return { ...rendered, user };
}

describe('MselDraftDialogComponent', () => {
  /**
   * Verifies: the chosen frameworks go with the draft request, and each inject's and team's competencies show with their names.
   * Interacts with: CompetencyFrameworkService.getCompetencyFrameworks, MselDataService.draftMsel.
   * Data: frameworks NICE 2.0.0 and DCWF 5.1, DCWF chosen; the draft tags the inject T0161 + T0175 and team BLUE T0175.
   */
  it('drafts from the chosen frameworks and lists the competencies', async () => {
    const { draftMsel } = await draftWithDcwf();

    expect(draftMsel).toHaveBeenCalledWith({
      templateMselId: 'tpl-1',
      prompt: 'A hurricane closes the port.',
      competencyFrameworkIds: ['fw-dcwf'],
    });
    const section = screen.getByRole('heading', { name: 'Competencies' }).parentElement;
    expect(within(section).getByText('Analyze network traffic')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove T0175' })).toHaveLength(2);
  });

  /**
   * Verifies: removing a competency from the inject and the team drops it from the MSEL list too, and Create MSEL sends the frameworks.
   * Interacts with: the competency chips' remove buttons, dialogRef.close.
   * Data: T0175 removed from the inject and from team BLUE; T0161 stays on the inject.
   */
  it('removes a competency the planner rejects everywhere it is no longer used', async () => {
    const { user, close } = await draftWithDcwf();

    for (const button of screen.getAllByRole('button', { name: 'Remove T0175' })) {
      await user.click(button);
    }
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    const sent = close.mock.calls[0][0] as MselDraftImport;
    expect(sent.competencyFrameworkIds).toEqual(['fw-dcwf']);
    expect(sent.draft.injects[0].competencies).toEqual(['T0161']);
    expect(sent.draft.teams[0].competencies).toEqual([]);
    expect(sent.draft.competencies).toEqual(['T0161']);
    const section = screen.getByRole('heading', { name: 'Competencies' }).parentElement;
    expect(within(section).queryByText('T0175')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the review lists the draft's Gallery cards with how many articles each holds, and shows each article's card.
   * Interacts with: MselDataService.draftMsel, the Gallery cards section, the inject rows.
   * Data: cards Exercise Control and Public and Media; the one inject on Public and Media.
   */
  it('shows the Gallery cards and the card each article goes on', async () => {
    const result = draftResult();
    result.draft.cards = [
      { name: 'Exercise Control', description: 'Read-in and facilitator messages' },
      { name: 'Public and Media', description: 'News and social posts' },
    ];
    result.draft.injects[0].card = 'Public and Media';
    await draftWithDcwf(result);

    expect(screen.getByRole('heading', { name: 'Gallery cards' })).toBeInTheDocument();
    expect(screen.getByText(/Read-in and facilitator messages\s*\(0 articles\)/)).toBeInTheDocument();
    expect(screen.getByText(/News and social posts\s*\(1 article\)/)).toBeInTheDocument();
    expect(screen.getByTitle('Gallery card')).toHaveTextContent('Public and Media');
  });
});
