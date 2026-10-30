// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';
import { AiDraftProgress, SignalRService } from 'src/app/services/signalr.service';
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
  const status = [{ mselId: 'msel-1', stage: 'Injects', articles: [], profiles: [] }, { ...ARTICLES, articles: [], profiles: [] }];
  const stub = {
    getMselBuildStatus: vi.fn(() => of(status.shift() ?? { mselId: 'msel-1', stage: null })),
    writeMselInjects: vi.fn(() => of({ ...ARTICLES, warnings: ['Dropped a row with no time.'] })),
    writeMselRow: vi.fn(() => of({ html: '<p>Check in with each lead.</p>' })),
    writeMselArticle: vi.fn(() => of({ fieldName: 'Description', html: '<svg></svg>' })),
    saveMselArticle: vi.fn(() => of(null)),
    writeMselProfile: vi.fn(() => of({ html: '<p>SOC</p>' })),
    saveMselProfile: vi.fn(() => of(null)),
    finishMselBuild: vi.fn(() => of({ mselId: 'msel-1', stage: null, warnings: ['Created the scoring model in CITE.'] })),
    ...api,
  };
  const progress = new Subject<AiDraftProgress>();
  TestBed.configureTestingModule({
    providers: [
      { provide: MselBuildService, useValue: stub },
      { provide: SignalRService, useValue: { aiDraftProgress$: progress } },
    ],
  });
  const service = TestBed.inject(MselAiBuildService);
  // the browser draws SVG as PNG; here an SVG becomes a marked PNG and anything else is left alone
  service.toPng = async (html) => html.replace('<svg></svg>', '<img src="data:image/png">');
  const builds: MselAiBuild[] = [];
  service.build$('msel-1').subscribe((b) => builds.push(b));
  const finished: string[] = [];
  service.finished$.subscribe((id) => finished.push(id));
  return { service, api: stub, progress, builds, finished, last: () => builds[builds.length - 1] };
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

    expect(api.writeMselInjects).toHaveBeenCalledWith('msel-1');
    expect(api.writeMselRow).toHaveBeenCalledWith('msel-1', 'event-2');
    expect(api.writeMselArticle).toHaveBeenCalledWith('msel-1', 'event-1');
    expect(api.saveMselArticle).toHaveBeenCalledWith('msel-1', 'event-1', { html: '<img src="data:image/png">' });
    expect(api.writeMselProfile).toHaveBeenCalledWith('msel-1', 'team-1');
    expect(api.saveMselProfile).not.toHaveBeenCalled();
    expect(api.finishMselBuild).toHaveBeenCalledWith('msel-1');
    expect(last()).toMatchObject({ step: 'done', running: false, written: 3, total: 3 });
    expect(last().warnings).toEqual(['Dropped a row with no time.', 'Created the scoring model in CITE.']);
    expect(finished).toEqual(['msel-1']);
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
    expect(api.finishMselBuild).toHaveBeenCalledWith('msel-1');
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
  it('says why the injects failed', () => {
    const { service, last } = setup({
      writeMselInjects: vi.fn(() => throwError(() => ({ error: { title: 'The draft could not be read.', detail: '   at Blueprint.Api...' } }))),
    });

    service.run('msel-1');

    expect(last()).toMatchObject({ step: 'failed', running: false, errors: ['The draft could not be read.'] });
  });
});
