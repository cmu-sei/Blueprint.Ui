// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, from, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, map, mergeMap, tap, toArray } from 'rxjs/operators';
import { MselBuildItem, MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';
import { SignalRService } from 'src/app/services/signalr.service';
import { prepareImages } from 'src/app/utilities/svg-to-png';

// injects: the model outlines the rows; articles: each row's text, article and profile; finish: pages, Player and CITE
export type MselAiBuildStep = 'injects' | 'articles' | 'finish' | 'done' | 'stopped' | 'failed';

export interface MselAiBuild {
  mselId: string;
  step: MselAiBuildStep;
  running: boolean;
  // when this run and its current step started, for the elapsed time
  started: number;
  stepStarted: number;
  // while the injects are written: what the model has written so far
  counts: { [list: string]: number };
  // the articles and profiles written in this run, of those there were to write
  written: number;
  total: number;
  // what is left once a run stops, from the API
  remaining?: MselBuildStatus;
  errors: string[];
  warnings: string[];
}

/**
 * Builds a MSEL from its approved AI design, step by step, in the browser: the outline of the injects, each row's text, each Gallery article and
 * profile (their graphics drawn as PNG here and saved again), then the finish. The API saves every step, so a run
 * stopped by Cancel, an error or a closed tab is continued from the MSEL page. A singleton, so a run keeps going
 * while the planner moves around Blueprint.
 */
@Injectable({ providedIn: 'root' })
export class MselAiBuildService {
  private api = inject(MselBuildService);
  private signalRService = inject(SignalRService);
  private builds = new Map<string, BehaviorSubject<MselAiBuild>>();
  private runs = new Map<string, Subscription>();
  // a MSEL's id when its build finishes, so its page reloads what the finish added
  readonly finished$ = new Subject<string>();
  // drawn on a canvas in the browser: SVG as PNG, photos at article size; tests give their own
  toPng: (html: string) => Promise<string> = prepareImages;
  // articles and profiles written at once
  concurrency = 3;

  constructor() {
    this.signalRService.aiDraftProgress$.subscribe((progress) => {
      const build = progress.mselId ? this.builds.get(progress.mselId)?.value : undefined;
      if (build?.running && build.step === 'injects' && progress.operation === 'injects') {
        this.patch(build.mselId, { counts: progress.counts ?? {} });
      }
    });
  }

  build$(mselId: string): Observable<MselAiBuild> {
    return this.subject(mselId).asObservable();
  }

  isRunning(mselId: string): boolean {
    return !!this.builds.get(mselId)?.value?.running;
  }

  // runs whatever is left of the build; a step the API has saved is never run again
  run(mselId: string) {
    if (this.isRunning(mselId)) {
      return;
    }
    const now = Date.now();
    this.subject(mselId).next({
      mselId,
      step: 'injects',
      running: true,
      started: now,
      stepStarted: now,
      counts: {},
      written: 0,
      total: 0,
      errors: [],
      warnings: [],
    });
    const run = this.api
      .getMselBuildStatus(mselId)
      .pipe(
        mergeMap((status) => (status.stage === 'Injects' ? this.writeInjects(mselId) : of(status))),
        mergeMap((status) => (status.stage === 'Articles' ? this.writeArticles(mselId, status) : of(status))),
        mergeMap((status) => this.finish(mselId, status))
      )
      .subscribe({
        error: (err) => this.patch(mselId, { running: false, step: 'failed', errors: [...this.get(mselId).errors, errorMessage(err)] }),
      });
    this.runs.set(mselId, run);
  }

  // finishes with the articles and profiles that were written, leaving out any that failed
  finishNow(mselId: string) {
    if (this.isRunning(mselId)) {
      return;
    }
    const now = Date.now();
    const build = this.get(mselId);
    this.subject(mselId).next({
      ...(build ?? { mselId, counts: {}, written: 0, total: 0, warnings: [] }),
      errors: [],
      running: true,
      started: now,
      stepStarted: now,
      step: 'finish',
    } as MselAiBuild);
    this.runs.set(
      mselId,
      this.api.getMselBuildStatus(mselId).pipe(mergeMap((status) => this.finish(mselId, { ...status, articles: [], profiles: [] }))).subscribe({
        error: (err) => this.patch(mselId, { running: false, step: 'failed', errors: [errorMessage(err)] }),
      })
    );
  }

  // stops the run; what the API saved stays, and the request in flight is abandoned
  cancel(mselId: string) {
    this.runs.get(mselId)?.unsubscribe();
    this.runs.delete(mselId);
    if (this.get(mselId)?.running) {
      this.patch(mselId, { running: false, step: 'stopped' });
      this.api.getMselBuildStatus(mselId).subscribe({ next: (remaining) => this.patch(mselId, { remaining }), error: () => {} });
    }
  }

  // forgets a build that is done, once the planner has seen it
  dismiss(mselId: string) {
    if (!this.isRunning(mselId)) {
      this.builds.get(mselId)?.next(undefined);
    }
  }

  private writeInjects(mselId: string): Observable<MselBuildStatus> {
    this.patch(mselId, { step: 'injects', stepStarted: Date.now(), counts: {} });
    return this.api.writeMselInjects(mselId).pipe(tap((status) => this.addWarnings(mselId, status.warnings)));
  }

  private writeArticles(mselId: string, status: MselBuildStatus): Observable<MselBuildStatus> {
    // the rows in time order with the articles, then the profiles
    const items = [...(status.injects ?? []), ...(status.articles ?? []), ...(status.profiles ?? [])];
    this.patch(mselId, { step: 'articles', stepStarted: Date.now(), written: 0, total: items.length });
    return from(items).pipe(
      mergeMap(
        (item) =>
          this.writeItem(mselId, item).pipe(
            tap(() => this.patch(mselId, { written: this.get(mselId).written + 1 })),
            catchError((err) => {
              this.patch(mselId, { errors: [...this.get(mselId).errors, `${item.name || 'An article'}: ${errorMessage(err)}`] });
              return EMPTY;
            })
          ),
        this.concurrency
      ),
      toArray(),
      mergeMap(() => this.api.getMselBuildStatus(mselId))
    );
  }

  // writes and saves one article or profile, then saves it again with its graphics as PNG
  private writeItem(mselId: string, item: MselBuildItem): Observable<unknown> {
    // a row's text has no graphics, so it is saved once, as written
    if (item.kind === 'inject') {
      return this.api.writeMselRow(mselId, item.id);
    }
    const isArticle = item.kind === 'article';
    const write = isArticle ? this.api.writeMselArticle(mselId, item.id) : this.api.writeMselProfile(mselId, item.id);
    return (write as Observable<{ html?: string }>).pipe(
      mergeMap((written) => from(this.toPng(written.html ?? '')).pipe(map((png) => ({ html: written.html, png })))),
      mergeMap(({ html, png }) =>
        png === html
          ? of(null)
          : isArticle
            ? this.api.saveMselArticle(mselId, item.id, { html: png })
            : this.api.saveMselProfile(mselId, item.id, { html: png })
      )
    );
  }

  // an article or profile that failed stops the run before the finish, to try again or finish without it
  private finish(mselId: string, status: MselBuildStatus): Observable<unknown> {
    if (!status.stage) {
      this.done(mselId, status);
      return of(status);
    }
    if (status.articles?.length || status.profiles?.length) {
      this.patch(mselId, { running: false, step: 'stopped', remaining: status });
      return of(status);
    }
    this.patch(mselId, { step: 'finish', stepStarted: Date.now() });
    return this.api.finishMselBuild(mselId).pipe(tap((finished) => this.done(mselId, finished)));
  }

  private done(mselId: string, status: MselBuildStatus) {
    this.addWarnings(mselId, status.warnings);
    this.patch(mselId, { running: false, step: 'done', remaining: status });
    this.runs.delete(mselId);
    this.finished$.next(mselId);
  }

  private addWarnings(mselId: string, warnings: string[]) {
    if (warnings?.length) {
      this.patch(mselId, { warnings: [...this.get(mselId).warnings, ...warnings] });
    }
  }

  private subject(mselId: string): BehaviorSubject<MselAiBuild> {
    if (!this.builds.has(mselId)) {
      this.builds.set(mselId, new BehaviorSubject<MselAiBuild>(undefined));
    }
    return this.builds.get(mselId);
  }

  private get(mselId: string): MselAiBuild {
    return this.builds.get(mselId)?.value;
  }

  private patch(mselId: string, change: Partial<MselAiBuild>) {
    const build = this.get(mselId);
    if (build) {
      this.subject(mselId).next({ ...build, ...change });
    }
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return 'The API could not be reached.';
  }
  const failure = err as { error?: { title?: string; detail?: string }; message?: string };
  const title = failure?.error?.title;
  const detail = failure?.error?.detail;
  if (title) {
    return detail && !detail.startsWith('   at ') ? `${title} ${detail}` : title;
  }
  return failure?.message || 'The draft failed.';
}
