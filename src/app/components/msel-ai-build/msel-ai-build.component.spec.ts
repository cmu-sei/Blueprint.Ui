// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselBuildBuilder, MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { MselAiBuild, MselAiBuildService } from 'src/app/data/msel/msel-ai-build.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselAiBuildComponent } from './msel-ai-build.component';

function running(change: Partial<MselAiBuild> = {}): MselAiBuild {
  return {
    mselId: 'msel-1',
    step: 'injects',
    running: true,
    started: Date.now() - 75_000,
    stepStarted: Date.now() - 75_000,
    counts: {},
    written: 0,
    total: 0,
    errors: [],
    warnings: [],
    ...change,
  };
}

async function renderBanner(
  stage: string | null,
  build: MselAiBuild | undefined,
  saved: MselBuildStatus = { mselId: 'msel-1', stage, articles: [], profiles: [] },
  confirmed = true
) {
  const build$ = new BehaviorSubject<MselAiBuild>(build);
  // who is building, as the build service hears it; the saved status says so when the page opens
  const builder$ = new BehaviorSubject<MselBuildBuilder | null>(null);
  const buildService = {
    build$: vi.fn(() => build$),
    builder$: vi.fn(() => builder$),
    noteBuilder: vi.fn((_id: string, builder: MselBuildBuilder | null) => builder$.next(builder ?? null)),
    run: vi.fn(),
    finishNow: vi.fn(),
    cancel: vi.fn(),
    dismiss: vi.fn(),
  };
  const getMselBuildStatus = vi.fn(() => of(saved));
  const confirm = vi.fn(() => ({ afterClosed: () => of(confirmed) }));
  const discard = vi.fn();
  const rendered = await renderComponent(MselAiBuildComponent, {
    providers: [
      { provide: MselAiBuildService, useValue: buildService },
      { provide: MselBuildService, useValue: { getMselBuildStatus } },
      { provide: CrucibleDialogService, useValue: { confirm } },
      { provide: CurrentUserQuery, useValue: { getValue: () => ({ id: 'me' }) } },
    ],
    inputs: { mselId: 'msel-1', mselName: 'Deep Bite', stage, canEdit: true },
    on: { discard },
  });
  return { ...rendered, build$, builder$, buildService, getMselBuildStatus, confirm, discard, user: userEvent.setup() };
}

