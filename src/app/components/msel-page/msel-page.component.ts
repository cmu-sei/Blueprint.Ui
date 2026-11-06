// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { MselPage, MselService } from 'src/app/generated/blueprint.api';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { SafeHtml } from '@angular/platform-browser';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { FormsModule } from '@angular/forms';
import { MarkingBanner, markingBanner } from 'src/app/utilities/msel-marking';

@Component({
    selector: 'app-msel-pageapp',
    templateUrl: './msel-page.component.html',
    styleUrls: ['./msel-page.component.scss'],
    imports: [AngularEditorModule, FormsModule, NgTemplateOutlet]
})
export class MselPageComponent implements OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private mselPageDataService = inject(MselPageDataService);
  private mselPageQuery = inject(MselPageQuery);
  private settingsService = inject(ComnSettingsService);
  private _document = inject<HTMLDocument>(DOCUMENT);
  private mselService = inject(MselService);

  safeContent: SafeHtml = '';
  mselPage: MselPage = {} as MselPage;
  private unsubscribe$ = new Subject();
  viewConfig = VIEW_CONFIG;
  // the MSEL's marking, drawn above and below the page as it is shown, not stored in its content
  readonly banner = signal<MarkingBanner | null>(null);

  constructor() {
    this._document.getElementById('appTitle').innerHTML = this.settingsService.settings.AppTitle + ' MSEL Page';
    // subscribe to route changes
    this.activatedRoute.paramMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      const mselPageId = params.get('id');
      if (mselPageId) {
        this.mselPageDataService.loadById(mselPageId);
        this.mselPageDataService.setActive(mselPageId);
      } else {
        this.mselPageDataService.setActive('');
      }
    });
    // subscribe to the mselPage
    (this.mselPageQuery.selectActive() as Observable<MselPage>).pipe(takeUntil(this.unsubscribe$)).subscribe(mselPage => {
      if (mselPage) {
        this.mselPage = mselPage;
      }
    });
    // the marking of the page's MSEL; a page whose MSEL cannot be read shows none
    (this.mselPageQuery.selectActive() as Observable<MselPage>).pipe(
      map(mselPage => mselPage?.mselId),
      filter(mselId => !!mselId),
      distinctUntilChanged(),
      switchMap(mselId => this.mselService.getMsel(mselId).pipe(catchError(() => of(null)))),
      takeUntil(this.unsubscribe$)
    ).subscribe(msel => {
      this.banner.set(msel ? markingBanner(msel.articleMarking, msel.articleMarkingText, msel.name) : null);
    });


  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
