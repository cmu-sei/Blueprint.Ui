// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';
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
  const buildService = {
    build$: vi.fn(() => build$),
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
    ],
    inputs: { mselId: 'msel-1', mselName: 'Deep Bite', stage, canEdit: true },
    on: { discard },
  });
  return { ...rendered, build$, buildService, getMselBuildStatus, confirm, discard, user: userEvent.setup() };
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
    const { buildService, user } = await renderBanner('Injects', running({ counts: { injects: 12, citeActions: 4 } }));

    expect(screen.getByText('Writing the injects, CITE tasks and read-in.')).toBeInTheDocument();
    expect(screen.getByText(/12 injects, 4 CITE tasks so far\./)).toBeInTheDocument();
    expect(screen.getByTitle('Time drafting')).toHaveTextContent('1:15');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(buildService.cancel).toHaveBeenCalledWith('msel-1');
  });

  /**
   * Verifies: while articles are written the banner counts them.
   * Interacts with: nothing.
   * Data: 7 of 22 written.
   */
  it('counts the articles and profiles as they are written', async () => {
    await renderBanner('Articles', running({ step: 'articles', written: 7, total: 22 }));

    expect(screen.getByText('Writing the Gallery articles and profiles.')).toBeInTheDocument();
    expect(screen.getByText(/7 of 22\./)).toBeInTheDocument();
  });

  /**
   * Verifies: a MSEL left part-way says what is left and offers Continue drafting, Finish without them and Discard draft, which confirms first.
   * Interacts with: MselBuildService.getMselBuildStatus, MselAiBuildService.run and finishNow, CrucibleDialogService.confirm.
   * Data: a MSEL at the Articles stage with two articles and a profile left, no run in this tab.
   */
  it('continues, finishes or discards a stopped draft', async () => {
    const { buildService, getMselBuildStatus, confirm, discard, user } = await renderBanner('Articles', undefined, {
      mselId: 'msel-1',
      stage: 'Articles',
      articles: [{ id: 'a' }, { id: 'b' }],
      profiles: [{ id: 'c' }],
    });

    expect(getMselBuildStatus).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText(/3 Gallery articles and profiles still to write/)).toBeInTheDocument();

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

    expect(screen.getByText(/Its injects are not written yet\./)).toBeInTheDocument();
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
});
