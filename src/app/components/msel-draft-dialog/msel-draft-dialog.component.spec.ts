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
import { MatTabsModule } from '@angular/material/tabs';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { CompetencyFrameworkService, MselBuildService, MselDraftResult } from 'src/app/generated/blueprint.api';
import { MselAiBuildService } from 'src/app/data/msel/msel-ai-build.service';
import { AiDraftProgress, SignalRService } from 'src/app/services/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselDraftDialogComponent, MselDraftDialogData } from './msel-draft-dialog.component';

function designResult(): MselDraftResult {
  return {
    templateMselId: 'tpl-1',
    templateName: 'Template',
    fields: [],
    warnings: ['The draft had no Gallery cards.'],
    competencies: [
      { idNumber: 'T0161', shortName: 'Analyze network traffic' },
      { idNumber: 'T0175', shortName: 'Respond to incidents' },
    ],
    questions: [
      { id: 'Q1', question: 'Should the outage reach the hospital?', why: 'Sets the stakes', suggested: 'Stop at the port' },
      { id: 'Q2', question: 'Is the press involved?', suggested: 'Yes, from move 1' },
    ],
    draft: {
      name: 'Port closure',
      description: 'A hurricane closes the port.',
      durationMinutes: 120,
      scenario: { problem: 'The port is closed.', premise: 'A hurricane hit.', escalationCeiling: 'No loss of life' },
      objectives: [{ id: 'O1', task: 'Reopen the port', condition: 'With half the staff', standard: 'Within a day', competencies: ['T0161'] }],
      moves: [
        { moveNumber: 0, description: 'Landfall', startMinutes: 0, purpose: 'Make them choose a lead' },
        { moveNumber: 1, description: 'Recovery', startMinutes: 60, purpose: 'Pressure' },
      ],
      teams: [{ name: 'Blue Team', shortName: 'BLUE', description: 'The port operators', competencies: ['T0175'] }],
      organizations: [{ name: 'Harbour Herald', shortName: 'NEWS', description: 'The regional paper' }],
      cards: [{ name: 'Port news', description: 'What the port says' }],
      injects: [],
      competencies: ['T0161', 'T0175'],
      plannerNotes: ['Assumed a two-hour exercise.'],
    },
  };
}

async function renderDraftDialog(
  design: () => Observable<unknown> = () => of(designResult()),
  templates: MselDraftDialogData['templates'] = [{ id: 'tpl-1', name: 'Template' }],
  create: () => Observable<unknown> = () => of({ msel: { id: 'msel-new' } })
) {
  const designMsel = vi.fn(design);
  const createMselFromDesign = vi.fn(create);
  const buildApi = { designMsel, createMselFromDesign } as Partial<ApiStub<MselBuildService>>;
  const run = vi.fn();
  const progress = new Subject<AiDraftProgress>();
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of([{ id: 'fw-nice', name: 'NICE 2.0.0' }, { id: 'fw-dcwf', name: 'DCWF 5.1' }])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const ref = dialogRefStub<MselDraftDialogComponent, string>();
  const data: MselDraftDialogData = { templates };
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
      MatTabsModule,
    ],
    declarations: [MselDraftDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
      { provide: MselBuildService, useValue: buildApi },
      { provide: MselAiBuildService, useValue: { run } },
      { provide: SignalRService, useValue: { aiDraftProgress$: progress } },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, designMsel, createMselFromDesign, run, progress, close: ref.close };
}

async function draftDesign(design?: () => Observable<unknown>) {
  const rendered = await renderDraftDialog(design);
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A hurricane closes the port.');
  await user.click(screen.getByRole('button', { name: 'Draft' }));
  return { ...rendered, user };
}

