// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MselPage } from 'src/app/generated/blueprint.api';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { SafeHtml } from '@angular/platform-browser';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-msel-pageapp',
  templateUrl: './msel-page.component.html',
  styleUrls: ['./msel-page.component.scss'],
})
export class MselPageComponent implements OnDestroy {
  safeContent: SafeHtml = '';
  mselPage: MselPage = {} as MselPage;
  private unsubscribe$ = new Subject();
  viewConfig: AngularEditorConfig = {
    editable: false,
    height: 'auto',
    minHeight: '1200px',
    width: '100%',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: false,
    showToolbar: false,
    placeholder: '',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    sanitize: false,
  };

  constructor(
    private activatedRoute: ActivatedRoute,
    private mselPageDataService: MselPageDataService,
    private mselPageQuery: MselPageQuery,
    private settingsService: ComnSettingsService,
    @Inject(DOCUMENT) private _document: HTMLDocument
  ) {
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


  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
