// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MselAssistApplyResult, MselAssistResult } from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { MselCompetencyDataService } from 'src/app/data/msel-competency/msel-competency-data.service';
import { TeamCompetencyDataService } from 'src/app/data/team-competency/team-competency-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselAssistantComponent } from './msel-assistant.component';

const PROPOSAL: MselAssistResult = {
  reply: 'Adding a CERT team with the analyst work role.',
  changes: [
    { op: 'team.add', shortName: 'CERT', name: 'National CERT', label: 'Add team CERT (National CERT)' },
    { op: 'competency.add', target: 'CERT', idNumber: 'CS-511', label: 'Add CS-511 Cyber Defense Analyst to team CERT' },
  ],
  warnings: ['Add team BLUE (BLUE): left out, there is already a team BLUE.'],
};

async function renderAssistant(answer: () => any = () => of(PROPOSAL), applied: () => any = () => of<MselAssistApplyResult>({ results: [] })) {
  const askAssistant = vi.fn(answer);
  const applyAssistantChanges = vi.fn(applied);
  const loaders = {
    teams: vi.fn(), organizations: vi.fn(), cards: vi.fn(), cardTeams: vi.fn(), mselCompetencies: vi.fn(), teamCompetencies: vi.fn(),
    moves: vi.fn(), scenarioEvents: vi.fn(), dataValues: vi.fn(),
  };
  const rendered = await renderComponent(MselAssistantComponent, {
    inputs: { mselId: 'msel-1' },
    providers: [
      { provide: MselDataService, useValue: { askAssistant, applyAssistantChanges } as Partial<MselDataService> },
      { provide: TeamDataService, useValue: { loadByMsel: loaders.teams } },
      { provide: OrganizationDataService, useValue: { loadByMsel: loaders.organizations } },
      { provide: CardDataService, useValue: { loadByMsel: loaders.cards } },
      { provide: CardTeamDataService, useValue: { getCardTeamsFromApi: loaders.cardTeams } },
      { provide: MselCompetencyDataService, useValue: { loadByMsel: loaders.mselCompetencies } },
      { provide: TeamCompetencyDataService, useValue: { loadByMsel: loaders.teamCompetencies } },
      { provide: MoveDataService, useValue: { loadByMsel: loaders.moves } },
      { provide: ScenarioEventDataService, useValue: { loadByMsel: loaders.scenarioEvents } },
      { provide: DataValueDataService, useValue: { loadByMsel: loaders.dataValues } },
    ],
  });
  return { ...rendered, askAssistant, applyAssistantChanges, loaders, user: userEvent.setup() };
}

