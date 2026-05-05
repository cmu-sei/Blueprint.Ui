// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Invitation,
  MselItemStatus,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { InvitationDataService } from 'src/app/data/invitation/invitation-data.service';
import { InvitationQuery } from 'src/app/data/invitation/invitation.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { InvitationEditDialogComponent } from '../invitation-edit-dialog/invitation-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-invitation-list',
    templateUrl: './invitation-list.component.html',
    styleUrls: ['./invitation-list.component.scss'],
    standalone: false
})
export class InvitationListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() canEditMsel: boolean;
  @Input() hideSearch: boolean;
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator) {
    this.invitationDataSource.paginator = paginator;
  }
  msel = new MselPlus();
  invitationList: Invitation[] = [];
  filterString = '';
  sort: Sort = { active: 'teamId', direction: 'asc' };
  invitationDataSource = new MatTableDataSource<Invitation>(new Array<Invitation>());
  displayedColumns: string[] = ['action', 'teamId', 'emailDomain', 'expirationDateTime', 'usesAllowed', 'usesRemaining'];
  teamList: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private invitationDataService: InvitationDataService,
    private invitationQuery: InvitationQuery,
    private teamQuery: TeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to invitations
    this.invitationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(invitations => {
      this.invitationList = invitations;
      this.applyFilter(this.filterString);
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.applyFilter(this.filterString);
      }
    });
    // subscribe to the MSEL teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
    });
  }

  addOrEditInvitation(invitation: Invitation, makeTemplate: boolean) {
    if (!invitation) {
      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 30);
      invitation = {
        mselId: this.msel.id,
        expirationDateTime: dateTime,
        maxUsersAllowed: 1,
        userCount: 0,
        isTeamLeader: false,
        wasDeactivated: false
      };
    }
    const dialogRef = this.dialog.open(InvitationEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        invitation: invitation,
        teamList: this.teamList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.invitation) {
        this.saveInvitation(result.invitation);
      }
      dialogRef.close();
    });
  }

  saveInvitation(invitation: Invitation) {
    if (invitation.id) {
      this.invitationDataService.update(invitation);
    } else {
      invitation.id = uuidv4();
      this.invitationDataService.add(invitation);
    }
  }

  deleteInvitation(invitation: Invitation): void {
    this.dialogService
      .confirm(
        'Delete Invitation',
        'Are you sure that you want to delete the invitation for ' + invitation.emailDomain + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.invitationDataService.delete(invitation.id);
        }
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    const term = filterValue.toLowerCase();
    const filtered = this.invitationList
      .filter(inv => inv.mselId === this.msel.id)
      .filter(inv =>
        !term ||
        this.getTeamName(inv.teamId)?.toLowerCase().includes(term) ||
        inv.emailDomain?.toLowerCase().includes(term)
      )
      .sort((a, b) => this.sortInvitations(a, b));
    this.invitationDataSource.data = filtered;
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortInvitations(a: Invitation, b: Invitation): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    switch (this.sort.active) {
      case 'teamId':
        return (this.getTeamName(a.teamId)?.toLowerCase() ?? '') <
          (this.getTeamName(b.teamId)?.toLowerCase() ?? '') ? -dir : dir;
      case 'emailDomain':
        return (a.emailDomain?.toLowerCase() ?? '') < (b.emailDomain?.toLowerCase() ?? '') ? -dir : dir;
      case 'expirationDateTime':
        return (a.expirationDateTime ?? '') < (b.expirationDateTime ?? '') ? -dir : dir;
      case 'usesAllowed':
        return (a.maxUsersAllowed ?? 0) < (b.maxUsersAllowed ?? 0) ? -dir : dir;
      case 'usesRemaining':
        return ((a.maxUsersAllowed ?? 0) - (a.userCount ?? 0)) <
          ((b.maxUsersAllowed ?? 0) - (b.userCount ?? 0)) ? -dir : dir;
      default:
        return 0;
    }
  }

  getInvitationLink(teamId: string) {
    if (this.msel.isTemplate && this.msel.status === MselItemStatus.Approved) {
      return document.baseURI + '/launch/?msel=' + this.msel.id + '&team=' + teamId;
    } else if (!this.msel.isTemplate && this.msel.status === MselItemStatus.Deployed) {
      return document.baseURI + '/join/?msel=' + this.msel.id + '&team=' + teamId;
    } else {
      return '';
    }
  }

  getTeamName(teamId: string) {
    const teamName = this.teamList.find(t => t.id === teamId)?.shortName;
    return teamName;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
