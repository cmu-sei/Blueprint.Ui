// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserQuery } from 'src/app/data/user/user.query';
import {
  DataField,
  TeamRole,
  ScenarioEvent,
  SystemPermission,
  Team,
  TeamType,
  Unit,
  User
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatMenuTrigger } from '@angular/material/menu';
import { CiteService } from 'src/app/generated/blueprint.api';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { TeamAddDialogComponent } from '../team-add-dialog/team-add-dialog.component';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
    selector: 'app-msel-teams',
    templateUrl: './msel-teams.component.html',
    styleUrls: ['./msel-teams.component.scss'],
    animations: [
      trigger('detailExpand', [
        state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
        state('expanded', style({ height: '*', visibility: 'visible' })),
        transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      ]),
    ],
    standalone: false
})
export class MselTeamsComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() teamTypeList: TeamType[];
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  @ViewChild('teamTable', { static: false }) teamTable: MatTable<any>;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedSectionIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  isEditEnabled = false;
  editTeamId = '';
  userList: User[] = [];
  teamList: Team[] = [];
  unitList: Unit[] = [];
  filterString = '';
  teamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  displayedColumns: string[] = ['action', 'name', 'email', 'teamType', 'invitation', 'search'];
  expandedElementId = '';
  isExpansionDetailRow = (i: number, row: Object) => (row as Team).id === this.expandedElementId;
  private allTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private teamQuery: TeamQuery,
    private teamDataService: TeamDataService,
    private userQuery: UserQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private unitQuery: UnitQuery,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.teamList = this.allTeams.filter(t => t.mselId === this.msel.id);
        this.teamDataSource.data = this.teamList;
      }
    });
    // subscribe to users
    this.userQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      if (teams && teams.length > 0) {
        this.allTeams = teams.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
        this.teamList = this.allTeams.filter(t => t.mselId === this.msel.id);
        this.teamDataSource.data = this.teamList;
      }
    });
    // subscribe to TeamTypes
    this.citeService.getTeamTypes().subscribe(
      (teamTypes) => {
        this.teamTypeList = teamTypes;
      },
      (error) => {
        console.error('Failed to load CITE team types:', error);
        this.teamTypeList = [];
      }
    );
    // subscribe to units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      if (units && units.length > 0) {
        this.unitList = units.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
      }
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

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'unknown';
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').editor;
  }

  getTeamList() {
    let teamList = this.allTeams;
    if (this.msel && this.teamList && this.teamList.length > 0 && teamList.length > 0) {
      const teamIds = new Set(this.teamList.map(mt => mt.id));
      teamList = this.allTeams.filter(t => !teamIds.has(t.id));
    }

    return teamList;
  }

  getCiteTeamTypeName(id: string): string {
    const teamType = this.teamTypeList?.find(x => x.id === id);
    return teamType ? teamType.name : ' ';
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isEditEnabled = false;
  }

  cancelChanges() {
    this.isEditEnabled = false;
    Object.assign(this.msel, this.originalMsel);
  }

  trackByFn(index, item) {
    return item.id;
  }

  addOrEditTeam(team: Team) {
    if (!team) {
      team = {
        name: '',
        shortName: '',
        mselId: this.msel.id
      };
    } else {
      team = { ...team };
    }
    const dialogRef = this.dialog.open(TeamEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        team: team,
        useCite: this.msel.useCite,
        teamTypeList: this.teamTypeList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.team) {
        this.saveTeam(result.team);
      }
      dialogRef.close();
    });
  }

  saveTeam(team: Team) {
    if (team.id) {
      this.teamDataService.updateTeam(team);
    } else {
      this.teamDataService.add(team);
    }
  }

  deleteTeam(team: Team): void {
    this.dialogService
      .confirm(
        'Delete Team',
        'Are you sure that you want to delete ' + team.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.teamDataService.delete(team.id);
        }
      });
  }

  addTeamFromUnit() {
    const dialogRef = this.dialog.open(TeamAddDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      maxHeight: '80vh',
      data: {
        unitList: this.unitList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.unitId) {
        this.teamDataService.addFromUnit(this.msel.id, result.unitId);
      }
      dialogRef.close();
    });
  }

  getAvailableUsers(teamId: string): any {
    const otherTeamUsers = [] as User[];
    this.teamList.forEach(t => {
      if (t.id !== teamId) {
        t.users.forEach(u => {
          otherTeamUsers.push(u);
        });
      }
    });
    const availableUsers = [];
    this.userList.forEach(u => {
      const availableUser = { ...u } as any;
      availableUser.onATeam = otherTeamUsers.some(tu => tu.id === u.id);
      availableUsers.push(availableUser);
    });
    return availableUsers;
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.toLowerCase();
    this.teamList = this.allTeams
      .filter(team =>
        team.mselId === this.msel.id &&
        (team.name.toLowerCase().indexOf(filterValue) >= 0 ||
          team.shortName.toLowerCase().indexOf(filterValue) >= 0));
    this.teamDataSource.data = this.teamList;
  }

  rowClicked(row: Team) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.teamTable.renderRows();
  }

  getRowClass(id: string) {
    return this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
