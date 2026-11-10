// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { MselBuildBuilder, MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';
import { AiBuilderChange, AiBuildTakenOver, AiDraftProgress, SignalRService } from 'src/app/services/signalr.service';
import { MselAiBuild, MselAiBuildService } from './msel-ai-build.service';

const ARTICLES: MselBuildStatus = {
  mselId: 'msel-1',
  stage: 'Articles',
  injects: [{ id: 'event-2', kind: 'inject', name: 'Check in' }],
  articles: [{ id: 'event-1', kind: 'article', name: 'Cables cut' }],
  profiles: [{ id: 'team-1', kind: 'team', name: 'SOC' }],
  warnings: [],
};

function setup(api: Partial<Record<keyof MselBuildService, (...args: never[]) => Observable<unknown>>> = {}) {
  const status = [{ mselId: 'msel-1', stage: 'Injects', plannedInjects: 54, articles: [], profiles: [] }, { ...ARTICLES, articles: [], profiles: [] }];
  const stub = {
    getMselBuildStatus: vi.fn(() => of(status.shift() ?? { mselId: 'msel-1', stage: null })),
    writeMselInjects: vi.fn(() => of({ ...ARTICLES, warnings: ['Dropped a row with no time.'] })),
    writeMselRow: vi.fn(() => of({ html: '<p>Check in with each lead.</p>' })),
    writeMselArticle: vi.fn(() => of({ fieldName: 'Description', html: '<svg></svg>' })),
    saveMselArticle: vi.fn(() => of(null)),
    writeMselProfile: vi.fn(() => of({ html: '<p>SOC</p>' })),
    saveMselProfile: vi.fn(() => of(null)),
    finishMselBuild: vi.fn(() => of({ mselId: 'msel-1', stage: null, warnings: ['Created the scoring model in CITE.'] })),
    claimMselBuild: vi.fn(() => of({ userId: 'user-1', userName: 'Ada Lovelace' })),
    releaseMselBuild: vi.fn(() => of(null)),
    ...api,
  };
  const progress = new Subject<AiDraftProgress>();
  const builderChanged = new Subject<AiBuilderChange>();
  const takenOver = new Subject<AiBuildTakenOver>();
  TestBed.configureTestingModule({
    providers: [
      { provide: MselBuildService, useValue: stub },
      {
        provide: SignalRService,
        useValue: { aiDraftProgress$: progress, aiBuilderChanged$: builderChanged, aiBuildTakenOver$: takenOver, connectionId: 'tab-1' },
      },
    ],
  });
  const service = TestBed.inject(MselAiBuildService);
  // the browser draws SVG as PNG; here an SVG becomes a marked PNG and anything else is left alone
  service.toPng = async (html) => html.replace('<svg></svg>', '<img src="data:image/png">');
  const builds: MselAiBuild[] = [];
  service.build$('msel-1').subscribe((b) => builds.push(b));
  const finished: string[] = [];
  service.finished$.subscribe((id) => finished.push(id));
  const builders: (MselBuildBuilder | null)[] = [];
  service.builder$('msel-1').subscribe((b) => builders.push(b));
  return { service, api: stub, progress, builderChanged, takenOver, builds, builders, finished, last: () => builds[builds.length - 1] };
}

