// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  Component,
  AfterViewInit,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatSort, MatSortHeader } from '@angular/material/sort';
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
import { Observable, Subject, from, of } from 'rxjs';
import { catchError, concatMap, map, takeUntil, toArray } from 'rxjs/operators';
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
  const parsed: unknown = JSON.parse(json);
  const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  if (
    list.length === 0 ||
    list.some((d) => !d || typeof d !== 'object' || Array.isArray(d))
  ) {
    throw new Error('The file holds no technique framework definitions.');
  }
  return list.map((d) => toDefinition(d as TechniqueFramework));
}

/** Why the API refused a request, as its problem details put it. */
function refusal(error: unknown): string {
  const e = error as {
    error?: { title?: string; detail?: string } | string;
    message?: string;
  };
  if (typeof e?.error === 'string' && e.error) return e.error;
  const problem = typeof e?.error === 'object' ? e.error : undefined;
  return (
    [problem?.title, problem?.detail].filter((v) => v).join(' ') ||
    e?.message ||
    'Unknown error'
  );
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
    MatSort,
    MatSortHeader,
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
export class AdminTechniqueFrameworksComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private techniqueFrameworkDataService = inject(TechniqueFrameworkDataService);
  private techniqueFrameworkQuery = inject(TechniqueFrameworkQuery);
  private messageService = inject(SystemMessageService);
  private dialog = inject(MatDialog);
  dialogService = inject(CrucibleDialogService);

  readonly canEdit = input<boolean>(false);
  readonly definitionInput =
    viewChild<ElementRef<HTMLInputElement>>('definitionInput');
  readonly sort = viewChild(MatSort);
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

  constructor() {
    // sort text the way the list is ordered, without regard to case
    this.dataSource.sortingDataAccessor = (framework, column) => {
      const value = (framework as unknown as Record<string, unknown>)[column];
      return typeof value === 'string'
        ? value.toLowerCase()
        : (value as number);
    };
  }

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
      this.techniqueFrameworkDataService.create(definition),
    );
  }

  edit(framework: TechniqueFramework) {
    this.openDialog(
      'Edit Technique Framework: ' + framework.name,
      toDefinition(framework),
      (definition) =>
        this.techniqueFrameworkDataService.update(framework.id, definition),
    );
  }

  private openDialog(
    title: string,
    definition: TechniqueFrameworkDefinition | null,
    save: (d: TechniqueFrameworkDefinition) => Observable<unknown>,
  ) {
    const dialogRef = this.dialog.open(AdminTechniqueFrameworkDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '800px',
      data: { title, form: toForm(definition) },
    });
    // the dialog stays open until the save succeeds, so a definition the API refuses is not lost; one save at a time
    const dialog = dialogRef.componentInstance;
    dialog.editComplete.subscribe((result) => {
      if (!result.saveChanges || !result.definition) {
        dialogRef.close();
      } else if (!dialog.saving()) {
        dialog.saving.set(true);
        save(result.definition).subscribe({
          next: () => dialogRef.close(),
          error: (error: unknown) => {
            // the refusal may be about the settings, so they are shown
            dialog.advancedOpen = true;
            dialog.saving.set(false);
            throw error;
          },
        });
      }
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
    const file = input.files?.[0];
    input.value = null;
    if (!file) {
      return;
    }
    void file.text().then((text) => {
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
      // a definition the API refuses does not stop the rest; the administrator is told which were not created
      from(definitions)
        .pipe(
          concatMap((d) =>
            this.techniqueFrameworkDataService.create(d).pipe(
              // empty for a definition created, else what was refused and why
              map(() => ''),
              catchError((error: unknown) =>
                of(
                  `${d.name || d.domain || 'A definition'}: ${refusal(error)}`,
                ),
              ),
            ),
          ),
          toArray(),
        )
        .subscribe((results) => {
          const failures = results.filter((r) => r);
          if (failures.length > 0) {
            const created = results.length - failures.length;
            this.messageService.displayMessage(
              created > 0 ? 'Import Incomplete' : 'Import Failed',
              `${created} of ${results.length} definitions were created. These were not:\n\n` +
                failures.join('\n'),
            );
          }
        });
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
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.techniqueFrameworkDataService.delete(framework.id);
        }
      });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
