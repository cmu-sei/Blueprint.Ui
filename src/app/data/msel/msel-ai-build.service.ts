// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, defer, EMPTY, from, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, finalize, map, mergeMap, take, tap, toArray } from 'rxjs/operators';
import {
  MselBuildBuilder,
  MselBuildContent,
  MselDesignBuild,
  MselBuildItem,
  MselBuildService,
  MselBuildStatus,
} from 'src/app/generated/blueprint.api';
import { SignalRService } from 'src/app/services/signalr.service';
import { prepareImages } from 'src/app/utilities/svg-to-png';

// injects: the model outlines the rows; articles: each row's text, article and profile; finish: pages, Player and CITE
// claiming: asking to build in this tab; busy: another tab has the build; takenOver: another tab took it from this one
export type MselAiBuildStep =
  | 'creating'
  | 'createFailed'
  | 'claiming'
  | 'busy'
  | 'takenOver'
  | 'injects'
  | 'articles'
  | 'finish'
  | 'done'
  | 'stopped'
  | 'failed';

export interface MselAiBuild {
  mselId: string;
  step: MselAiBuildStep;
  running: boolean;
  // when this run and its current step started, for the elapsed time
  started: number;
  stepStarted: number;
  // while the injects are written: what the model has written so far, and how many the design planned
  counts: { [list: string]: number };
  planned?: number;
  // the articles and profiles written in this run, of those there were to write, those being written now, and the last done
  written: number;
  total: number;
  inProgress?: number;
  lastDone?: string;
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
  // who is building each MSEL in a browser tab, this one or another; null when no tab is
  private builders = new Map<string, BehaviorSubject<MselBuildBuilder | null>>();
  private runs = new Map<string, Subscription>();
  // a MSEL's id when its build finishes, so its page reloads what the finish added
  readonly finished$ = new Subject<string>();
  // a MSEL created from its design: the id its page was opened under, and the id it has (another when that one was taken)
  readonly created$ = new Subject<{ requestedId: string; mselId: string }>();
  // the create requests, so one that failed can be tried again from the MSEL's page
  private creates = new Map<string, MselDesignBuild>();
  // drawn on a canvas in the browser: SVG as PNG, photos at article size; tests give their own
  toPng: (html: string) => Promise<string> = prepareImages;
  // rows, articles and profiles written at once, when the API does not say
  concurrency = 3;

  constructor() {
    this.signalRService.aiDraftProgress$.subscribe((progress) => {
      const build = progress.mselId ? this.builds.get(progress.mselId)?.value : undefined;
      if (build?.running && build.step === 'injects' && progress.operation === 'injects') {
        this.patch(build.mselId, { counts: progress.counts ?? {} });
      }
    });
    this.signalRService.aiBuilderChanged$.subscribe((change) => this.builderSubject(change.mselId).next(change.builder ?? null));
    // another tab took the build: this one stops writing, and what it saved stays
    this.signalRService.aiBuildTakenOver$.subscribe((takenOver) => {
      if (!this.isRunning(takenOver.mselId)) {
        return;
      }
      this.runs.get(takenOver.mselId)?.unsubscribe();
      this.runs.delete(takenOver.mselId);
      const who = takenOver.userName ? `${takenOver.userName} took over` : 'Another tab took over';
      this.patch(takenOver.mselId, { running: false, step: 'takenOver', errors: [`${who} building this MSEL. What was written here is saved.`] });
    });
  }

  builder$(mselId: string): Observable<MselBuildBuilder | null> {
    return this.builderSubject(mselId).asObservable();
  }

  // what the API said about who is building, from a status read outside a run
  noteBuilder(mselId: string, builder: MselBuildBuilder | null | undefined) {
    this.builderSubject(mselId).next(builder ?? null);
  }

  build$(mselId: string): Observable<MselAiBuild> {
    return this.subject(mselId).asObservable();
  }

  isRunning(mselId: string): boolean {
    return !!this.builds.get(mselId)?.value?.running;
  }

  // the MSEL is being created, so its page has nothing to load yet
  isCreating(mselId: string): boolean {
    const build = this.builds.get(mselId)?.value;
    return build?.step === 'creating' || build?.step === 'createFailed';
  }

