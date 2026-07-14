// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-invitation-edit-dialog',
    templateUrl: './invitation-edit-dialog.component.html',
    styleUrls: ['./invitation-edit-dialog.component.scss'],
    standalone: false
})

export class InvitationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  errorFree() {
    return this.data.invitation.teamId &&
      (!this.data.invitation.emailDomain ||
        (this.data.invitation.emailDomain.length > 3 &&
          this.data.invitation.emailDomain.includes('@')
        )
      );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, invitation: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          invitation: this.data.invitation,
        });
      }
    }
  }

  getTeamName(teamId: string) {
    const team = this.data.teamList.find(t => t.id === teamId);
    return team.shortName + ' - ' + team.name;
  }

  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  getTimezoneAbbr(): string {
    try {
      const date = new Date();
    const timeZone = this.getUserTimezone();
    const formatted = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone
    });
    const parts = formatted.split(' ');
    return parts[parts.length - 1] || 'UTC';
    } catch {
      return 'UTC';
    }
  }

}
