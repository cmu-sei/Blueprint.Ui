// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  MatFormField,
  MatLabel,
  MatInput,
  MatHint,
} from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TechniqueFileFormat } from 'src/app/generated/blueprint.api';
import { TechniqueFrameworkDefinition } from 'src/app/data/technique-framework/technique-framework-data.service';

/** The parts of a definition the dialog edits as fields; the settings are edited as JSON. */
export interface TechniqueFrameworkForm {
  name: string;
  description: string;
  domain: string;
  isDefensive: boolean;
  format: TechniqueFileFormat;
  settingsJson: string;
}

export function toForm(
  definition: TechniqueFrameworkDefinition | null,
): TechniqueFrameworkForm {
  return {
    name: definition?.name ?? '',
    description: definition?.description ?? '',
    domain: definition?.domain ?? '',
    isDefensive: !!definition?.isDefensive,
    format: definition?.format ?? TechniqueFileFormat.StixBundle,
    settingsJson: JSON.stringify(
      definition?.settings ?? { match: {} },
      null,
      2,
    ),
  };
}

/**
 * Creates or edits a technique framework definition: its name, domain, family and file format as fields, and
 * the rest (match conditions, format options, mappings, links and download hints) as the JSON an export holds.
 */
@Component({
  selector: 'app-admin-technique-framework-dialog',
  templateUrl: './admin-technique-framework-dialog.component.html',
  styleUrls: ['./admin-technique-framework-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatSelect,
    MatOption,
    FormsModule,
  ],
})
export class AdminTechniqueFrameworkDialogComponent {
  data = inject<{ title: string; form: TechniqueFrameworkForm }>(
    MAT_DIALOG_DATA,
  );

  readonly editComplete = output<{
    saveChanges: boolean;
    definition: TechniqueFrameworkDefinition | null;
  }>();

  readonly formats = [
    { value: TechniqueFileFormat.StixBundle, label: 'STIX bundle' },
    { value: TechniqueFileFormat.JsonLdOntology, label: 'JSON-LD ontology' },
  ];

  get form(): TechniqueFrameworkForm {
    return this.data.form;
  }

  /** Why the settings cannot be saved; empty when they can. */
  get settingsError(): string {
    try {
      const settings = JSON.parse(this.form.settingsJson || '{}');
      return settings &&
        typeof settings === 'object' &&
        !Array.isArray(settings)
        ? ''
        : 'The settings must be a JSON object.';
    } catch (e) {
      return 'The settings are not valid JSON: ' + (e as Error).message;
    }
  }

  errorFree(): boolean {
    return (
      !!this.form.name?.trim() &&
      !!this.form.domain?.trim() &&
      !this.settingsError
    );
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, definition: null });
    } else if (this.errorFree()) {
      this.editComplete.emit({
        saveChanges: true,
        definition: {
          name: this.form.name.trim(),
          description: this.form.description?.trim() || null,
          domain: this.form.domain.trim(),
          isDefensive: this.form.isDefensive,
          format: this.form.format,
          settings: JSON.parse(this.form.settingsJson || '{}'),
        },
      });
    }
  }
}
