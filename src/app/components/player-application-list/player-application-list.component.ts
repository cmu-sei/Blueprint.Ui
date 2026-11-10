// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApplicationTemplate, PlayerApplication, Move, SystemPermission, Team } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort, MatSort, MatSortHeader } from '@angular/material/sort';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { PlayerApplicationDataService } from 'src/app/data/player-application/player-application-data.service';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { PlayerApplicationQuery } from 'src/app/data/player-application/player-application.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatDialog } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { PlayerApplicationEditDialogComponent } from '../player-application-edit-dialog/player-application-edit-dialog.component';
import { ItemDownloadDialogComponent } from '../item-download-dialog/item-download-dialog.component';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { v4 as uuidv4 } from 'uuid';
import { MatTable, MatTableDataSource, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { casterVmAppWarning } from 'src/app/utilities/caster-vm-app';
import { playerAppIconUrl } from 'src/app/utilities/player-app-icon';
import { MatIcon } from '@angular/material/icon';

import { MatExpansionPanel, MatExpansionPanelHeader } from '@angular/material/expansion';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { NgTemplateOutlet } from '@angular/common';
import { PlayerApplicationTeamsComponent } from '../player-application-teams/player-application-teams.component';
import { PlayerTeamAppOrderComponent } from '../player-team-app-order/player-team-app-order.component';

@Component({
    selector: 'app-player-application-list',
    templateUrl: './player-application-list.component.html',
    styleUrls: ['./player-application-list.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
            state('expanded', style({ height: '*', visibility: 'visible' })),
            transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
        ]),
    ],
    imports: [MatIcon, MatMenu, MatMenuItem, MatExpansionPanel, MatExpansionPanelHeader, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatIconButton, MatMenuTrigger, MatCellDef, MatCell, MatSortHeader, MatTooltip, MatCheckbox, PlayerApplicationTeamsComponent, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, PlayerTeamAppOrderComponent, MatDivider, NgTemplateOutlet]
})
export class PlayerApplicationListComponent implements OnDestroy, OnInit {
  private mselQuery = inject(MselQuery);
  private playerApplicationDataService = inject(PlayerApplicationDataService);
  private playerApplicationQuery = inject(PlayerApplicationQuery);
  private teamQuery = inject(TeamQuery);
  private playerService = inject(PlayerService);
  private playerApplicationTeamDataService = inject(PlayerApplicationTeamDataService);
  dialog = inject(MatDialog);
  dialogService = inject(CrucibleDialogService);
  private permissionDataService = inject(PermissionDataService);
  private settingsService = inject(ComnSettingsService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  readonly loggedInUserId = input<string>(undefined);
  // canEdit and showTemplates are set by the admin page, which manages the system-wide templates
  readonly canEdit = input<boolean>(undefined);
  readonly showTemplates = input<boolean>(undefined);
  // context menu
  readonly contextMenu = viewChild(MatMenuTrigger);
  readonly appTable = viewChild<MatTable<any>>('appTable');
  readonly jsonInput = viewChild<ElementRef<HTMLInputElement>>('jsonInput');
  msel = new MselPlus();
  mselTeamList: Team[] = [];
  // Blueprint's own templates, then the ones Player has, which are offered as a second source
  templateList: PlayerApplication[] = [];
  playerTemplateList: ApplicationTemplate[] = [];
  playerApplicationList: PlayerApplication[] = [];
  filteredPlayerApplicationList: PlayerApplication[] = [];
  sort: Sort = { active: '', direction: '' };
  sortedPlayerApplications: PlayerApplication[] = [];
  appDataSource = new MatTableDataSource<PlayerApplication>(new Array<PlayerApplication>());
  displayedColumns: string[] = ['action', 'name', 'url', 'icon', 'embeddable', 'loadInBackground'];
  expandedId = '';
  brokenIcons = new Set<string>();
  isExpansionDetailRow = (i: number, row: Object) => (row as PlayerApplication).id === this.expandedId;
  contextMenuPosition = { x: '0px', y: '0px' };
  moveList: Move[] = [];
  private unsubscribe$ = new Subject();

  constructor() {
    // subscribe to playerApplications
    this.playerApplicationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(playerApplications => {
      this.playerApplicationList = playerApplications;
      this.sortChanged(this.sort);
    });
    // subscribe to teams from the store, so a team added on the Teams tab can be added to an application
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.mselTeamList = teams;
    });
    // load Blueprint's playerApplication templates
    this.playerApplicationDataService.loadTemplates();
  }

  ngOnInit() {
    // the admin page lists the templates alone, with no MSEL behind them
    if (!this.showTemplates()) {
      // subscribe to the active MSEL
      (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
        Object.assign(this.msel, msel);
        if (msel) {
          this.playerApplicationDataService.loadByMsel(msel.id);
          this.playerApplicationTeamDataService.getPlayerApplicationTeamsFromApi(msel.id);
        }
        this.sortedPlayerApplications = this.getSortedPlayerApplications(this.getFilteredPlayerApplications());
      });
      // load Player's application templates, offered after Blueprint's own
      this.playerService.getApplicationTemplates().subscribe(
        (templates) => {
          this.playerTemplateList = templates || [];
        },
        (error) => {
          console.error('Failed to load Player application templates:', error);
          this.playerTemplateList = [];
        }
      );
    } else {
      // the store may already hold templates, which the constructor filtered before this input was set
      this.sortChanged(this.sort);
    }
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
  }

  getIconUrl(icon: string): string {
    return playerAppIconUrl(icon, this.settingsService.settings);
  }

  casterVmAppWarningMessage(): string {
    return casterVmAppWarning(this.msel, this.playerApplicationList, this.settingsService.settings.VmUrl);
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').editor;
  }

  // whether the rows shown can be added, edited and deleted: the templates on the admin page, or a MSEL's applications
  canEditList(): boolean {
    return this.showTemplates()
      ? !!this.canEdit()
      : this.canEditMsel() || this.msel.hasRole(this.loggedInUserId(), null).owner;
  }

  canManageTemplates(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManagePlayerApplications);
  }

  expandPlayerApplication(playerApplicationId: string) {
    if (playerApplicationId === this.expandedId) {
      this.expandedId = '';
    } else {
      this.expandedId = playerApplicationId;
    }
  }

  rowClicked(row: PlayerApplication) {
    // a template is on no team, so it has no team selection to expand
    if (this.showTemplates()) {
      return;
    }
    this.expandPlayerApplication(row.id);
    this.appTable().renderRows();
  }

  getRowClass(id: string) {
    return this.expandedId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
  }

  addOrEditPlayerApplication(playerApplication: PlayerApplication, dialogTitle: string) {
    if (!playerApplication) {
      playerApplication = {
        mselId: this.showTemplates() ? null : this.msel.id,
        isTemplate: !!this.showTemplates(),
        name: '',
        url: '',
        icon: '',
        embeddable: true,
        loadInBackground: false,
      };
    } else {
      playerApplication = { ...playerApplication };
    }
    const dialogRef = this.dialog.open(PlayerApplicationEditDialogComponent, {
      minWidth: '700px',
      maxWidth: '90vw',
      width: 'auto',
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

  /**
   * Opens the add dialog with a copy of a template's values: a Blueprint template, or one of Player's.
   * The copy is a new application of this MSEL, so it takes neither the template's id nor its flag.
   */
  addFromTemplate(template: PlayerApplication | ApplicationTemplate) {
    this.addOrEditPlayerApplication(this.copyOf(template, this.msel.id, false), 'Add a Player Application');
  }

  /**
   * Opens the add dialog for a new template carrying a MSEL application's values.
   */
  makeTemplate(playerApplication: PlayerApplication) {
    this.addOrEditPlayerApplication(this.copyOf(playerApplication, null, true), 'Add a Player Application Template');
  }

  private copyOf(source: PlayerApplication | ApplicationTemplate, mselId: string, isTemplate: boolean): PlayerApplication {
    return {
      mselId: mselId,
      isTemplate: isTemplate,
      name: source.name,
      url: source.url,
      icon: source.icon,
      embeddable: source.embeddable,
      loadInBackground: source.loadInBackground,
    };
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
    const title = this.showTemplates() ? 'Delete Player Application Template' : 'Delete PlayerApplication';
    this.dialogService
      .confirm({ title: title, message: 'Are you sure that you want to delete ' + playerApplication.name + '?'
       }).afterClosed().subscribe((result) => {
        if (result) {
          this.playerApplicationDataService.delete(playerApplication.id);
          this.expandedId = '';
        }
      });
  }

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.playerApplicationDataService.uploadJson(file, 'events', true);
    this.jsonInput().nativeElement.value = null;
  }

  openDownloadDialog() {
    const items = (this.templateList || []).map((a) => ({
      id: a.id,
      label: a.name || a.id,
    }));
    const dialogRef = this.dialog.open(ItemDownloadDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      data: {
        title: 'Select Player Application templates to download',
        items,
      },
    });
    dialogRef.afterClosed().subscribe((selectedIds: string[] | undefined) => {
      if (selectedIds && selectedIds.length > 0) {
        this.downloadJsonItems(selectedIds);
      }
    });
  }

  downloadJsonItems(ids: string[]) {
    this.playerApplicationDataService.downloadJson(ids).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = 'player-application-templates.json';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedPlayerApplications = this.getSortedPlayerApplications(
      this.getFilteredPlayerApplications()
    );
    this.templateList = (this.playerApplicationList || [])
      .filter((pa) => pa.isTemplate && !pa.mselId)
      .sort((a, b) => ((a.name || '').toLowerCase() < (b.name || '').toLowerCase() ? -1 : 1));
  }

  getFilteredPlayerApplications(): PlayerApplication[] {
    const playerApplications = this.playerApplicationList;
    const showTemplates = !!this.showTemplates();
    const mselId = showTemplates ? '' : this.msel?.id;
    const filteredPlayerApplications: PlayerApplication[] = [];
    if (playerApplications) {
      playerApplications.forEach((playerApplication) => {
        if (
          (mselId && playerApplication.mselId === mselId) ||
          (showTemplates && !playerApplication.mselId && playerApplication.isTemplate)
        ) {
          filteredPlayerApplications.push({ ...playerApplication });
        }
      });
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
    this.appDataSource.data = playerApplications || [];
    return playerApplications;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
