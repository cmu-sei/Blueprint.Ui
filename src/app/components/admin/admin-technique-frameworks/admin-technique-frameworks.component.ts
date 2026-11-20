// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Subject, from } from 'rxjs';
import { concatMap, takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueFileFormat,
  TechniqueFramework,
} from 'src/app/generated/blueprint.api';
import {
  TechniqueFrameworkDataService,
  TechniqueFrameworkDefinition,
  toDefinition,
} from 'src/app/data/technique-framework/technique-framework-data.service';
import { TechniqueFrameworkQuery } from 'src/app/data/technique-framework/technique-framework.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import {
  AdminTechniqueFrameworkDialogComponent,
  toForm,
} from '../admin-technique-framework-dialog/admin-technique-framework-dialog.component';

/** The definitions in a file an administrator imports: one definition, or a list of them. */
export function definitionsIn(json: string): TechniqueFrameworkDefinition[] {
  const parsed = JSON.parse(json);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (
    list.length === 0 ||
    list.some((d) => !d || typeof d !== 'object' || Array.isArray(d))
  ) {
    throw new Error('The file holds no technique framework definitions.');
  }
  return list.map((d) => toDefinition(d));
}

/**
 * The technique framework definitions releases are read with. Blueprint ships none: an administrator creates
 * them, or imports the JSON an export wrote, before importing a release.
 */
@Component({
  selector: 'app-admin-technique-frameworks',
  templateUrl: './admin-technique-frameworks.component.html',
  styleUrls: ['./admin-technique-frameworks.component.scss'],
  imports: [
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
  ],
})
export class AdminTechniqueFrameworksComponent implements OnInit, OnDestroy {
  private techniqueFrameworkDataService = inject(TechniqueFrameworkDataService);
  private techniqueFrameworkQuery = inject(TechniqueFrameworkQuery);
  private messageService = inject(SystemMessageService);
  private dialog = inject(MatDialog);
  dialogService = inject(CrucibleDialogService);

  readonly canEdit = input<boolean>(false);
  readonly definitionInput =
    viewChild<ElementRef<HTMLInputElement>>('definitionInput');
  dataSource = new MatTableDataSource<TechniqueFramework>([]);
  displayedColumns: string[] = [
    'action',
    'name',
    'domain',
    'family',
    'format',
    'releaseCount',
  ];
  private unsubscribe$ = new Subject();

  ngOnInit() {
    this.techniqueFrameworkQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((frameworks) => {
        this.dataSource.data = [...frameworks].sort((a, b) =>
          (a.name || '').localeCompare(b.name || ''),
        );
      });
    this.techniqueFrameworkDataService.load();
  }

  formatName(format: TechniqueFileFormat): string {
    return format === TechniqueFileFormat.JsonLdOntology
      ? 'JSON-LD ontology'
      : 'STIX bundle';
  }

  add() {
    this.openDialog('Add Technique Framework', null, (definition) =>
      this.techniqueFrameworkDataService.create(definition).subscribe(),
    );
  }

  edit(framework: TechniqueFramework) {
    this.openDialog(
      'Edit Technique Framework: ' + framework.name,
      toDefinition(framework),
      (definition) =>
        this.techniqueFrameworkDataService
          .update(framework.id, definition)
          .subscribe(),
    );
  }

  private openDialog(
    title: string,
    definition: TechniqueFrameworkDefinition | null,
    save: (d: TechniqueFrameworkDefinition) => void,
  ) {
    const dialogRef = this.dialog.open(AdminTechniqueFrameworkDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '800px',
      data: { title, form: toForm(definition) },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.definition) {
        save(result.definition);
      }
      dialogRef.close();
    });
  }

  /** Downloads the definition as JSON another installation can import. */
  export(framework: TechniqueFramework) {
    const json = JSON.stringify(toDefinition(framework), null, 2);
    const url = window.URL.createObjectURL(
      new Blob([json], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${framework.domain || framework.name}-framework.json`.replace(
      /[^a-z0-9.-]/gi,
      '_',
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  chooseFile() {
    this.definitionInput().nativeElement.click();
  }

  /** Creates each definition the chosen file holds, one after another. */
  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = null;
    if (!file) {
      return;
    }
    file.text().then((text) => {
      let definitions: TechniqueFrameworkDefinition[];
      try {
        definitions = definitionsIn(text);
      } catch (error) {
        this.messageService.displayMessage(
          'Import Failed',
          (error as Error).message,
        );
        return;
      }
      from(definitions)
        .pipe(concatMap((d) => this.techniqueFrameworkDataService.create(d)))
        .subscribe();
    });
  }

  delete(framework: TechniqueFramework) {
    this.dialogService
      .confirm({
        title: 'Delete Technique Framework',
        message:
          'Are you sure you want to delete ' +
          framework.name +
          '? ' +
          'Its releases keep their techniques but no longer show what the framework defines, and new files are no longer recognised as its releases.',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.techniqueFrameworkDataService.delete(framework.id);
        }
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
