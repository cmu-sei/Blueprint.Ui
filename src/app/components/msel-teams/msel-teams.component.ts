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
import { CasterService, CiteService } from 'src/app/generated/blueprint.api';
import { MatDialog } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { TeamAddDialogComponent } from '../team-add-dialog/team-add-dialog.component';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { animate, state, style, transition, trigger } from '@angular/animations';

const PLAYER_ADMIN_TEAM_VARIABLE = 'admin';

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
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator) {
    this.teamDataSource.paginator = paginator;
  }
  contextMenuPosition = { x: '0px', y: '0px' };
  sort: Sort = { active: 'name', direction: 'asc' };
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
  displayedColumns: string[] = ['action', 'shortName', 'name', 'email', 'teamType', 'invitation'];
  expandedElementId = '';
  isExpansionDetailRow = (i: number, row: Object) => (row as Team).id === this.expandedElementId;
  // the template variables a team can be mapped to; null until loaded, or when the MSEL has no Caster directory
  casterTeamVariables: string[] = null;
  // the ones the template gives no default, so a push is refused unless a team writes them
  requiredCasterTeamVariables: string[] = [];
  casterTeamVariablesError = '';
  private allTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private teamQuery: TeamQuery,
    private teamDataService: TeamDataService,
    private userQuery: UserQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private casterService: CasterService,
    private unitDataService: UnitDataService,
    private unitQuery: UnitQuery,
    private dialog: MatDialog,
    public dialogService: CrucibleDialogService,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.applyFilter(this.filterString);
        this.loadCasterTeamVariables();
      } else if (msel && (this.msel.useCaster !== msel.useCaster || this.msel.casterDirectoryId !== msel.casterDirectoryId)) {
        // a different template, or none, from the Info tab
        this.msel.useCaster = msel.useCaster;
        this.msel.casterDirectoryId = msel.casterDirectoryId;
        this.loadCasterTeamVariables();
      }
    });
    // subscribe to users
    this.userQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams. An empty emission is meaningful — it is what deleting the last team
    // looks like — so it must refresh the grid too. Skipping it left the deleted row on screen.
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.allTeams = teams ?? [];
      this.applyFilter(this.filterString);
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
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
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

  loadCasterTeamVariables() {
    this.casterTeamVariables = null;
    this.requiredCasterTeamVariables = [];
    this.casterTeamVariablesError = '';
    if (!this.msel.useCaster || !this.msel.casterDirectoryId) {
      this.setDisplayedColumns();
      return;
    }
    const directoryId = this.msel.casterDirectoryId;
    this.casterService.getCasterTeamVariables(directoryId).subscribe(
      (variables) => {
        if (this.msel.casterDirectoryId === directoryId) {
          this.casterTeamVariables = variables.map(v => v.name);
          this.requiredCasterTeamVariables = variables.filter(v => v.required).map(v => v.name);
          this.setDisplayedColumns();
        }
      },
      (error) => {
        console.error('Failed to load the Caster team variables:', error);
        this.casterTeamVariablesError = error?.error?.title || 'The Caster template could not be read.';
        this.setDisplayedColumns();
      }
    );
  }

  setDisplayedColumns() {
    // Team Type is the CITE team type, so it only matters when CITE is in use
    const columns = this.msel.useCite
      ? ['action', 'shortName', 'name', 'email', 'teamType', 'invitation']
      : ['action', 'shortName', 'name', 'email', 'invitation'];
    if (this.msel.useCaster && this.msel.casterDirectoryId) {
      columns.splice(columns.indexOf('invitation'), 0, 'topologyTeam');
    }
    this.displayedColumns = columns;
  }

  // The variable a team's Player team ID is written to: its mapping, or else its name the way
  // Blueprint (and Alloy before it) turns a name into a variable.
  getTeamVariable(team: Team): string {
    if (team.casterTeamVariable) {
      return team.casterTeamVariable;
    }
    const alloyName = (team.name ?? '').toLowerCase().replace(/ /g, '_').replace(/[@&'(\s)<>#]/g, '');
    const name = alloyName.replace(/[^\p{L}\p{Nd}_-]/gu, '');
    if (!name) {
      return '';
    }
    return /^[\p{L}_]/u.test(name) ? name : '_' + name;
  }

  // topology teams no MSEL team writes to, less the optional ones: the template has a default for those
  getUnmappedTopologyTeams(): string[] {
    if (!this.casterTeamVariables) {
      return [];
    }
    const used = this.allTeams.map(t => this.getTeamVariable(t));
    return this.casterTeamVariables.filter(v => !used.includes(v) &&
      (v === PLAYER_ADMIN_TEAM_VARIABLE || this.requiredCasterTeamVariables.includes(v)));
  }

  // Player adds an Admin team, holding only whoever creates the view, to every view Blueprint pushes;
  // by name it writes "admin" unless a MSEL team takes that variable
  getUnmappedTopologyTeamDestination(variable: string): string {
    return variable === PLAYER_ADMIN_TEAM_VARIABLE
      ? 'Its VMs will go to the Player view\'s own Admin team.'
      : 'The Caster template requires one, so Push will be refused.';
  }

  // the team mapped to the variable this unmapped team would get by name, which then replaces it
  getMappedOverTeam(team: Team): Team {
    if (team.casterTeamVariable) {
      return null;
    }
    const variable = this.getTeamVariable(team);
    return this.allTeams.find(t => t.id !== team.id && t.casterTeamVariable === variable) ?? null;
  }

  // teams mapped to a variable the template no longer declares
  getStaleMappings(): Team[] {
    if (!this.casterTeamVariables) {
      return [];
    }
    return this.allTeams.filter(t => t.casterTeamVariable && !this.casterTeamVariables.includes(t.casterTeamVariable));
  }

  addOrEditTeam(team: Team) {
    if (!team) {
      team = {
        name: '',
        shortName: '',
        description: '',
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
        teamTypeList: this.teamTypeList,
        casterTeamVariables: this.casterTeamVariables
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
      .confirm({ title: 'Delete Team', message: 'Are you sure that you want to delete ' + team.name + '?'
       }).afterClosed().subscribe((result) => {
        if (result) {
          this.teamDataService.delete(team.id);
        }
      });
  }

  refreshUnits() {
    this.unitDataService.load();
  }

  addTeamFromUnit() {
    const dialogRef = this.dialog.open(TeamAddDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '600px',
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
          team.shortName.toLowerCase().indexOf(filterValue) >= 0))
      .sort((a, b) => this.sortTeams(a, b));
    this.teamDataSource.data = this.teamList;
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortTeams(a: Team, b: Team): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    switch (this.sort.active) {
      case 'name':
        return (a.name?.toLowerCase() ?? '') < (b.name?.toLowerCase() ?? '') ? -dir : dir;
      case 'email':
        return (a.email?.toLowerCase() ?? '') < (b.email?.toLowerCase() ?? '') ? -dir : dir;
      case 'teamType':
        return (this.getCiteTeamTypeName(a.citeTeamTypeId)?.toLowerCase() ?? '') <
          (this.getCiteTeamTypeName(b.citeTeamTypeId)?.toLowerCase() ?? '') ? -dir : dir;
      default:
        return (a.shortName?.toLowerCase() ?? '') < (b.shortName?.toLowerCase() ?? '') ? -dir : dir;
    }
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
