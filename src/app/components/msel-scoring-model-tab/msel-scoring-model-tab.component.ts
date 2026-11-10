// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CiteService,
  MselScoringModel,
  MselScoringModelService,
  ScoringModel,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ErrorService } from 'src/app/services/error/error.service';
import { showCiteAccessDenied } from 'src/app/utilities/cite-access';
import { canEditScoringModel, integrationsLocked } from 'src/app/utilities/msel-permissions';
import { normalizeScoringModel } from 'src/app/utilities/scoring-model';
import { MselScoringModelComponent } from '../msel-scoring-model/msel-scoring-model.component';

export type ScoringModelSource = 'link' | 'author';

/**
 * The Scoring Model tab of a MSEL that uses CITE: link one of CITE's scoring models or author one in Blueprint, each
 * saved through its own endpoint. The push builds the CITE evaluation from whichever it has, and both are locked while
 * the integrations are deployed.
 */
@Component({
  selector: 'app-msel-scoring-model-tab',
  templateUrl: './msel-scoring-model-tab.component.html',
  styleUrls: ['./msel-scoring-model-tab.component.scss'],
  imports: [FormsModule, MatIcon, MatIconButton, MatLabel, MatFormField, MatSelect, MatOption, MatRadioGroup, MatRadioButton, MatTooltip, MselScoringModelComponent],
})
export class MselScoringModelTabComponent implements OnInit, OnDestroy {
  private mselQuery = inject(MselQuery);
  private mselDataService = inject(MselDataService);
  private mselScoringModelService = inject(MselScoringModelService);
  private citeService = inject(CiteService);
  private permissionDataService = inject(PermissionDataService);
  private dialogService = inject(CrucibleDialogService);
  private errorService = inject(ErrorService);

  readonly loggedInUserId = input<string>(undefined);
  readonly sourceGroup = viewChild(MatRadioGroup);
  readonly authored = viewChild(MselScoringModelComponent);

  msel = new MselPlus();
  private originalMsel = new MselPlus();
  // the link chosen and not yet saved
  isChanged = false;
  scoringModelList: ScoringModel[] = [];
  // the model authored in Blueprint is saved as soon as it changes
  authoredScoringModel: MselScoringModel | null = null;
  source: ScoringModelSource = 'link';
  private unsubscribe$ = new Subject();

  constructor() {
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (!msel) {
          return;
        }
        const isNewMsel = this.msel.id !== msel.id;
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        if (isNewMsel) {
          this.isChanged = false;
          this.loadAuthoredScoringModel(msel.id);
        }
      });
    this.citeService.getScoringModels().subscribe({
      // the models an evaluation was made from belong to it; only the templates can be linked or copied
      next: (scoringModels) => (this.scoringModelList = (scoringModels || []).filter((sm) => !sm.evaluationId)),
      error: (error) => {
        console.error('Failed to load CITE scoring models:', error);
        this.scoringModelList = [];
      },
    });
  }

  ngOnInit() {
    this.permissionDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
  }

  private loadAuthoredScoringModel(mselId: string) {
    this.authoredScoringModel = null;
    this.source = 'link';
    this.mselScoringModelService
      .getMselScoringModel(mselId)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (model) => {
          // the answer for a MSEL the user has since left is not this one's
          if (this.msel.id !== mselId) {
            return;
          }
          this.authoredScoringModel = model ? normalizeScoringModel(model) : null;
          this.source = model ? 'author' : 'link';
        },
        error: (error) => console.error('Failed to load the MSEL scoring model:', error),
      });
  }

  integrationsLocked(): boolean {
    return integrationsLocked(this.msel);
  }

  // linking and authoring follow the same API rule, and the same lock
  canEdit(): boolean {
    return !this.integrationsLocked() &&
      canEditScoringModel(this.msel, this.loggedInUserId(), this.permissionDataService.hasPermission(SystemPermission.EditMsels));
  }

  linkedScoringModelName(): string {
    return this.scoringModelList.find((sm) => sm.id === this.msel.citeScoringModelId)?.description ?? '';
  }

  onSourceChange(source: ScoringModelSource) {
    if (source === 'author') {
      // authoring replaces the link, so a link chosen and not saved is dropped, not left pending where it cannot be saved
      this.cancelChanges();
    }
    if (source !== 'link' || !this.authoredScoringModel) {
      this.source = source;
      return;
    }
    // linking a CITE model replaces the one authored here, which is deleted
    const authored = this.authoredScoringModel;
    this.dialogService
      .confirm({
        title: 'Link a CITE Scoring Model',
        message: `Linking a CITE scoring model deletes "${authored.description}", the scoring model authored in Blueprint. Delete it?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.keepAuthoredSource();
          return;
        }
        this.mselScoringModelService.deleteMselScoringModel(this.msel.id).subscribe({
          next: () => {
            this.authoredScoringModel = null;
            this.source = 'link';
          },
          error: (err) => {
            this.keepAuthoredSource();
            this.errorService.handleError(err);
          },
        });
      });
  }

  // the radio group moved to the link when it was clicked; the source it is bound to never did
  private keepAuthoredSource() {
    const group = this.sourceGroup();
    if (group) {
      group.value = 'author';
    }
  }

  saveChanges() {
    this.mselScoringModelService
      .linkMselScoringModel(this.msel.id, { citeScoringModelId: this.msel.citeScoringModelId || null })
      .subscribe({
        next: (msel) => {
          this.isChanged = false;
          this.mselDataService.setAsDates(msel);
          this.mselDataService.updateStore(msel);
        },
        // the edit stays up to be retried
        error: (err: HttpErrorResponse) => {
          if (!showCiteAccessDenied(this.dialogService, err)) {
            this.errorService.handleError(err);
          }
        },
      });
  }

  cancelChanges() {
    this.isChanged = false;
    Object.assign(this.msel, this.originalMsel);
  }

  hasPendingChanges(): boolean {
    return (this.source === 'link' && this.isChanged) || !!this.authored()?.isDirty();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
