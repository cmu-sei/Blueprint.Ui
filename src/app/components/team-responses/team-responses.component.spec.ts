// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { CiteTeamResponses, CiteTeamResponsesStatus } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TeamResponsesComponent } from './team-responses.component';

const ANSWERED: CiteTeamResponses = {
  mselId: 'msel-1',
  teamId: 'team-blue',
  moveNumber: 1,
  status: CiteTeamResponsesStatus.Answered,
  currentMoveNumber: 1,
  scoringModelDescription: 'Incident Response',
  teamSubmission: {
    score: 7.5,
    status: 'Active',
    dateModified: '2026-11-20T17:45:00Z',
    isAverage: false,
    categories: [
      {
        scoringCategoryId: 'cat-containment',
        description: 'Containment',
        displayOrder: 1,
        score: 5,
        selectedOptions: [{ description: 'Isolated', value: 5, isModifier: false, selectedCount: 0 }],
        comments: [{ optionDescription: 'Isolated', text: 'Pulled the host off the network' }],
      },
      {
        scoringCategoryId: 'cat-detection',
        description: 'Detection',
        displayOrder: 2,
        score: 0,
        selectedOptions: [],
        comments: [],
      },
    ],
  },
  officialSubmission: { score: 9, isAverage: false, categories: [] },
  teamAverageSubmission: {
    score: 4,
    isAverage: true,
    categories: [
      {
        scoringCategoryId: 'cat-containment',
        description: 'Containment',
        displayOrder: 1,
        score: 4,
        selectedOptions: [{ description: 'Monitored', value: 1, isModifier: false, selectedCount: 2 }],
        comments: [],
      },
    ],
  },
};

async function renderPanel(inputs: Partial<{
  responses: CiteTeamResponses | null;
  loading: boolean;
  error: string | null;
  teamName: string;
  prompt: string;
}>) {
  return renderComponent(TeamResponsesComponent, { inputs });
}

describe('TeamResponsesComponent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Verifies: an answered submission lists each category with its selected options, values, comments and scores, the team's total and when it last changed.
   * Interacts with: responses and teamName inputs only; the panel fetches nothing.
   * Data: TZ America/New_York; Blue Team answered Containment (Isolated, 5, with a comment) and nothing in Detection; changed 20 Nov 2026 17:45 UTC.
   */
  it('shows the team answers category by category', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    const { container } = await renderPanel({ responses: ANSWERED, teamName: 'Blue' });

    expect(screen.getByText('Team Responses')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Incident Response')).toBeInTheDocument();
    const team = container.querySelector('.team-responses-submission');
    expect(team.querySelector('.team-responses-submission-header').textContent).toContain('Score 7.5');
    expect(team.querySelector('.team-responses-time').textContent.trim()).toBe('Nov 20, 12:45 PM EST');
    expect(Array.from(team.querySelectorAll('.team-responses-category-name'), (e) => e.textContent)).toEqual([
      'Containment',
      'Detection',
    ]);
    expect(team.querySelector('.team-responses-options li').textContent).toContain('Isolated');
    expect(team.querySelector('.team-responses-option-value').textContent).toBe('(5)');
    expect(screen.getByText('Pulled the host off the network')).toBeInTheDocument();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(screen.queryByText('Team has not answered.')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the official and team-average submissions follow the team's own, and an average says how many chose each option.
   * Interacts with: responses input.
   * Data: official score 9; team average score 4 with Monitored chosen by 2.
   */
  it('shows the official and team average submissions after the team', async () => {
    const { container } = await renderPanel({ responses: ANSWERED });

    expect(Array.from(container.querySelectorAll('.team-responses-submission-label'), (e) => e.textContent)).toEqual([
      'Team',
      'Official',
      'Team average',
    ]);
    expect(screen.getByText('chosen by 2')).toBeInTheDocument();
  });

  /**
   * Verifies: a team that has not answered says so, still showing the official submission.
   * Interacts with: responses input.
   * Data: status NotAnswered, no team submission, official score 9.
   */
  it('says the team has not answered', async () => {
    const { container } = await renderPanel({
      responses: { ...ANSWERED, status: CiteTeamResponsesStatus.NotAnswered, teamSubmission: null, teamAverageSubmission: null },
    });

    expect(screen.getByText('Team has not answered.')).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('.team-responses-submission-label'), (e) => e.textContent)).toEqual([
      'Official',
    ]);
  });

  /**
   * Verifies: each state with nothing to show displays the API's explanation instead of answers, and only Unavailable is styled as an error.
   * Interacts with: responses input.
   * Data: NotPushed, TeamNotInCite, MoveNotInCite ("No CITE move 3..."), MoveNotStarted and Unavailable, each with a message and the answered submissions still attached.
   */
  it.each([
    [CiteTeamResponsesStatus.NotPushed, 'This MSEL has not been pushed to CITE.', false],
    [CiteTeamResponsesStatus.TeamNotInCite, 'This team has no CITE team type, so it is not in CITE.', false],
    [CiteTeamResponsesStatus.MoveNotInCite, 'No CITE move 3. The move was added after the push.', false],
    [CiteTeamResponsesStatus.MoveNotStarted, 'CITE is on move 1, so move 3 has not started.', false],
    [CiteTeamResponsesStatus.Unavailable, 'CITE could not be reached.', true],
  ])('explains %s instead of showing answers', async (status, message, isError) => {
    const { container } = await renderPanel({ responses: { ...ANSWERED, status, message } });

    const note = screen.getByText(message);
    expect(note).toBeInTheDocument();
    expect(note.classList.contains('team-responses-error')).toBe(isError);
    expect(container.querySelector('.team-responses-submission')).toBeNull();
  });

  /**
   * Verifies: while loading, a progress bar shows and the prompt does not.
   * Interacts with: loading and prompt inputs.
   * Data: loading true, no responses yet.
   */
  it('shows a progress bar while loading', async () => {
    const { container } = await renderPanel({ loading: true, prompt: 'Choose a team' });

    expect(container.querySelector('mat-progress-bar')).not.toBeNull();
    expect(screen.queryByText('Choose a team')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a load failure shows the error and hides answers loaded earlier.
   * Interacts with: error and responses inputs.
   * Data: error "Team responses could not be loaded." alongside answered responses.
   */
  it('shows a load error in place of the answers', async () => {
    const { container } = await renderPanel({ responses: ANSWERED, error: 'Team responses could not be loaded.' });

    expect(screen.getByText('Team responses could not be loaded.')).toBeInTheDocument();
    expect(container.querySelector('.team-responses-submission')).toBeNull();
  });

  /**
   * Verifies: with no team and nothing loading, the prompt is shown.
   * Interacts with: prompt input.
   * Data: no responses, loading false.
   */
  it('shows the prompt when there is no team', async () => {
    await renderPanel({ prompt: 'Choose a team in Assess Team to see its CITE answers.' });

    expect(screen.getByText('Choose a team in Assess Team to see its CITE answers.')).toBeInTheDocument();
  });
});
