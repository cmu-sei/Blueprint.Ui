// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PlayerApplication, Move, SystemPermission, Team } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { PlayerApplicationDataService } from 'src/app/data/player-application/player-application-data.service';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { PlayerApplicationQuery } from 'src/app/data/player-application/player-application.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { PlayerApplicationEditDialogComponent } from '../player-application-edit-dialog/player-application-edit-dialog.component';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-player-application-list',
  templateUrl: './player-application-list.component.html',
  styleUrls: ['./player-application-list.component.scss'],
  standalone: false
})
export class PlayerApplicationListComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  msel = new MselPlus();
  mselTeamList: Team[] = [];
  templateList: PlayerApplication[] = [];
  playerApplicationList: PlayerApplication[] = [];
  filteredPlayerApplicationList: PlayerApplication[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  sortedPlayerApplications: PlayerApplication[] = [];
  expandedId = '';
  contextMenuPosition = { x: '0px', y: '0px' };
  moveList: Move[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private playerApplicationDataService: PlayerApplicationDataService,
    private playerApplicationQuery: PlayerApplicationQuery,
    private playerService: PlayerService,
    private playerApplicationTeamDataService: PlayerApplicationTeamDataService,
    public dialog: MatDialog,
    public dialogService: DialogService,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // subscribe to playerApplications
    this.playerApplicationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(playerApplications => {
      this.playerApplicationList = playerApplications;
      this.sortChanged(this.sort);
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      Object.assign(this.msel, msel);
      if (msel) {
        this.playerApplicationDataService.loadByMsel(msel.id);
        this.playerApplicationTeamDataService.getPlayerApplicationTeamsFromApi(msel.id);
        this.mselTeamList = msel.teams;
      }
      this.sortedPlayerApplications = this.getSortedPlayerApplications(this.getFilteredPlayerApplications());
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedPlayerApplications = this.getSortedPlayerApplications(this.getFilteredPlayerApplications());
      });
    // load playerApplication templates
    this.playerService.getApplicationTemplates().subscribe(templates => {
      templates.forEach(t => {
        t.id = '';
      });
      this.templateList = templates;
    });
  }

  ngOnInit() {
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').editor;
  }

  expandPlayerApplication(playerApplicationId: string) {
    if (playerApplicationId === this.expandedId) {
      this.expandedId = '';
    } else {
      this.expandedId = playerApplicationId;
    }
  }

  addOrEditPlayerApplication(playerApplication: PlayerApplication, dialogTitle: string) {
    if (!playerApplication) {
      playerApplication = {
        mselId: this.msel.id,
        name: '',
        url: '',
        icon: '',
        embeddable: true,
        loadInBackground: false,
      };
    } else {
      playerApplication = { ...playerApplication };
      playerApplication.mselId = this.msel.id;
    }
    const dialogRef = this.dialog.open(PlayerApplicationEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        playerApplication: { ...playerApplication },
        title: dialogTitle,
        moveList: this.moveList
          .filter(m => m.mselId === this.msel.id)
          .sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1)
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.playerApplication) {
        this.savePlayerApplication(result.playerApplication);
      }
      dialogRef.close();
    });
  }

  savePlayerApplication(playerApplication: PlayerApplication) {
    if (playerApplication.id) {
      this.playerApplicationDataService.updatePlayerApplication(playerApplication);
    } else {
      playerApplication.id = uuidv4();
      this.playerApplicationDataService.add(playerApplication);
    }
  }

  deletePlayerApplication(playerApplication: PlayerApplication): void {
    this.dialogService
      .confirm(
        'Delete PlayerApplication',
        'Are you sure that you want to delete ' + playerApplication.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.playerApplicationDataService.delete(playerApplication.id);
          this.expandedId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedPlayerApplications = this.getSortedPlayerApplications(
      this.getFilteredPlayerApplications()
    );
  }

  getFilteredPlayerApplications(): PlayerApplication[] {
    const playerApplications = this.playerApplicationList;
    const mselId = this.msel?.id;
    let filteredPlayerApplications: PlayerApplication[] = [];
    if (playerApplications) {
      playerApplications.forEach((playerApplication) => {
        if (
          (mselId && playerApplication.mselId === mselId) ||
          (!mselId && !playerApplication.mselId)
        ) {
          filteredPlayerApplications.push({ ...playerApplication });
        }
      });
      if (
        filteredPlayerApplications &&
        filteredPlayerApplications.length > 0 &&
        this.filterString
      ) {
        const filterString = this.filterString.toLowerCase();
        filteredPlayerApplications = filteredPlayerApplications.filter((a) =>
          a.name.toLowerCase().includes(filterString)
        );
      }
    }
    return filteredPlayerApplications;
  }

  getSortedPlayerApplications(playerApplications: PlayerApplication[]) {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    if (playerApplications) {
      switch (this.sort.active) {
        case 'name':
          playerApplications.sort((a, b) =>
            (a.name ? a.name : '').toLowerCase() >
              (b.name ? b.name : '').toLowerCase()
              ? dir
              : -dir
          );
          break;
        default:
          playerApplications.sort((a, b) =>
            a.name.toLowerCase() > b.name.toLowerCase() ? dir : -dir
          );
          break;
      }
    }
    return playerApplications;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
