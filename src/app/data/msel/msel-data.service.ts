// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { MselStore } from './msel.store';
import { MselQuery } from './msel.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import {
  Card,
  DataField,
  DataFieldType,
  IntegrationType,
  MselItemStatus,
  Move,
  Msel,
  MselRole,
  MselService,
  Unit,
  ScenarioEvent,
  Team,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { ErrorService } from 'src/app/services/error/error.service';

export interface MselPushStatus {
  mselId: string;
  pushStatus: string;
}

@Injectable({
  providedIn: 'root',
})
export class MselPlus implements Msel {
  dateCreated?: Date;
  dateModified?: Date;
  createdBy?: string;
  modifiedBy?: string;
  id?: string;
  name?: string;
  description?: string;
  status?: MselItemStatus;
  usePlayer?: boolean;
  playerViewId?: string;
  useGallery?: boolean;
  galleryCollectionId?: string;
  galleryExhibitId?: string;
  useCite?: boolean;
  citeEvaluationId?: string;
  citeScoringModelId?: string;
  useSteamfitter?: boolean;
  steamfitterScenarioId?: string;
  isTemplate?: boolean;
  startTime?: Date;
  durationSeconds?: number;
  showTimeOnScenarioEventList?: boolean;
  showTimeOnExerciseView?: boolean;
  showMoveOnScenarioEventList?: boolean;
  showMoveOnExerciseView?: boolean;
  showGroupOnScenarioEventList?: boolean;
  showGroupOnExerciseView?: boolean;
  showDeliveryMethodOnScenarioEventList?: boolean;
  showDeliveryMethodOnExerciseView?: boolean;
  moves?: Array<Move>;
  dataFields?: Array<DataField>;
  scenarioEvents?: Array<ScenarioEvent>;
  teams?: Array<Team>;
  units?: Array<Unit>;
  userMselRoles?: Array<UserMselRole>;
  headerRowMetadata?: string;
  cards?: Array<Card>;
  galleryArticleParameters?: Array<string>;
  gallerySourceTypes?: Array<string>;
  playerIntegrationType?: IntegrationType;
  galleryIntegrationType?: IntegrationType;
  citeIntegrationType?: IntegrationType;
  steamfitterIntegrationType?: IntegrationType;

  hasRole(userId: string, scenarioEventId: string) {
    // initialize to no roles
    let mselRole = {
      owner: false,
      moveEditor: false,
      approver: false,
      editor: false,
      evaluator: false,
      viewer: false,
    };
    // set owner role
    mselRole.owner =
      this.createdBy === userId ||
      (this.userMselRoles &&
        this.userMselRoles.some(
          (umr) => umr.userId === userId && umr.role === MselRole.Owner
        ));
    mselRole.moveEditor = !this.userMselRoles
      ? false
      : this.userMselRoles.some(
          (umr) => umr.userId === userId && umr.role === MselRole.MoveEditor
        );
    // owners can do everything
    if (mselRole.owner) {
      mselRole.approver = true;
      mselRole.editor = true;
      mselRole.moveEditor = true;
      mselRole.evaluator = true;
      mselRole.viewer = true;
      // set roles for a particular scenario event for a non-owner
    } else if (
      this.scenarioEvents &&
      this.scenarioEvents.length > 0 &&
      scenarioEventId
    ) {
      const scenarioEvent = this.scenarioEvents.find(
        (se) => se.id === scenarioEventId
      );
      const assignedToDataField = this.dataFields.find(
        (df) => df.dataType === DataFieldType.Team
      );
      const dataValue =
        assignedToDataField && scenarioEvent
          ? scenarioEvent.dataValues.find(
              (dv) => dv.dataFieldId === assignedToDataField.id
            )
          : null;
      if (dataValue) {
        const unit = this.units.find((t) => t.shortName === dataValue.value);
        const isInUnit =
          unit && unit.users && unit.users.some((u) => u.id === userId);
        if (isInUnit) {
          mselRole = this.setMselRoles(userId, mselRole);
        }
      }
      // set roles for the MSEL for a non-owner, if no scenario event is supplied
    } else {
      mselRole = this.setMselRoles(userId, mselRole);
    }

    return mselRole;
  }

