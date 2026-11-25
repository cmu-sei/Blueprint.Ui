// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import {
  FormControl,
  UntypedFormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Organization } from 'src/app/generated/blueprint.api';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  MatFormField,
  MatLabel,
  MatInput,
  MatError,
  MatHint,
} from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { AccessNetworksComponent } from '../msel-networks/access-networks.component';

@Component({
  selector: 'app-organization-edit-dialog',
  templateUrl: './organization-edit-dialog.component.html',
  styleUrls: ['./organization-edit-dialog.component.scss'],
  imports: [
    AccessNetworksComponent,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatFormField,
    MatLabel,
    MatInput,
    FormsModule,
    ReactiveFormsModule,
    MatError,
    MatHint,
    MatButton,
    AngularEditorModule,
  ],
})
export class OrganizationEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();

  public organizationNameFormControl = new UntypedFormControl(
    this.data.organization.name,
    [Validators.required],
  );
  public organizationShortNameFormControl = new UntypedFormControl(
    this.data.organization.shortName,
    [Validators.required],
  );
  public organizationEmailFormControl = new UntypedFormControl(
    this.data.organization.email,
    [Validators.required],
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.organization.description,
    [],
  );
  public summaryFormControl = new UntypedFormControl(
    this.data.organization.summary,
    [Validators.required],
  );
  // the organization the dialog edits, typed, for its domain
  private readonly editedOrganization = (
    this.data as { organization: Organization }
  ).organization;
  public domainFormControl = new FormControl<string>(
    this.editedOrganization.domain ?? '',
    { nonNullable: true },
  );
  editorConfig = EDITOR_CONFIG;

  errorFree() {
    return !(
      this.organizationNameFormControl.hasError('required') ||
      this.organizationNameFormControl.hasError('minlength') ||
      this.organizationShortNameFormControl.hasError('required') ||
      this.organizationShortNameFormControl.hasError('minlength') ||
      this.organizationEmailFormControl.hasError('required') ||
      this.organizationEmailFormControl.hasError('minlength') ||
      this.summaryFormControl.hasError('required') ||
      this.summaryFormControl.hasError('minlength')
    );
  }

  trimInitialDescription() {
    if (
      this.descriptionFormControl.value &&
      this.descriptionFormControl.value.toString()[0] === ' '
    ) {
      this.descriptionFormControl.setValue(
        this.descriptionFormControl.value.toString().trim(),
      );
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, organization: null });
    } else {
      this.data.organization.name = this.organizationNameFormControl.value
        .toString()
        .trim();
      this.data.organization.description = this.descriptionFormControl.value
        .toString()
        .trim();
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          organization: this.data.organization,
        });
      }
    }
  }

  /**
   * Saves the current organization
   */
  saveOrganization(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.organization.name = this.organizationNameFormControl.value
          ? this.organizationNameFormControl.value.toString()
          : '';
        break;
      case 'shortName':
        this.data.organization.shortName = this.organizationShortNameFormControl
          .value
          ? this.organizationShortNameFormControl.value.toString()
          : '';
        break;
      case 'description':
        this.data.organization.description = this.descriptionFormControl.value
          ? this.descriptionFormControl.value.toString()
          : '';
        break;
      case 'summary':
        this.data.organization.summary = this.summaryFormControl.value;
        break;
      case 'email':
        this.data.organization.email = this.organizationEmailFormControl.value
          ? this.organizationEmailFormControl.value.toString()
          : '';
        break;
      case 'domain':
        this.editedOrganization.domain =
          this.domainFormControl.value.trim().toLowerCase() || null;
        break;
      default:
        break;
    }
  }

  /**
   * The part of the email after the @, offered as the domain; never applied
   * unless the planner chooses it
   */
  emailDomain(): string {
    const value: unknown = this.organizationEmailFormControl.value;
    const email = typeof value === 'string' ? value : '';
    const at = email.lastIndexOf('@');

    return at > 0
      ? email
          .substring(at + 1)
          .trim()
          .toLowerCase()
      : '';
  }

  useEmailDomain(): void {
    this.domainFormControl.setValue(this.emailDomain());
    this.saveOrganization('domain');
  }
}