describe('MselDraftDialogComponent', () => {
  /**
   * Verifies: Draft asks for the design from the description, template and chosen frameworks, and the review opens on the questions, each answer starting as its suggestion.
   * Interacts with: CompetencyFrameworkService.getCompetencyFrameworks, MselBuildService.designMsel, the Questions tab.
   * Data: DCWF chosen; a design with two questions.
   */
  it('drafts the design and asks its questions with suggested answers', async () => {
    const rendered = await renderDraftDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Competency frameworks' }));
    await user.click(await screen.findByRole('option', { name: 'DCWF 5.1' }));
    await user.keyboard('{Escape}');
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A hurricane closes the port.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(rendered.designMsel).toHaveBeenCalledWith(expect.objectContaining({
      templateMselId: 'tpl-1',
      prompt: 'A hurricane closes the port.',
      competencyFrameworkIds: ['fw-dcwf'],
    }));
    expect(screen.getByRole('tab', { name: 'Questions (2)', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Sets the stakes')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Should the outage reach the hospital?' })).toHaveValue('Stop at the port');
  });

  /**
   * Verifies: Create MSEL sends the reviewed design with the planner's answers, starts writing the rest into the new MSEL, and closes with its id.
   * Interacts with: the Questions and Design tabs, MselBuildService.createMselFromDesign, MselAiBuildService.run.
   * Data: the planner rewrites Q1's answer and renames the exercise; Q2 keeps its suggestion.
   */
  it('creates the MSEL from the reviewed design and starts the build', async () => {
    const { user, createMselFromDesign, run, close } = await draftDesign();
    const answer = screen.getByRole('textbox', { name: 'Should the outage reach the hospital?' });
    await user.clear(answer);
    await user.type(answer, 'Yes, the hospital loses power');
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Port and hospital');
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    expect(createMselFromDesign).toHaveBeenCalledWith(expect.objectContaining({
      templateMselId: 'tpl-1',
      prompt: 'A hurricane closes the port.',
      draft: expect.objectContaining({ name: 'Port and hospital' }),
      answers: [
        { question: 'Should the outage reach the hospital?', answer: 'Yes, the hospital loses power' },
        { question: 'Is the press involved?', answer: 'Yes, from move 1' },
      ],
    }));
    expect(run).toHaveBeenCalledWith('msel-new');
    expect(close).toHaveBeenCalledWith('msel-new');
  });

  /**
   * Verifies: a changed answer offers its suggestion back.
   * Interacts with: the Questions tab.
   * Data: Q1's answer cleared, then Use it.
   */
  it('puts a suggested answer back', async () => {
    const { user } = await draftDesign();
    const answer = screen.getByRole('textbox', { name: 'Should the outage reach the hospital?' });
    await user.clear(answer);

    await user.click(screen.getByRole('button', { name: 'Use it' }));

    expect(answer).toHaveValue('Stop at the port');
  });

  /**
   * Verifies: the design's tabs show the objectives, the warnings and planner notes, the moves with their purpose, the teams and organizations, and the cards, and the planner can remove one.
   * Interacts with: the Design, Moves, Teams and organizations and Gallery cards tabs.
   * Data: objective O1, two moves, team BLUE and organization NEWS, one card.
   */
  it('shows the design in tabs and lets the planner change it', async () => {
    const { user, createMselFromDesign } = await draftDesign();

    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.getByRole('textbox', { name: 'The problem' })).toHaveValue('The port is closed.');
    expect(screen.getByRole('textbox', { name: 'O1 task' })).toHaveValue('Reopen the port');
    expect(screen.getByText('The draft had no Gallery cards.')).toBeInTheDocument();
    expect(screen.getByText('Assumed a two-hour exercise.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Moves (2)' }));
    expect(screen.getByRole('textbox', { name: 'Move 0 purpose' })).toHaveValue('Make them choose a lead');
    expect(screen.getByRole('textbox', { name: 'Move 1 title' })).toHaveValue('Recovery');

    await user.click(screen.getByRole('tab', { name: 'Teams and organizations (2)' }));
    const table = screen.getByRole('table', { name: 'Teams and organizations' });
    expect(within(table).getByRole('textbox', { name: 'BLUE description' })).toHaveValue('The port operators');
    await user.click(within(table).getByRole('button', { name: 'Remove NEWS' }));
    expect(within(table).queryByRole('textbox', { name: 'NEWS description' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Gallery cards (1)' }));
    expect(screen.getByRole('textbox', { name: 'Port news description' })).toHaveValue('What the port says');

    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));
    expect(createMselFromDesign).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ organizations: [] }),
    }));
  });

  /**
   * Verifies: a competency removed from a team leaves the MSEL's list unless an objective still uses it.
   * Interacts with: the Teams and organizations tab.
   * Data: BLUE has T0175, objective O1 has T0161.
   */
  it('removes a competency the planner rejects everywhere it is no longer used', async () => {
    const { user, createMselFromDesign } = await draftDesign();
    await user.click(screen.getByRole('tab', { name: 'Teams and organizations (2)' }));

    await user.click(screen.getByRole('button', { name: 'Remove T0175' }));
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    expect(createMselFromDesign).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ competencies: ['T0161'] }),
    }));
  });

  /**
   * Verifies: while the design is written the dialog says what it has so far from the streamed answer, and Stop abandons it, keeping the description.
   * Interacts with: SignalRService.aiDraftProgress$, the Stop button.
   * Data: a design that never answers; progress of 2 moves and 1 team.
   */
  it('shows the design being written and stops it', async () => {
    const { user, progress, fixture } = await draftDesign(() => NEVER);

    progress.next({ operation: 'design', characters: 900, counts: { moves: 2, teams: 1 }, done: false });
    fixture.detectChanges();
    expect(screen.getByText('Writing the design.')).toBeInTheDocument();
    expect(screen.getByText(/2 moves, 1 team so far\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.queryByText('Writing the design.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Exercise description' })).toHaveValue('A hurricane closes the port.');
    expect(screen.getByRole('button', { name: 'Draft' })).toBeEnabled();
  });

  /**
   * Verifies: a design that fails says why, and the planner can draft again.
   * Interacts with: MselBuildService.designMsel.
   * Data: the API answers 500 with a title.
   */
  it('says why a design failed', async () => {
    await draftDesign(() => throwError(() => ({ error: { title: 'The model declined to write this draft.' } })));

    expect(screen.getByRole('alert')).toHaveTextContent('The model declined to write this draft.');
    expect(screen.getByRole('button', { name: 'Draft' })).toBeEnabled();
  });

  /**
   * Verifies: the design choices go with the draft request; the CITE assessment is offered only for a template that uses CITE.
   * Interacts with: the Design choices section, MselDataService.designMsel.
   * Data: a CITE template; Discussion format, the mission impact matrix, 4 moves, two parallel teams, no profile pages.
   */
  it('sends the design choices with the draft', async () => {
    const { designMsel } = await renderDraftDialog(undefined, [{ id: 'tpl-1', name: 'Template', useCite: true }]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    await user.click(screen.getByRole('combobox', { name: 'Format' }));
    await user.click(await screen.findByRole('option', { name: 'Discussion (tabletop)' }));
    await user.click(screen.getByRole('combobox', { name: 'CITE assessment' }));
    await user.click(await screen.findByRole('option', { name: 'DoD CTT mission impact matrix' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Number of moves' }), '4');
    await user.type(screen.getByRole('textbox', { name: 'Participant structure' }), 'Two parallel teams');
    await user.click(screen.getByRole('checkbox', { name: 'Add Team Profiles and Organization Profiles pages' }));
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'Cables are cut.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({
      design: { format: 'Discussion', citeAssessment: 'MissionImpact', moves: 4, structure: 'Two parallel teams', profilePages: false },
    }));
  });

  /**
   * Verifies: without CITE on the template there is no CITE assessment to choose.
   * Interacts with: the Design choices section.
   * Data: a template without CITE.
   */
  it('offers no CITE assessment for a template without CITE', async () => {
    await renderDraftDialog();

    await userEvent.setup().click(screen.getByText('Design choices (optional)'));

    expect(screen.queryByRole('combobox', { name: 'CITE assessment' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Format' })).toBeInTheDocument();
  });

  /**
   * Verifies: a template that links a scoring model offers to keep it and chooses that by default; the review says what CITE gets.
   * Interacts with: the CITE assessment select, MselDataService.designMsel, the CITE tasks section.
   * Data: a CITE template with a scoring model; then a draft using questions by move.
   */
  it('keeps the template scoring model by default and says what CITE gets', async () => {
    const result = designResult();
    result.draft.design = { citeAssessment: 'QuestionsByMove' };
    const { designMsel } = await renderDraftDialog(() => of(result), [
      { id: 'tpl-1', name: 'Template', useCite: true, citeScoringModelId: 'sm-1' },
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    expect(screen.getByRole('combobox', { name: 'CITE assessment' })).toHaveTextContent("Keep the template's scoring model");
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'Cables are cut.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ citeAssessment: 'Template' }) }));
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.getByText(/also creates the scoring model "Port closure Questions by Move" in CITE/)).toBeInTheDocument();
  });

  /**
   * Verifies: a Gallery template offers the card groupings and a CITE template offers NCISS, and both go with the draft.
   * Interacts with: the Gallery cards and CITE assessment selects, MselDataService.designMsel.
   * Data: a template with Gallery and CITE; cards by critical infrastructure sector, CISA NCISS.
   */
  it('sends the card grouping and NCISS with the draft', async () => {
    const { designMsel } = await renderDraftDialog(undefined, [
      { id: 'tpl-1', name: 'Template', useCite: true, useGallery: true },
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    await user.click(screen.getByRole('combobox', { name: 'Gallery cards' }));
    await user.click(await screen.findByRole('option', { name: 'By critical infrastructure sector' }));
    await user.click(screen.getByRole('combobox', { name: 'CITE assessment' }));
    await user.click(await screen.findByRole('option', { name: 'CISA NCISS' }));
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A grid attack.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({
      design: expect.objectContaining({ cardGrouping: 'Sectors', citeAssessment: 'Nciss' }),
    }));
  });

  /**
   * Verifies: with several templates, the Crucible MSEL template is chosen to start with.
   * Interacts with: the Template select.
   * Data: Standard MSEL and Crucible MSEL templates.
   */
  it('starts from the Crucible MSEL template', async () => {
    await renderDraftDialog(undefined, [
      { id: 'tpl-standard', name: 'Standard MSEL' },
      { id: 'tpl-crucible', name: 'Crucible MSEL', useCite: true, useGallery: true },
    ]);

    expect(screen.getByRole('combobox', { name: 'Template' })).toHaveTextContent('Crucible MSEL');
  });

  /**
   * Verifies: a Gallery template's article marking is the starting choice, and the planner's choice goes with the design.
   * Interacts with: the Article marking and TLP level selects, MselBuildService.designMsel.
   * Data: a Gallery template marked TLP:AMBER; the planner picks a classification banner with its own text.
   */
  it('starts from the template marking and sends the chosen one', async () => {
    const { designMsel } = await renderDraftDialog(undefined, [
      { id: 'tpl-1', name: 'Template', useGallery: true, articleMarking: 'Tlp', articleMarkingText: 'AMBER' },
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    expect(screen.getByRole('combobox', { name: 'Article marking' })).toHaveTextContent('TLP');
    expect(screen.getByRole('combobox', { name: 'TLP level' })).toHaveTextContent('TLP:AMBER');
    await user.click(screen.getByRole('combobox', { name: 'Article marking' }));
    await user.click(await screen.findByRole('option', { name: 'Classification banner' }));
    const text = screen.getByRole('textbox', { name: 'Classification banner text' });
    await user.clear(text);
    await user.type(text, 'UNCLASSIFIED // FOUO');
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A grid attack.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({
      design: expect.objectContaining({ marking: 'Classification', markingText: 'UNCLASSIFIED // FOUO' }),
    }));
  });

  /**
   * Verifies: a CITE template's teams show their CITE duties for editing, and the lead time before STARTEX goes with the design.
   * Interacts with: the Doors open field, the Teams and organizations tab, MselBuildService.createMselFromDesign.
   * Data: a CITE template; 20 minutes before STARTEX; BLUE's duties edited to Lead and Scribe.
   */
  it('sends the lead time and the edited CITE duties', async () => {
    const result = designResult();
    result.draft.teams[0].duties = ['Incident Lead'];
    const { designMsel, createMselFromDesign } = await renderDraftDialog(() => of(result), [{ id: 'tpl-1', name: 'Template', useCite: true }]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    await user.type(screen.getByRole('spinbutton', { name: 'Doors open before STARTEX (minutes)' }), '20');
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'A grid attack.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ leadMinutes: 20 }) }));

    await user.click(screen.getByRole('tab', { name: 'Teams and organizations (2)' }));
    const duties = screen.getByRole('textbox', { name: 'BLUE CITE duties' });
    expect(duties).toHaveValue('Incident Lead');
    await user.clear(duties);
    await user.type(duties, 'Lead, Scribe');
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    expect(createMselFromDesign).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ teams: [expect.objectContaining({ shortName: 'BLUE', duties: ['Lead', 'Scribe'] })] }),
    }));
  });

  /**
   * Verifies: a template that authors its own scoring model, as the seeded Crucible MSEL does with NCISS, is kept by default too.
   * Interacts with: the CITE assessment select, MselBuildService.designMsel.
   * Data: a CITE template with hasScoringModel and no linked model.
   */
  it('keeps a template authored scoring model by default', async () => {
    const { designMsel } = await renderDraftDialog(undefined, [{ id: 'tpl-1', name: 'Crucible MSEL', useCite: true, hasScoringModel: true }]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Design choices (optional)'));
    expect(screen.getByRole('combobox', { name: 'CITE assessment' })).toHaveTextContent("Keep the template's scoring model");
    await user.type(screen.getByRole('textbox', { name: 'Exercise description' }), 'Cables are cut.');
    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(designMsel).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ citeAssessment: 'Template' }) }));
  });
});
