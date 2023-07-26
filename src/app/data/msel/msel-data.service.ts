// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { MselStore } from './msel.store';
import { MselQuery } from './msel.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Card,
  DataField,
  DataFieldType,
  DataValue,
  ItemStatus,
  Move,
  Msel,
  MselRole,
  MselService,
  ScenarioEvent,
  Team,
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { ErrorService } from 'src/app/services/error/error.service';

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
  status?: ItemStatus;
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
  moves?: Array<Move>;
  dataFields?: Array<DataField>;
  scenarioEvents?: Array<ScenarioEvent>;
  teams?: Array<Team>;
  userMselRoles?: Array<UserMselRole>;
  headerRowMetadata?: string;
  cards?: Array<Card>;
  galleryArticleParameters?: Array<string>;
  gallerySourceTypes?: Array<string>;

  hasRole(userId: string, scenarioEventId: string) {
    const mselRole = { owner: false, moveEditor: false, approver: false, editor: false, facilitator: false, viewer: false };
    mselRole.owner = !this.userMselRoles ? false : this.userMselRoles.some(umr =>
      umr.userId === userId &&
      umr.role === MselRole.Owner);
    mselRole.moveEditor = !this.userMselRoles ? false : this.userMselRoles.some(umr =>
      umr.userId === userId &&
      umr.role === MselRole.MoveEditor);
    if (mselRole.owner) {
      mselRole.approver = true;
      mselRole.editor = true;
      mselRole.moveEditor = true;
      mselRole.facilitator = true;
    } else if (this.scenarioEvents && this.scenarioEvents.length > 0) {
      const scenarioEvent = this.scenarioEvents.find(se => se.id === scenarioEventId);
      const assignedToDataField = this.dataFields.find(df => df.dataType === DataFieldType.Team);
      const dataValue = assignedToDataField &&
          scenarioEvent ? scenarioEvent.dataValues.find(dv => dv.dataFieldId === assignedToDataField.id) : null;
      if (dataValue) {
        const team = this.teams.find(t => t.shortName === dataValue.value);
        const isOnTeam = team && team.users && team.users.some(u => u.id === userId);
        if (isOnTeam && this.userMselRoles) {
          mselRole.approver = this.userMselRoles.some(umr =>
            umr.userId === userId &&
            umr.role === MselRole.Approver);
          mselRole.editor = mselRole.approver || this.userMselRoles.some(umr =>
            umr.userId === userId &&
            umr.role === MselRole.Editor);
          mselRole.facilitator = mselRole.approver || mselRole.editor || this.userMselRoles.some(umr =>
            umr.userId === userId &&
            umr.role === MselRole.Facilitator);
        }
      }
    }
    mselRole.viewer = !this.userMselRoles ? false : this.userMselRoles.some(umr =>
      (umr.userId === userId && umr.role === MselRole.Viewer) ||
      mselRole.editor || mselRole.approver || mselRole.moveEditor || mselRole.owner || mselRole.facilitator
    );

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
                    msel.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
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
          this.mselStore.set(msels);
        },
        (error) => {
          this.mselStore.set([]);
          this.mselStore.setLoading(false);
        }
      );
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
      .subscribe((s) => {
        this.mselStore.upsert(s.id, { ...s });
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
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
      .subscribe((s) => {
        this.mselStore.add(s);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
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
      .subscribe((s) => {
        this.mselStore.add(s);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
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
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  pushToCite(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pushToCite(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
        this.errorService.handleError(error);
      });
  }

  pullFromCite(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pullFromCite(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  pushToGallery(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pushToGallery(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
        this.errorService.handleError(error);
      });
  }

  pullFromGallery(mselId: string) {
    this.mselStore.setLoading(true);
    this.mselService
      .pullFromGallery(mselId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  delete(id: string) {
    this.mselService
      .deleteMsel(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  addTeamToMsel(mselId: string, teamId: string) {
    this.mselStore.setLoading(true);
    this.mselService.addTeamToMsel(mselId, teamId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  removeTeamFromMsel(mselId: string, teamId: string) {
    this.mselStore.setLoading(true);
    this.mselService.removeTeamFromMsel(mselId, teamId)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  addUserMselRole(userId: string, mselId: string, mselRole: MselRole) {
    this.mselStore.setLoading(true);
    this.mselService.addUserMselRole(userId, mselId, mselRole)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  removeUserMselRole(userId: string, mselId: string, mselRole: MselRole) {
    this.mselStore.setLoading(true);
    this.mselService.removeUserMselRole(userId, mselId, mselRole)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  downloadXlsx(id: string) {
    return this.mselService.download(id);
  }

  uploadXlsx(mselId: string, teamId: string, file: File, observe: any, reportProgress: boolean) {
    if (mselId) {
      return this.mselService.replaceWithXlsxFile(mselId, '', '', teamId, file, observe, reportProgress);
    }
    return this.mselService.uploadXlsxFiles('', '', teamId, file, observe, reportProgress);
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

  // addMselTeam(mselId: string, team: Team) {
  //   const msel = this.mselQuery.getById(mselId);
  //   if (!msel.teams.some(t => t.id === team.id)) {
  //     const updatedMsel: Msel = {... msel};
  //     updatedMsel.teams = [];
  //     msel.teams.forEach(t => {
  //       const updatedTeam = {... t};
  //       updatedMsel.teams.push(updatedTeam);
  //     });
  //     const newTeam = {... team};
  //     updatedMsel.teams.push(newTeam);
  //     this.mselStore.upsert(updatedMsel.id, updatedMsel);
  //   }
  // }

  // deleteMselTeam(mselId: string, teamId: string) {
  //   const msel = this.mselQuery.getById(mselId);
  //   const index = msel.teams.findIndex(t => t.id === teamId);
  //   if (index >= 0) {
  //     const updatedMsel: Msel = {... msel};
  //     updatedMsel.teams = [];
  //     for (let i = 0; i < msel.teams.length; i++) {
  //       if (i !== index) {
  //         const updatedTeam = {... msel.teams[i]};
  //         updatedMsel.teams.push(updatedTeam);
  //       }
  //     }
  //     this.mselStore.upsert(updatedMsel.id, updatedMsel);
  //   }
  // }

  // addUserRole(userMselRole: UserMselRole) {
  //   const msel = this.mselQuery.getById(userMselRole.mselId);
  //   if (!msel.userMselRoles.some(
  //     umr => umr.mselId === userMselRole.mselId && umr.userId === userMselRole.userId && umr.role === userMselRole.role)) {
  //     const updatedMsel: Msel = {... msel};
  //     updatedMsel.userMselRoles = [];
  //     msel.userMselRoles.forEach(umr => {
  //       const updatedUmr = {... umr};
  //       updatedMsel.userMselRoles.push(updatedUmr);
  //     });
  //     const newUmr = {... userMselRole};
  //     updatedMsel.userMselRoles.push(newUmr);
  //     this.mselStore.upsert(updatedMsel.id, updatedMsel);
  //   }
  // }

  // deleteUserRole(userMselRole: UserMselRole) {
  //   const msel = this.mselQuery.getById(userMselRole.mselId);
  //   const index = msel.userMselRoles.findIndex(umr => umr.id === userMselRole.id);
  //   if (index >= 0) {
  //     const updatedMsel: Msel = {... msel};
  //     updatedMsel.userMselRoles = [];
  //     for (let i = 0; i < msel.userMselRoles.length; i++) {
  //       if (i !== index) {
  //         const updatedTeam = {... msel.userMselRoles[i]};
  //         updatedMsel.userMselRoles.push(updatedTeam);
  //       }
  //     }
  //     this.mselStore.upsert(updatedMsel.id, updatedMsel);
  //   }
  // }

  private sortMsels(
    a: Msel,
    b: Msel,
    column: string,
    isAsc: boolean
  ) {
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

}