// lets the PNG drawing, a promise, settle
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MselAiBuildService', () => {
  /**
   * Verifies: a run outlines the injects, then writes each row's text, each article and profile, saves an article again with its graphics as PNG, then finishes and says so.
   * Interacts with: MselBuildService getMselBuildStatus, writeMselInjects, writeMselRow, writeMselArticle, saveMselArticle, writeMselProfile, finishMselBuild.
   * Data: a MSEL at the Injects stage whose outline gives one row, one article (with SVG) and one profile (without).
   */
  it('builds the MSEL step by step', async () => {
    const { service, api, last, finished } = setup();

    service.run('msel-1');
    await settle();

    expect(api.writeMselInjects).toHaveBeenCalledWith('msel-1', 'tab-1');
    expect(api.writeMselRow).toHaveBeenCalledWith('msel-1', 'event-2', 'tab-1');
    expect(api.writeMselArticle).toHaveBeenCalledWith('msel-1', 'event-1', 'tab-1');
    expect(api.saveMselArticle).toHaveBeenCalledWith('msel-1', 'event-1', 'tab-1', { html: '<img src="data:image/png">' });
    expect(api.writeMselProfile).toHaveBeenCalledWith('msel-1', 'team-1', 'tab-1');
    expect(api.saveMselProfile).not.toHaveBeenCalled();
    expect(api.finishMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1');
    expect(last()).toMatchObject({ step: 'done', running: false, written: 3, total: 3, planned: 54, inProgress: 0 });
    // the last item done is named, so the count is not the only sign of progress
    expect(['Check in', 'Cables cut', 'SOC']).toContain(last().lastDone);
    expect(last().warnings).toEqual(['Dropped a row with no time.', 'Created the scoring model in CITE.']);
    expect(finished).toEqual(['msel-1']);
  });

  /**
   * Verifies: the rows, articles and profiles are written only as many at once as the API says, even though the API sends the number as a string.
   * Interacts with: MselBuildService writeMselInjects, writeMselRow, writeMselArticle, writeMselProfile.
   * Data: three items to write, parallel "2" as the API writes it, and writes that never answer.
   */
  it('writes only as many items at once as the API says', async () => {
    const writes = [vi.fn(() => NEVER), vi.fn(() => NEVER), vi.fn(() => NEVER)];
    const { service, last } = setup({
      writeMselInjects: vi.fn(() => of({ ...ARTICLES, parallel: '2' as unknown as number })),
      writeMselRow: writes[0],
      writeMselArticle: writes[1],
      writeMselProfile: writes[2],
    });

    service.run('msel-1');
    await settle();

    const started = writes.reduce((sum, write) => sum + write.mock.calls.length, 0);
    expect(started).toBe(2);
    expect(last()).toMatchObject({ step: 'articles', total: 3, written: 0, inProgress: 2 });
  });

  /**
   * Verifies: what the server replaced in a row or an article, values outside the scenario's indicator set, joins the build's warnings.
   * Interacts with: MselBuildService writeMselRow, writeMselArticle.
   * Data: a row and an article whose answers carry a warning each.
   */
  it('adds what the check replaced in each item to the warnings', async () => {
    const { service, last } = setup({
      writeMselRow: vi.fn(() => of({ html: '<p>Block it.</p>', warnings: ['Replaced 1 value not in the scenario\'s indicator set in "Check in": 8.8.4.4 with 203.0.113.10.'] })),
      writeMselArticle: vi.fn(() => of({ fieldName: 'Description', html: '<p>Beacon</p>', warnings: ['Replaced 2 values not in the scenario\'s indicator set in "Cables cut".'] })),
    });

    service.run('msel-1');
    await settle();

    expect(last().warnings).toEqual(
      expect.arrayContaining([
        'Replaced 1 value not in the scenario\'s indicator set in "Check in": 8.8.4.4 with 203.0.113.10.',
        'Replaced 2 values not in the scenario\'s indicator set in "Cables cut".',
      ])
    );
    expect(last().warnings).toHaveLength(4);
  });

  /**
   * Verifies: an article that fails stops the run before the finish, saying which, with what is left.
   * Interacts with: MselBuildService.writeMselArticle, finishMselBuild.
   * Data: the article call fails; the status after it still lists the article.
   */
  it('stops before the finish when an article fails', async () => {
    const { service, api, last } = setup({
      writeMselArticle: vi.fn(() => throwError(() => ({ error: { title: 'The model declined.' } }))),
      getMselBuildStatus: vi
        .fn()
        .mockReturnValueOnce(of({ mselId: 'msel-1', stage: 'Articles', ...ARTICLES }))
        .mockReturnValueOnce(of({ ...ARTICLES, injects: [], profiles: [] })),
    });

    service.run('msel-1');
    await settle();

    expect(api.writeMselInjects).not.toHaveBeenCalled();
    expect(api.finishMselBuild).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ step: 'stopped', running: false, errors: ['Cables cut: The model declined.'] });
    expect(last().remaining.articles).toHaveLength(1);
  });

  /**
   * Verifies: Finish without them finishes with what was written.
   * Interacts with: MselBuildService.finishMselBuild.
   * Data: a MSEL at the Articles stage with one article left.
   */
  it('finishes without the articles that are left', async () => {
    const { service, api, last } = setup({ getMselBuildStatus: vi.fn(() => of(ARTICLES)) });

    service.finishNow('msel-1');
    await settle();

    expect(api.writeMselArticle).not.toHaveBeenCalled();
    expect(api.finishMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1');
    expect(last()).toMatchObject({ step: 'done', running: false });
  });

  /**
   * Verifies: while the injects are written, the counts the API streams show; Cancel stops the run and reads what is left.
   * Interacts with: SignalRService.aiDraftProgress$, MselBuildService.getMselBuildStatus.
   * Data: an inject call that never answers; progress for this MSEL and for another.
   */
  it('shows the injects being written and cancels', async () => {
    const { service, api, progress, last } = setup({ writeMselInjects: vi.fn(() => NEVER) });
    service.run('msel-1');

    progress.next({ operation: 'injects', mselId: 'msel-1', characters: 4000, counts: { moves: 3, injects: 12 }, done: false });
    progress.next({ operation: 'injects', mselId: 'msel-2', characters: 10, counts: { injects: 1 }, done: false });
    expect(last()).toMatchObject({ step: 'injects', running: true, counts: { moves: 3, injects: 12 } });

    service.cancel('msel-1');

    expect(last()).toMatchObject({ step: 'stopped', running: false });
    expect(api.getMselBuildStatus).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: an inject step that fails stops the run and says why.
   * Interacts with: MselBuildService.writeMselInjects.
   * Data: the API answers with a title and a stack trace as its detail.
   */
  /**
   * Verifies: create sends the design under the id the dialog chose, says so while the MSEL is created, then tells its page the MSEL
   * exists and runs the build.
   * Interacts with: MselBuildService.createMselFromDesign, created$, then the same steps as run.
   * Data: a design for msel-1; the API answers msel-1.
   */
  it('creates the MSEL under the chosen id and then builds it', async () => {
    const created$ = new Subject<{ msel: { id: string } }>();
    const { service, api, builds, last } = setup({ createMselFromDesign: vi.fn(() => created$) });
    const created: { requestedId: string; mselId: string }[] = [];
    service.created$.subscribe((c) => created.push(c));

    service.create({ mselId: 'msel-1', templateMselId: 'tpl-1', draft: { name: 'Deep Bite' } });
    expect(api.createMselFromDesign).toHaveBeenCalledWith(expect.objectContaining({ mselId: 'msel-1', templateMselId: 'tpl-1' }));
    expect(last()).toMatchObject({ step: 'creating', running: true });
    expect(service.isCreating('msel-1')).toBe(true);

    created$.next({ msel: { id: 'msel-1' } });
    await settle();
    expect(created).toEqual([{ requestedId: 'msel-1', mselId: 'msel-1' }]);
    expect(api.writeMselInjects).toHaveBeenCalledWith('msel-1', 'tab-1');
    expect(builds.some((b) => b?.step === 'injects')).toBe(true);
    expect(service.isCreating('msel-1')).toBe(false);
  });

  /**
   * Verifies: a create that fails says why, keeps the design, and can be tried again from the MSEL's page.
   * Interacts with: MselBuildService.createMselFromDesign (fails, then succeeds), retryCreate.
   * Data: a 500 then the created MSEL.
   */
  it('keeps a failed create to try again', async () => {
    const answers = [throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'CITE is down' } })), of({ msel: { id: 'msel-1' } })];
    const { service, api, last } = setup({ createMselFromDesign: vi.fn(() => answers.shift()) });

    service.create({ mselId: 'msel-1', templateMselId: 'tpl-1' });
    expect(last()).toMatchObject({ step: 'createFailed', running: false });
    expect(last().errors[0]).toContain('CITE is down');
    expect(service.isCreating('msel-1')).toBe(true);

    service.retryCreate('msel-1');
    await settle();
    expect(api.createMselFromDesign).toHaveBeenCalledTimes(2);
    expect(api.writeMselInjects).toHaveBeenCalledWith('msel-1', 'tab-1');
  });

  it('says why the injects failed', () => {
    const { service, last } = setup({
      writeMselInjects: vi.fn(() => throwError(() => ({ error: { title: 'The draft could not be read.', detail: '   at Blueprint.Api...' } }))),
    });

    service.run('msel-1');

    expect(last()).toMatchObject({ step: 'failed', running: false, errors: ['The draft could not be read.'] });
  });
  /**
   * Verifies: a run claims the build for this tab first, then builds; the build is no tab's once it is done.
   * Interacts with: MselBuildService.claimMselBuild, builder$.
   * Data: the hub connection tab-1.
   */
  it('claims the build for this tab before it writes', async () => {
    const { service, api, builders } = setup();

    service.run('msel-1');
    await settle();

    expect(api.claimMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1', false);
    expect(builders).toContainEqual({ userId: 'user-1', userName: 'Ada Lovelace' });
    expect(builders[builders.length - 1]).toBeNull();
  });

  /**
   * Verifies: when another tab has the build, the run writes nothing and says who has it, without calling it a failure.
   * Interacts with: MselBuildService.claimMselBuild (409), getMselBuildStatus (names the builder).
   * Data: Grace Hopper is building the MSEL.
   */
  it('writes nothing while another tab has the build', async () => {
    const { service, api, last, builders } = setup({
      claimMselBuild: vi.fn(() =>
        throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Grace Hopper is building this MSEL with AI. Take over to build it here.' } }))
      ),
      getMselBuildStatus: vi.fn(() => of({ mselId: 'msel-1', stage: 'Articles', builder: { userId: 'user-2', userName: 'Grace Hopper' } })),
    });

    service.run('msel-1');
    await settle();

    expect(api.writeMselInjects).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ step: 'busy', running: false });
    expect(builders[builders.length - 1]).toEqual({ userId: 'user-2', userName: 'Grace Hopper' });
    expect(api.releaseMselBuild).not.toHaveBeenCalled();
  });

  /**
   * Verifies: Take over claims the build with takeOver, so the other tab is the one that stops.
   * Interacts with: MselBuildService.claimMselBuild.
   */
  it('takes the build over from another tab', async () => {
    const { service, api } = setup();

    service.run('msel-1', true);
    await settle();

    expect(api.claimMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1', true);
  });

  /**
   * Verifies: a tab whose build another tab takes over stops writing at once and says who took it, keeping what it saved.
   * Interacts with: SignalRService.aiBuildTakenOver$, MselBuildService.writeMselInjects (never answers).
   * Data: Grace Hopper takes the build over while the injects are being written.
   */
  it('stops when another tab takes the build over', () => {
    const { service, api, takenOver, last } = setup({ writeMselInjects: vi.fn(() => NEVER) });
    service.run('msel-1');
    expect(last()).toMatchObject({ step: 'injects', running: true });

    takenOver.next({ mselId: 'msel-1', userName: 'Grace Hopper' });

    expect(last()).toMatchObject({ step: 'takenOver', running: false, errors: ['Grace Hopper took over building this MSEL. What was written here is saved.'] });
    // it no longer has the build, so it frees nothing
    expect(api.releaseMselBuild).not.toHaveBeenCalled();
  });

  /**
   * Verifies: Cancel frees the build so another tab can continue it, and a failed run frees it too.
   * Interacts with: MselBuildService.releaseMselBuild.
   */
  it('frees the build when it is cancelled or fails', () => {
    const cancelled = setup({ writeMselInjects: vi.fn(() => NEVER) });
    cancelled.service.run('msel-1');
    cancelled.service.cancel('msel-1');
    expect(cancelled.api.releaseMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1');

    TestBed.resetTestingModule();
    const failed = setup({ writeMselInjects: vi.fn(() => throwError(() => ({ error: { title: 'Bedrock is down.' } }))) });
    failed.service.run('msel-1');
    expect(failed.last()).toMatchObject({ step: 'failed' });
    expect(failed.api.releaseMselBuild).toHaveBeenCalledWith('msel-1', 'tab-1');
  });

  /**
   * Verifies: who is building, as the hub says when it changes, reaches every tab on the MSEL.
   * Interacts with: SignalRService.aiBuilderChanged$, builder$.
   */
  it('follows who is building as the hub says', () => {
    const { builderChanged, builders } = setup();

    builderChanged.next({ mselId: 'msel-1', builder: { userId: 'user-2', userName: 'Grace Hopper' } });
    builderChanged.next({ mselId: 'other', builder: { userId: 'user-3', userName: 'Someone' } });
    builderChanged.next({ mselId: 'msel-1', builder: null });

    expect(builders).toEqual([null, { userId: 'user-2', userName: 'Grace Hopper' }, null]);
  });
});
