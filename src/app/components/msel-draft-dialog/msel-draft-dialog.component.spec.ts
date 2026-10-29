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
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
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

async function renderDraftDialog(
  result: MselDraftResult = draftResult(),
  draftArticle: (...args: any[]) => any = vi.fn(),
  draftProfile: (...args: any[]) => any = vi.fn(() => of({ html: '<p>Profile</p>', notes: [] })),
  templates: MselDraftDialogData['templates'] = [{ id: 'tpl-1', name: 'Template' }]
) {
  const draftMsel = vi.fn(() => of(result));
  const mselData = { draftMsel, draftArticle, draftProfile } as Partial<MselDataService>;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of([{ id: 'fw-nice', name: 'NICE 2.0.0' }, { id: 'fw-dcwf', name: 'DCWF 5.1' }])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const ref = dialogRefStub<MselDraftDialogComponent, MselDraftImport>();
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
  return { ...rendered, draftMsel, draftArticle, draftProfile, close: ref.close };
}

async function draftWithDcwf(result?: MselDraftResult, draftArticle?: (...args: any[]) => any, draftProfile?: (...args: any[]) => any) {
  const rendered = await renderDraftDialog(result, draftArticle, draftProfile);
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
      design: { citeAssessment: 'QuestionsByMove', profilePages: true },
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

  // a draft whose first two injects are Gallery articles and whose third is not
  function articleDraft(): MselDraftResult {
    const result = draftResult();
    result.fields = [
      { name: 'Title', dataType: DataFieldType.String },
      { name: 'Source Type', dataType: DataFieldType.SourceType },
      { name: 'Details', dataType: DataFieldType.Html },
    ];
    result.draft.injects = [
      { minutes: 10, eventType: 'Inject', values: { Title: 'Cables cut', 'Source Type': 'News', Details: '<p>Two cables cut.</p>' }, competencies: [] },
      { minutes: 20, eventType: 'Inject', values: { Title: 'Operator notice', 'Source Type': 'Email', Details: '<p>Repairs begin.</p>' }, competencies: [] },
      { minutes: 30, eventType: 'Facilitation', values: { Title: 'Controller check' }, competencies: [] },
    ];
    result.draft.competencies = [];
    return result;
  }

  /**
   * Verifies: after the draft, each Gallery article is written out, the article shows as a preview, and its notes show under it.
   * Interacts with: MselDataService.draftArticle, once per article with its index; the inject details.
   * Data: two articles (News, Email) and a facilitation row; the email fails with a 500 titled "The model wrote no article."
   */
  it('writes each Gallery article and shows it, or why it could not be written', async () => {
    const draftArticle = vi.fn((request: { injectIndex: number }) =>
      request.injectIndex === 0
        ? of({ fieldName: 'Details', html: '<table width="720"><tbody><tr><td>HARBOUR HERALD</td></tr></tbody></table>', notes: ['Assumed a regional paper.'] })
        : throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'The model wrote no article.' } }))
    );
    const { user } = await draftWithDcwf(articleDraft(), draftArticle);

    expect(draftArticle).toHaveBeenCalledTimes(2);
    expect(draftArticle).toHaveBeenCalledWith(expect.objectContaining({ templateMselId: 'tpl-1', injectIndex: 0 }));
    expect(draftArticle).toHaveBeenCalledWith(expect.objectContaining({ injectIndex: 1 }));
    expect(screen.getByText(/Wrote 2 of 3 Gallery articles and team and organization\s+profiles/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Operator notice: The model wrote no article.');
    await user.click(screen.getByText('Cables cut', { selector: '.inject-title' }));
    expect(screen.getByLabelText('Article preview')).toHaveTextContent('HARBOUR HERALD');
    expect(screen.getByText('Assumed a regional paper.')).toBeInTheDocument();
  });

  /**
   * Verifies: Create MSEL turns each written article's SVG graphics into PNG before handing the draft on.
   * Interacts with: the component's PNG conversion (replaced), dialogRef.close.
   * Data: the News article written with an SVG logo; the email left as drafted.
   */
  it('converts the articles\' graphics to PNG when the MSEL is created', async () => {
    const draftArticle = vi.fn((request: { injectIndex: number }) =>
      of({ fieldName: 'Details', html: request.injectIndex === 0 ? '<img src="data:image/svg+xml;base64,LOGO" alt="Logo">' : '<p>Notice</p>', notes: [] })
    );
    const { user, close, fixture } = await draftWithDcwf(articleDraft(), draftArticle);
    // jsdom cannot draw on a canvas; the conversion itself is covered by svg-to-png.spec.ts
    fixture.componentInstance.toPng = async (html: string) => html.replace('data:image/svg+xml;base64,LOGO', 'data:image/png;base64,LOGO');

    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    await vi.waitFor(() => expect(close).toHaveBeenCalled());
    const draft = close.mock.calls[0][0].draft;
    expect(draft.injects[0].values.Details).toBe('<img src="data:image/png;base64,LOGO" alt="Logo">');
    expect(draft.injects[1].values.Details).toBe('<p>Notice</p>');
  });

  /**
   * Verifies: each drafted team and organization gets a profile, the organization keeps its one-line description as its
   * summary, the profiles show for review, and Create MSEL converts their logos to PNG.
   * Interacts with: MselDataService.draftProfile, the profile previews, the component's PNG conversion (replaced), dialogRef.close.
   * Data: team BLUE and organization NEWS ("Regional paper"); each profile carries an SVG logo.
   */
  it('writes a profile for each team and organization', async () => {
    const result = draftResult();
    result.draft.organizations = [{ shortName: 'NEWS', name: 'Harbour Herald', description: 'Regional paper' }];
    const draftProfile = vi.fn((request: { shortName: string }) =>
      of({ html: `<h2>${request.shortName} profile</h2><img src="data:image/svg+xml;base64,LOGO" alt="Logo">`, notes: [] })
    );
    const { user, close, fixture } = await draftWithDcwf(result, undefined, draftProfile);
    fixture.componentInstance.toPng = async (html: string) => html.replace('image/svg+xml', 'image/png');

    expect(draftProfile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'team', shortName: 'BLUE', name: 'Blue Team' }));
    expect(draftProfile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'organization', shortName: 'NEWS', summary: 'Regional paper' }));
    await user.click(screen.getByText('NEWS profile', { selector: 'summary' }));
    expect(screen.getByLabelText('NEWS profile')).toHaveTextContent('NEWS profile');
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    await vi.waitFor(() => expect(close).toHaveBeenCalled());
    const draft = close.mock.calls[0][0].draft;
    expect(draft.organizations[0].summary).toBe('Regional paper');
    expect(draft.organizations[0].description).toBe('<h2>NEWS profile</h2><img src="data:image/png;base64,LOGO" alt="Logo">');
    expect(draft.teams[0].description).toContain('data:image/png;base64,LOGO');
  });

  /**
   * Verifies: the review shows each move's scenario time, the read-in as it will read, and the CITE actions by move and team;
   * removing one action, or leaving out the read-in, leaves it out of the MSEL.
   * Interacts with: the Moves, Read-in and CITE actions sections, dialogRef.close.
   * Data: move 1 opens 05 Mar 2026 12:00 UTC; a read-in; BLUE has two actions in move 0 and SOC one in move 1.
   */
  it('shows the scenario clock, read-in and CITE actions for review', async () => {
    const result = draftResult();
    result.draft.moves.push({ moveNumber: 1, description: 'Next day', startMinutes: 30, situationTime: '2026-03-05T12:00:00.000Z' });
    result.draft.readIn = '<h2>Background</h2><p>The port is closed.</p>';
    result.draft.citeActions = [
      { moveNumber: 0, team: 'BLUE', description: 'Open an incident ticket' },
      { moveNumber: 0, team: 'BLUE', description: 'Brief leadership' },
      { moveNumber: 1, team: 'SOC', description: 'Isolate the affected hosts' },
    ];
    const { user, close } = await draftWithDcwf(result);

    expect(screen.getByText(/scenario time 05 Mar 2026/)).toBeInTheDocument();
    expect(screen.getByLabelText('Read-in preview')).toContainHTML('<h2>Background</h2>');
    expect(screen.getByText(/Becomes the Port closure Read-In page/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CITE actions (3)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Move 0, BLUE' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Move 1, SOC' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Brief leadership' }));
    await user.click(screen.getByRole('button', { name: 'Leave out the read-in' }));
    await user.click(screen.getByRole('button', { name: 'Create MSEL' }));

    const sent = close.mock.calls[0][0] as MselDraftImport;
    expect(sent.draft.citeActions.map((a) => a.description)).toEqual(['Open an incident ticket', 'Isolate the affected hosts']);
    expect(sent.draft.readIn).toBeNull();
    expect(sent.draft.moves[1].situationTime).toBe('2026-03-05T12:00:00.000Z');
    expect(screen.queryByLabelText('Read-in preview')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the design choices go with the draft request; the CITE assessment is offered only for a template that uses CITE.
   * Interacts with: the Design choices section, MselDataService.draftMsel.
   * Data: a CITE template; Discussion format, the mission impact matrix, 4 moves, two parallel teams, no profile pages.
   */
  it('sends the design choices with the draft', async () => {
    const { draftMsel } = await renderDraftDialog(undefined, undefined, undefined, [{ id: 'tpl-1', name: 'Template', useCite: true }]);
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

    expect(draftMsel).toHaveBeenCalledWith(expect.objectContaining({
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
   * Verifies: the review shows the scenario, the objectives, each move's purpose, decisions, notes and questions, and each inject's expected action and objective.
   * Interacts with: the Scenario and objectives section, the move and inject details.
   * Data: objective O1; move 0 with a purpose, two decisions, notes and a question; the inject serves O1.
   */
  it('shows the design for review', async () => {
    const result = draftResult();
    result.draft.scenario = { problem: 'The port is closed.', premise: 'A hurricane hit.', escalationCeiling: 'No loss of life' };
    result.draft.objectives = [{ id: 'O1', task: 'Reopen the port', condition: 'With half the staff', standard: 'Within a day' }];
    Object.assign(result.draft.moves[0], {
      purpose: 'Make them choose a lead',
      expectedDecisions: ['Choose a lead', 'Close the gates'],
      controllerNotes: 'Hold the vendor call.',
      citeQuestions: ['Who leads?'],
    });
    Object.assign(result.draft.injects[0], { expectedAction: 'Open an incident', objective: 'O1' });
    await draftWithDcwf(result);

    expect(screen.getByText('The port is closed.')).toBeInTheDocument();
    expect(screen.getByText('Escalation ceiling: No loss of life')).toBeInTheDocument();
    expect(screen.getByText(/Reopen the port/, { selector: 'li' })).toBeInTheDocument();
    const move = screen.getByLabelText('Move 0 design');
    expect(within(move).getByText('Make them choose a lead')).toBeInTheDocument();
    expect(within(move).getByText('Choose a lead; Close the gates')).toBeInTheDocument();
    expect(within(move).getByText('Hold the vendor call.')).toBeInTheDocument();
    expect(within(move).getByText('Who leads?')).toBeInTheDocument();
    expect(screen.getByText('Open an incident')).toBeInTheDocument();
    expect(screen.getByText('O1 Reopen the port')).toBeInTheDocument();
  });
});
