// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { UntypedFormControl, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';

@Component({
    selector: 'app-player-applicationedit-dialog',
    templateUrl: './player-application-edit-dialog.component.html',
    styleUrls: ['./player-application-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, MatCheckbox]
})

export class PlayerApplicationEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.playerApplication.situationTime,
    []
  );
  public playerApplicationStartTimeFormControl = new UntypedFormControl(
    this.data.playerApplication.playerApplicationStartTime,
    []
  );
  public playerApplicationStopTimeFormControl = new UntypedFormControl(
    this.data.playerApplication.playerApplicationStopTime,
    []
  );

  public urlValidationError: string = '';
  public iconValidationError: string = '';

  private readonly allowedVariables = [
    'citeUrl',
    'galleryUrl',
    'steamfitterUrl',
    'playerUrl',
    'blueprintUrl',
    'casterUrl',
    'vmUrl',
    'citeEvaluationId',
    'galleryExhibitId',
    'steamfitterScenarioId',
    'playerViewId',
    'casterWorkspaceId',
    'blueprintMselId',
    'theme'
  ];

  savePlayerApplication(which: string) {
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        this.data.playerApplication.situationTime = newPosted;
        break;
      case 'playerApplicationStartTime':
        const playerApplicationStartTime = this.playerApplicationStartTimeFormControl.value;
        this.data.playerApplication.playerApplicationStartTime = playerApplicationStartTime;
        break;
      case 'playerApplicationStopTime':
        const playerApplicationStopTime = this.playerApplicationStopTimeFormControl.value;
        this.data.playerApplication.playerApplicationStopTime = playerApplicationStopTime;
        break;
      default:
        break;
    }
  }

  /**
   * Validates a URL for unknown variable placeholders and unpaired braces
   */
  validateUrl(url: string): string {
    if (!url) return '';

    const variablePattern = /\{([^}]+)\}/g;
    const matches = [...url.matchAll(variablePattern)];
    const unknownVars: string[] = [];

    // Check for unknown variables in complete {var} patterns
    matches.forEach(match => {
      const varName = match[1];
      if (!this.allowedVariables.includes(varName)) {
        unknownVars.push(varName);
      }
    });

    if (unknownVars.length > 0) {
      return `Unknown variable(s): {${unknownVars.join('}, {')}}`;
    }

    // Remove all valid variable patterns
    let cleanedUrl = url;
    this.allowedVariables.forEach(varName => {
      cleanedUrl = cleanedUrl.replace(new RegExp(`\\{${varName}\\}`, 'g'), '');
    });

    // Check for any remaining braces (orphaned or part of invalid patterns)
    if (cleanedUrl.includes('{') || cleanedUrl.includes('}')) {
      return 'URL contains unpaired or invalid braces';
    }

    return '';
  }

  /**
   * Validates URLs before save
   */
  validateUrls(): boolean {
    this.urlValidationError = this.validateUrl(this.data.playerApplication.url);
    this.iconValidationError = this.validateUrl(this.data.playerApplication.icon);

    return !this.urlValidationError && !this.iconValidationError;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, playerApplication: null });
    } else {
      if (!this.validateUrls()) {
        return;
      }
      this.editComplete.emit({
        saveChanges: saveChanges,
        playerApplication: this.data.playerApplication,
      });
    }
  }

}