describe('MselAiBuildComponent', () => {
  /**
   * Verifies: nothing shows for a MSEL that is not being drafted.
   * Interacts with: nothing.
   * Data: no stage, no build.
   */
  it('shows nothing for a built MSEL', async () => {
    await renderBanner(null, undefined);

    expect(screen.queryByRole('region', { name: 'Drafting with AI' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: while the injects are written the banner says so, with the counts so far and the time, and Cancel stops it.
   * Interacts with: MselAiBuildService.cancel.
   * Data: a run 1:15 in, 12 injects and 4 CITE tasks written so far.
   */
  it('shows the injects being written and cancels', async () => {
    const { buildService, user } = await renderBanner('Injects', running({ counts: { moves: 3, injects: 12, citeActions: 4 } }));

    expect(screen.getByText('Outlining the injects, CITE tasks and read-in.')).toBeInTheDocument();
    expect(screen.getByText(/3 move briefings, 12 injects, 4 CITE tasks so far\./)).toBeInTheDocument();
    expect(screen.getByTitle('Time on this step, and in all')).toHaveTextContent('1:15');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(buildService.cancel).toHaveBeenCalledWith('msel-1');
  });

  /**
   * Verifies: with the design's plan known, the injects count runs against it.
   * Interacts with: the build's planned total.
   * Data: 20 injects written of 54 planned.
   */
  it('counts the injects against the planned total', async () => {
    const { fixture, build$ } = await renderBanner('Injects', running({ counts: { injects: 20 }, planned: 54 }));

    expect(screen.getByText(/20 of about 54 injects so far\./)).toBeInTheDocument();

    // past the plan, the count does not read as more than all
    build$.next(running({ counts: { injects: 55 }, planned: 52 }));
    fixture.detectChanges();
    expect(screen.getByText(/55 injects \(about 52 planned\) so far\./)).toBeInTheDocument();
  });

  /**
   * Verifies: while articles are written the banner counts them, says how many are being written now and names the last one
   * done, and its clock shows the step's own time with the whole run's after it.
   * Interacts with: nothing.
   * Data: 7 of 22 written, 6 being written, the last "GNN: billing outage"; the step 1:00 into a run 5:00 old.
   */
  it('counts the articles and profiles as they are written', async () => {
    const now = Date.now();
    await renderBanner('Articles', running({ step: 'articles', written: 7, total: 22, inProgress: 6, lastDone: 'GNN: billing outage', started: now - 300_000, stepStarted: now - 60_000 }));

    expect(screen.getByText('Writing each inject, Gallery article and profile.')).toBeInTheDocument();
    expect(screen.getByText(/7 of 22 done, 6 being written now\. Last done: GNN: billing outage\./)).toBeInTheDocument();
    expect(screen.getByTitle('Time on this step, and in all')).toHaveTextContent(/^1:0\d \(5:0\d in all\)$/);
  });

  /**
   * Verifies: a MSEL left part-way says what is left and offers Continue drafting, Finish without them and Discard draft, which confirms first.
   * Interacts with: MselBuildService.getMselBuildStatus, MselAiBuildService.run and finishNow, CrucibleDialogService.confirm.
   * Data: a MSEL at the Articles stage with an inject, two articles and a profile left, no run in this tab.
   */
  it('continues, finishes or discards a stopped draft', async () => {
    const { buildService, getMselBuildStatus, confirm, discard, user } = await renderBanner('Articles', undefined, {
      mselId: 'msel-1',
      stage: 'Articles',
      injects: [{ id: 'r' }],
      articles: [{ id: 'a' }, { id: 'b' }],
      profiles: [{ id: 'c' }],
    });

    expect(getMselBuildStatus).toHaveBeenCalledWith('msel-1');
    // no tab is building it, so it says the drafting stopped rather than that it is still going
    expect(screen.getByText('Drafting with AI stopped before it finished.')).toBeInTheDocument();
    expect(screen.getByText(/4 injects, articles and profiles still to write/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue drafting' }));
    expect(buildService.run).toHaveBeenCalledWith('msel-1');
    await user.click(screen.getByRole('button', { name: 'Finish without them' }));
    expect(buildService.finishNow).toHaveBeenCalledWith('msel-1');
    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard draft' }));
    expect(discard).toHaveBeenCalledWith('msel-1');
  });

  /**
   * Verifies: a MSEL whose injects are not written offers no Finish, and a failed run says why.
   * Interacts with: nothing.
   * Data: a failed run at the Injects stage.
   */
  it('says why a run failed', async () => {
    await renderBanner('Injects', running({ running: false, step: 'failed', errors: ['The draft could not be read.'] }));

    expect(screen.getByText(/Its injects are not outlined yet\./)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The draft could not be read.');
    expect(screen.queryByRole('button', { name: 'Finish without them' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue drafting' })).toBeInTheDocument();
  });

  /**
   * Verifies: a finished build says so with its notes, and closes.
   * Interacts with: MselAiBuildService.dismiss.
   * Data: a done run with one note.
   */
  it('says the draft is done', async () => {
    const { buildService, user } = await renderBanner(null, running({ running: false, step: 'done', warnings: ['Created the scoring model in CITE.'] }));

    expect(screen.getByText('Drafted with AI.')).toBeInTheDocument();
    expect(screen.getByText('1 note from the draft')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(buildService.dismiss).toHaveBeenCalledWith('msel-1');
  });
  /**
   * Verifies: a MSEL another person is building names them and offers Take over, not Continue drafting or Discard draft;
   * Take over runs the build here with takeOver.
   * Interacts with: MselBuildService.getMselBuildStatus (names the builder), MselAiBuildService.run.
   * Data: Grace Hopper is building the MSEL; this tab runs nothing.
   */
  it('names who else is building and takes it over', async () => {
    const { buildService, user } = await renderBanner('Articles', undefined, {
      mselId: 'msel-1',
      stage: 'Articles',
      articles: [{ id: 'a' }],
      profiles: [],
      builder: { userId: 'grace', userName: 'Grace Hopper' },
    });

    expect(screen.getByText('Grace Hopper is building this MSEL with AI.')).toBeInTheDocument();
    expect(screen.getByText('Take over to build it here; the other tab stops, and what it wrote is kept.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue drafting' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard draft' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Take over' }));
    expect(buildService.run).toHaveBeenCalledWith('msel-1', true);
  });

  /**
   * Verifies: the planner's own build in another tab is called that, and when that tab stops the banner offers Continue drafting.
   * Interacts with: MselAiBuildService.builder$.
   * Data: the current user builds in another tab, then no tab does.
   */
  it('tells the planner their other tab is building it', async () => {
    const { builder$ } = await renderBanner('Articles', undefined, {
      mselId: 'msel-1',
      stage: 'Articles',
      articles: [{ id: 'a' }],
      profiles: [],
      builder: { userId: 'me', userName: 'Ada Lovelace' },
    });

    expect(screen.getByText('You are building this MSEL with AI in another tab.')).toBeInTheDocument();

    builder$.next(null);
    await screen.findByRole('button', { name: 'Continue drafting' });
    expect(screen.getByText('Drafting with AI stopped before it finished.')).toBeInTheDocument();
  });
});