  /**
   * Creates the MSEL from its reviewed design under the id the browser chose, so the dialog can close and the MSEL's page
   * open at once; the build runs as soon as it exists. A create that fails can be tried again from the MSEL's page.
   */
  create(request: MselDesignBuild) {
    const mselId = request.mselId;
    this.creates.set(mselId, request);
    const now = Date.now();
    this.subject(mselId).next({
      mselId,
      step: 'creating',
      running: true,
      started: now,
      stepStarted: now,
      counts: {},
      written: 0,
      total: 0,
      errors: [],
      warnings: [],
    });
    this.runs.set(
      mselId,
      this.api
        .createMselFromDesign(request)
        .pipe(take(1))
        .subscribe({
          next: (created) => {
            this.creates.delete(mselId);
            this.patch(mselId, { running: false });
            this.created$.next({ requestedId: mselId, mselId: created.msel.id });
            this.run(created.msel.id);
          },
          error: (err) => this.patch(mselId, { running: false, step: 'createFailed', errors: [errorMessage(err)] }),
        })
    );
  }

  retryCreate(mselId: string) {
    const request = this.creates.get(mselId);
    if (request && !this.isRunning(mselId)) {
      this.create(request);
    }
  }

  // runs whatever is left of the build in this tab, taking it from another tab with takeOver; a step the API has saved
  // is never run again
  run(mselId: string, takeOver = false) {
    if (this.isRunning(mselId)) {
      return;
    }
    const now = Date.now();
    this.subject(mselId).next({
      mselId,
      step: 'claiming',
      running: true,
      started: now,
      stepStarted: now,
      counts: {},
      written: 0,
      total: 0,
      errors: [],
      warnings: [],
    });
    const run = this.claim(mselId, takeOver)
      .pipe(
        mergeMap(() => this.api.getMselBuildStatus(mselId)),
        tap((status) => this.patch(mselId, { step: 'injects', planned: status.plannedInjects ?? undefined })),
        mergeMap((status) => (status.stage === 'Injects' ? this.writeInjects(mselId) : of(status))),
        mergeMap((status) => (status.stage === 'Articles' ? this.writeArticles(mselId, status) : of(status))),
        mergeMap((status) => this.finish(mselId, status))
      )
      .subscribe({
        error: (err) => this.stopped(mselId, err, [...this.get(mselId).errors]),
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
      this.claim(mselId, false)
        .pipe(
          mergeMap(() => this.api.getMselBuildStatus(mselId)),
          mergeMap((status) => this.finish(mselId, { ...status, articles: [], profiles: [] }))
        )
        .subscribe({
          error: (err) => this.stopped(mselId, err, []),
        })
    );
  }

  // stops the run and frees the build for another tab; what the API saved stays, and the request in flight is abandoned
  cancel(mselId: string) {
    this.runs.get(mselId)?.unsubscribe();
    this.runs.delete(mselId);
    if (this.get(mselId)?.running) {
      this.patch(mselId, { running: false, step: 'stopped' });
      this.release(mselId);
      this.api.getMselBuildStatus(mselId).subscribe({ next: (remaining) => this.patch(mselId, { remaining }), error: () => {} });
    }
  }

  // asks to build in this tab; a tab not connected to the hub yet asks nothing, and the API lets it write only while no
  // tab has the build
  private claim(mselId: string, takeOver: boolean): Observable<unknown> {
    const connectionId = this.signalRService.connectionId;
    if (!connectionId) {
      return of(null);
    }
    return this.api.claimMselBuild(mselId, connectionId, takeOver).pipe(tap((builder) => this.noteBuilder(mselId, builder)));
  }

  // frees the build when this tab has it, so another tab can continue it at once
  private release(mselId: string) {
    const connectionId = this.signalRService.connectionId;
    if (connectionId) {
      this.api.releaseMselBuild(mselId, connectionId).subscribe({ error: () => {} });
    }
  }

  // a run that stopped on an error; another tab having the build is not a failure, and is said so
  private stopped(mselId: string, err: unknown, errors: string[]) {
    this.runs.delete(mselId);
    if (err instanceof HttpErrorResponse && err.status === 409 && this.get(mselId)?.step === 'claiming') {
      this.patch(mselId, { running: false, step: 'busy', errors: [errorMessage(err)] });
      this.api.getMselBuildStatus(mselId).subscribe({ next: (status) => this.noteBuilder(mselId, status.builder), error: () => {} });
      return;
    }
    this.patch(mselId, { running: false, step: 'failed', errors: [...errors, errorMessage(err)] });
    this.release(mselId);
  }

  // forgets a build that is done, once the planner has seen it
  dismiss(mselId: string) {
    if (!this.isRunning(mselId)) {
      this.builds.get(mselId)?.next(undefined);
    }
  }

  private writeInjects(mselId: string): Observable<MselBuildStatus> {
    this.patch(mselId, { step: 'injects', stepStarted: Date.now(), counts: {} });
    return this.api.writeMselInjects(mselId, this.signalRService.connectionId).pipe(tap((status) => this.addWarnings(mselId, status.warnings)));
  }

  private writeArticles(mselId: string, status: MselBuildStatus): Observable<MselBuildStatus> {
    // the rows in time order with the articles, then the profiles
    const items = [...(status.injects ?? []), ...(status.articles ?? []), ...(status.profiles ?? [])];
    this.patch(mselId, { step: 'articles', stepStarted: Date.now(), written: 0, total: items.length, inProgress: 0, lastDone: undefined });
    return from(items).pipe(
      mergeMap(
        (item) =>
          defer(() => {
            // the items being written now, so the first minute of a step is not a silent 0
            this.patch(mselId, { inProgress: (this.get(mselId).inProgress ?? 0) + 1 });
            return this.writeItem(mselId, item);
          }).pipe(
            tap(() => this.patch(mselId, { written: this.get(mselId).written + 1, lastDone: item.name || undefined })),
            catchError((err) => {
              this.patch(mselId, { errors: [...this.get(mselId).errors, `${item.name || 'An article'}: ${errorMessage(err)}`] });
              return EMPTY;
            }),
            finalize(() => this.patch(mselId, { inProgress: Math.max(0, (this.get(mselId).inProgress ?? 1) - 1) }))
          ),
        status.parallel || this.concurrency
      ),
      toArray(),
      mergeMap(() => this.api.getMselBuildStatus(mselId))
    );
  }

  // writes and saves one article or profile, then saves it again with its graphics as PNG; what the server corrected in it,
  // such as values outside the scenario's indicators, joins the build's warnings
  private writeItem(mselId: string, item: MselBuildItem): Observable<unknown> {
    // a row's text has no graphics, so it is saved once, as written
    if (item.kind === 'inject') {
      return (this.api.writeMselRow(mselId, item.id, this.signalRService.connectionId) as Observable<MselBuildContent>).pipe(
        tap((written: MselBuildContent) => this.addWarnings(mselId, written?.warnings))
      );
    }
    const isArticle = item.kind === 'article';
    const connectionId = this.signalRService.connectionId;
    const write = isArticle ? this.api.writeMselArticle(mselId, item.id, connectionId) : this.api.writeMselProfile(mselId, item.id, connectionId);
    return (write as Observable<{ html?: string; warnings?: string[] }>).pipe(
      tap((written: { html?: string; warnings?: string[] }) => this.addWarnings(mselId, written?.warnings)),
      mergeMap((written) => from(this.toPng(written.html ?? '')).pipe(map((png) => ({ html: written.html, png })))),
      mergeMap(({ html, png }) =>
        png === html
          ? of(null)
          : isArticle
            ? this.api.saveMselArticle(mselId, item.id, connectionId, { html: png })
            : this.api.saveMselProfile(mselId, item.id, connectionId, { html: png })
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
      this.runs.delete(mselId);
      this.release(mselId);
      return of(status);
    }
    this.patch(mselId, { step: 'finish', stepStarted: Date.now() });
    return this.api.finishMselBuild(mselId, this.signalRService.connectionId).pipe(tap((finished) => this.done(mselId, finished)));
  }

  private done(mselId: string, status: MselBuildStatus) {
    this.addWarnings(mselId, status.warnings);
    this.patch(mselId, { running: false, step: 'done', remaining: status });
    this.noteBuilder(mselId, null);
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

  private builderSubject(mselId: string): BehaviorSubject<MselBuildBuilder | null> {
    if (!this.builders.has(mselId)) {
      this.builders.set(mselId, new BehaviorSubject<MselBuildBuilder | null>(null));
    }
    return this.builders.get(mselId);
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