async function askFor(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: 'What should change?' }), text);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('MselAssistantComponent', () => {
  /**
   * Verifies: before anything is asked, the panel says what it can change and offers example requests that ask straight away.
   * Interacts with: the example buttons, MselDataService.askAssistant.
   * Data: the first example, "Add a CERT team and a legal team, each with its own Gallery card".
   */
  it('offers examples that ask when chosen', async () => {
    const { askAssistant, user } = await renderAssistant();

    expect(screen.getByText(/Teams, organizations, Gallery cards,\s+competencies, moves and injects can be changed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a CERT team and a legal team, each with its own Gallery card' }));

    expect(askAssistant).toHaveBeenCalledWith('msel-1', { prompt: 'Add a CERT team and a legal team, each with its own Gallery card', history: [] });
  });

  /**
   * Verifies: the reply, each proposed change as a ticked checkbox, and what was left out are shown, and nothing is applied yet.
   * Interacts with: MselDataService.askAssistant, the proposed-change checkboxes.
   * Data: a CERT team and CS-511 on it proposed; BLUE left out as already there.
   */
  it('shows the proposed changes for review', async () => {
    const { applyAssistantChanges, user } = await renderAssistant();

    await askFor(user, 'Add a CERT team');

    expect(screen.getByText('Add a CERT team')).toBeInTheDocument();
    expect(screen.getByText('Adding a CERT team with the analyst work role.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Add team CERT (National CERT)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Add CS-511 Cyber Defense Analyst to team CERT' })).toBeChecked();
    expect(screen.getByText('Add team BLUE (BLUE): left out, there is already a team BLUE.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 2 changes' })).toBeEnabled();
    expect(applyAssistantChanges).not.toHaveBeenCalled();
  });

  /**
   * Verifies: only the ticked changes are applied, each result is shown, and the lists the changes touch are reloaded.
   * Interacts with: the checkboxes, Apply, MselDataService.applyAssistantChanges, the team/organization/card/competency/move/event loaders.
   * Data: the competency unticked; the team applied; the apply reports it with a refused one alongside.
   */
  it('applies the ticked changes and shows how each went', async () => {
    const { applyAssistantChanges, loaders, user } = await renderAssistant(undefined, () => of({
      results: [
        { label: 'Add team CERT (National CERT)', applied: true },
        { label: 'Add Gallery card Wall', applied: false, error: 'You do not have permission to make this change.' },
      ],
    }));
    await askFor(user, 'Add a CERT team');

    await user.click(screen.getByRole('checkbox', { name: 'Add CS-511 Cyber Defense Analyst to team CERT' }));
    await user.click(screen.getByRole('button', { name: 'Apply 1 change' }));

    expect(applyAssistantChanges).toHaveBeenCalledWith('msel-1', { changes: [PROPOSAL.changes[0]] });
    expect(screen.getByText('Add team CERT (National CERT)', { selector: 'li span' })).toBeInTheDocument();
    expect(screen.getByText(/Add Gallery card Wall\s*: You do not have permission to make this change\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
    for (const load of Object.values(loaders)) {
      expect(load).toHaveBeenCalledWith('msel-1');
    }
  });

  /**
   * Verifies: a question from the assistant is shown, with no changes to apply, and the follow-up carries the conversation.
   * Interacts with: MselDataService.askAssistant, called twice.
   * Data: "Which team should get the card?" answered with "BLUE".
   */
  it('shows a question and sends the conversation with the answer', async () => {
    const { askAssistant, user } = await renderAssistant(() => of({ reply: '', question: 'Which team should get the card?', changes: [], warnings: [] }));

    await askFor(user, 'Add a card');
    expect(screen.getByText('Which team should get the card?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
    await askFor(user, 'BLUE');

    expect(askAssistant).toHaveBeenLastCalledWith('msel-1', {
      prompt: 'BLUE',
      history: [
        { role: 'planner', text: 'Add a card' },
        { role: 'assistant', text: 'Which team should get the card?' },
      ],
    });
  });

  /**
   * Verifies: a failed request is shown in the API's words, and the planner can ask again.
   * Interacts with: MselDataService.askAssistant erroring.
   * Data: a 409 titled "AI drafting is not enabled on this server."
   */
  it('shows why a request failed', async () => {
    const { user } = await renderAssistant(() => throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'AI drafting is not enabled on this server.' } })));

    await askFor(user, 'Add a team');

    expect(screen.getByRole('alert')).toHaveTextContent('AI drafting is not enabled on this server.');
    expect(screen.getByRole('textbox', { name: 'What should change?' })).toBeEnabled();
  });

  /**
   * Verifies: Enter sends the request and Shift+Enter starts a new line instead.
   * Interacts with: the prompt's keydown handler.
   * Data: "Add a team", then a second line.
   */
  it('sends on Enter but not on Shift+Enter', async () => {
    const { askAssistant, user } = await renderAssistant();
    const prompt = screen.getByRole('textbox', { name: 'What should change?' });

    await user.type(prompt, 'Add a team{Shift>}{Enter}{/Shift}with a card');
    expect(askAssistant).not.toHaveBeenCalled();
    await user.type(prompt, '{Enter}');

    expect(askAssistant).toHaveBeenCalledWith('msel-1', { prompt: 'Add a team\nwith a card', history: [] });
  });

  /**
   * Verifies: Apply turns an inject's SVG graphics into PNG before sending the changes.
   * Interacts with: the component's PNG conversion (replaced, as jsdom cannot draw), MselDataService.applyAssistantChanges.
   * Data: an inject.add whose Details hold one SVG logo, and its plain Title.
   */
  it('sends inject values with their graphics as PNG', async () => {
    const article: MselAssistResult = {
      reply: 'Adding the advisory.',
      changes: [{ op: 'inject.add', minutes: 30, values: { Title: 'Advisory', Details: '<img src="data:image/svg+xml;base64,LOGO" alt="Logo">' }, label: 'Add inject at 0:30: Advisory' }],
      warnings: [],
    };
    const { applyAssistantChanges, fixture, user } = await renderAssistant(() => of(article));
    fixture.componentInstance.toPng = async (html: string) => html.replace('image/svg+xml', 'image/png');
    await askFor(user, 'Add an advisory');

    await user.click(screen.getByRole('button', { name: 'Apply 1 change' }));

    await vi.waitFor(() => expect(applyAssistantChanges).toHaveBeenCalled());
    const sent = (applyAssistantChanges.mock.calls[0] as unknown[])[1] as { changes: { values: Record<string, string> }[] };
    expect(sent.changes[0].values).toEqual({
      Title: 'Advisory',
      Details: '<img src="data:image/png;base64,LOGO" alt="Logo">',
    });
  });
});