  private setMselRoles(userId: string, mselRole: any) {
    if (this.userMselRoles && this.userMselRoles.length > 0) {
      mselRole.approver = this.userMselRoles.some(
        (umr) => umr.userId === userId && umr.role === MselRole.Approver
      );
      mselRole.editor =
        mselRole.approver ||
        this.userMselRoles.some(
          (umr) => umr.userId === userId && umr.role === MselRole.Editor
        );
      mselRole.evaluator = this.userMselRoles.some(
        (umr) => umr.userId === userId && umr.role === MselRole.Evaluator
      );
      mselRole.viewer =
        mselRole.approver ||
        mselRole.editor ||
        mselRole.moveEditor ||
        mselRole.evaluator ||
        this.userMselRoles.some(
          (umr) => umr.userId === userId && umr.role === MselRole.Viewer
        );
    }
    return mselRole;
  }
}

@Injectable({
  providedIn: 'root',
})
export class MselDataService {
  readonly MselList: Observable<Msel[]>;
  readonly filterControl = new UntypedFormControl();
  private _requestedMselId: string;
  private _requestedMselId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('mselId') || '')
  );
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;
  public mselPushStatuses = new Subject<Array<MselPushStatus>>();
  private _mselPushStatuses = new Array<MselPushStatus>();
  public uploadProgress = new Subject<number>();

  constructor(
    private mselStore: MselStore,
    private mselQuery: MselQuery,
    private mselService: MselService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private errorService: ErrorService
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('mselmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { mselmask: term },
        queryParamsHandling: 'merge',
      });
    });
    this.sortColumn = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('sorton') || 'name')
    );
    this.sortIsAscending = activatedRoute.queryParamMap.pipe(
      map((params) => (params.get('sortdir') || 'asc') === 'asc')
    );
    this.pageSize = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pagesize') || '20', 10))
    );
    this.pageIndex = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pageindex') || '0', 10))
    );
    this.MselList = combineLatest([
      this.mselQuery.selectAll(),
      this.filterTerm,
      this.sortColumn,
      this.sortIsAscending,
      this.pageSize,
      this.pageIndex,
    ]).pipe(
      map(
        ([
          items,
          filterTerm,
          sortColumn,
          sortIsAscending,
          pageSize,
          pageIndex,
        ]) =>
          items
            ? (items as Msel[])
                .sort((a: Msel, b: Msel) =>
                  this.sortMsels(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (msel) =>
                    ('' + msel.description)
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()) ||
                    msel.id.toLowerCase().includes(filterTerm.toLowerCase())
                )
            : []
      )
    );
  }

  load() {
    this.mselStore.setLoading(true);
    this.mselService
      .getMsels()
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (msels) => {
          msels.forEach(a => {
            this.setAsDates(a);
          });
          this.mselStore.set(msels);
        },
        (error) => {
          this.mselStore.set([]);
          this.mselStore.setLoading(false);
        }
      );
  }

  loadMine() {
    this.mselStore.setLoading(true);
    this.mselService
      .getMyMsels()
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (msels) => {
          msels.forEach(a => {
            this.setAsDates(a);
          });
          this.mselStore.set(msels);
        },
        (error) => {
          this.mselStore.set([]);
          this.mselStore.setLoading(false);
        }
      );
  }

  getMyJoinMsels() {
    return this.mselService.getMyJoinMsels();
  }

  getMyLaunchMsels() {
    return this.mselService.getMyLaunchMsels();
  }

  getMyBuildMsels() {
    return this.mselService.getMyMsels();
  }

  loadById(id: string) {
    this.mselStore.setLoading(true);
    return this.mselService
      .getMsel(id)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (s) => {
          this.setAsDates(s);
          this.mselStore.upsert(s.id, { ...s });
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  unload() {
    this.mselStore.set([]);
  }

  add(msel: Msel) {
    this.mselStore.setLoading(true);
    this.mselService
      .createMsel(msel)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (s) => {
          this.setAsDates(s);
          this.mselStore.add(s);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  join(mselId: string, teamId: string) {
    return this.mselService.joinMselByInvitation(mselId, teamId);
  }

  launch(mselId: string, teamId: string): Observable<Msel> {
    return this.mselService.launchMselByInvitation(mselId, teamId);
  }

  copy(id: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .copyMsel(id)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (s) => {
          this.setAsDates(s);
          this.mselStore.add(s);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  updateMsel(msel: Msel) {
    this.mselStore.setLoading(true);
    this.mselService
      .updateMsel(msel.id, msel)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.setAsDates(n);
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  pushIntegrations(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pushIntegrations(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
          this.errorService.handleError(error);
        }
      );
  }

  pullIntegrations(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pullIntegrations(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  mselPushStatusChange(mselPushStatus: string) {
    let notFound = true;
    const parts = mselPushStatus.split(',');
    const newPushStatus = { mselId: parts[0], pushStatus: parts[1] };
    this._mselPushStatuses.forEach((mps) => {
      if (mps.mselId === newPushStatus.mselId) {
        mps.pushStatus = newPushStatus.pushStatus;
        notFound = false;
      }
    });
    if (notFound) {
      this._mselPushStatuses.push(newPushStatus);
    }
    this.mselPushStatuses.next(this._mselPushStatuses);
  }

  archive(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .archive(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  delete(id: string) {
    this.mselService
      .deleteMsel(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  addUserMselRole(userId: string, mselId: string, mselRole: MselRole) {
    this.mselStore.setLoading(true);
    this.mselService
      .addUserMselRole(userId, mselId, mselRole)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  removeUserMselRole(userId: string, mselId: string, mselRole: MselRole) {
    this.mselStore.setLoading(true);
    this.mselService
      .removeUserMselRole(userId, mselId, mselRole)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (n) => {
          this.updateStore(n);
        },
        (error) => {
          this.mselStore.setLoading(false);
        }
      );
  }

  downloadXlsx(id: string) {
    return this.mselService.downloadXlsx(id);
  }

  downloadJson(id: string) {
    return this.mselService.downloadJsonMsel(id);
  }

  uploadXlsx(
    mselId: string,
    teamId: string,
    file: File,
    observe: any,
    reportProgress: boolean
  ) {
    this.mselStore.setLoading(true);
    if (mselId) {
      this.mselService
        .replaceWithXlsxFile(
          mselId,
          '',
          '',
          teamId,
          file,
          observe,
          reportProgress
        )
        .subscribe(
          (event: any) => {
            if (event.type === HttpEventType.UploadProgress) {
              const uploadProgress = Math.round(
                (100 * event.loaded) / event.total
              );
              this.uploadProgress.next(uploadProgress);
            } else if (event instanceof HttpResponse) {
              this.uploadProgress.next(0);
              this.mselStore.setLoading(false);
              if (event.status === 200) {
                const msel = event.body;
                this.mselStore.upsert(msel.id, msel);
              }
            }
          },
          (error) => {
            this.mselStore.setLoading(false);
            this.uploadProgress.next(0);
          }
        );
    } else {
      this.mselService
        .uploadXlsx('', '', teamId, file, observe, reportProgress)
        .subscribe(
          (event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const uploadProgress = Math.round(
                (100 * event.loaded) / event.total
              );
              this.uploadProgress.next(uploadProgress);
            } else if (event instanceof HttpResponse) {
              this.uploadProgress.next(0);
              this.mselStore.setLoading(false);
              if (event.status === 200) {
                const msel = event.body;
                this.mselStore.upsert(msel.id, msel);
              }
            }
          },
          (error) => {
            this.mselStore.setLoading(false);
            this.uploadProgress.next(0);
          }
        );
    }
  }

  uploadJson(file: File, observe: any, reportProgress: boolean) {
    this.mselStore.setLoading(true);
    this.mselService
      .uploadJsonMsel('', '', '', file, observe, reportProgress)
      .subscribe(
        (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            const uploadProgress = Math.round(
              (100 * event.loaded) / event.total
            );
            this.uploadProgress.next(uploadProgress);
          } else if (event instanceof HttpResponse) {
            this.uploadProgress.next(0);
            this.mselStore.setLoading(false);
            if (event.status === 200) {
              const msel = event.body;
              this.mselStore.upsert(msel.id, msel);
            }
          }
        },
        (error) => {
          this.mselStore.setLoading(false);
          this.uploadProgress.next(0);
        }
      );
  }

  setPageEvent(pageEvent: PageEvent) {
    this.mselStore.update({ pageEvent: pageEvent });
  }

  updateStore(msel: Msel) {
    this.mselStore.upsert(msel.id, msel);
  }

  deleteFromStore(id: string) {
    this.mselStore.remove(id);
  }

  setActive(id: string) {
    this.mselStore.setActive(id);
  }

  private sortMsels(a: Msel, b: Msel, column: string, isAsc: boolean) {
    switch (column) {
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case 'dateCreated':
        return (
          (a.dateCreated.valueOf() < b.dateCreated.valueOf() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }

  setAsDates(msel: Msel) {
    // set to a date object.
    msel.dateCreated = new Date(msel.dateCreated);
    msel.dateModified = new Date(msel.dateModified);
    msel.startTime = new Date(msel.startTime);
  }
}
