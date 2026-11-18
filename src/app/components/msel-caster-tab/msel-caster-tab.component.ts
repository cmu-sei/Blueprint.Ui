// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelContent,
  MatExpansionPanelDescription,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import {
  CasterDirectory,
  CasterService,
  Msel,
  MselCasterExport,
  MselCasterExportService,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ErrorService } from 'src/app/services/error/error.service';
import {
  canEditCasterCopy,
  canUpdateMsel,
  integrationsLocked,
} from 'src/app/utilities/msel-permissions';

/** A file of the stored copy, by where it sits in the directory chain. */
export interface CasterCopyFile {
  path: string;
  // the directory above the exported one it is shared from, or the workspace of the exported directory it belongs to
  note: string;
  content: string;
}

/**
 * The Caster tab of a MSEL that uses Caster: the Caster directory the push deploys, and the copy of it the MSEL
 * carries to another Caster. Downloading the MSEL's JSON file refreshes the copy from the linked directory; a push
 * with no directory imports the copy as a new Caster project. Both are locked while the integrations are deployed.
 */
@Component({
  selector: 'app-msel-caster-tab',
  templateUrl: './msel-caster-tab.component.html',
  styleUrls: ['./msel-caster-tab.component.scss'],
  imports: [
    DatePipe,
    FormsModule,
    MatAccordion,
    MatButton,
    MatExpansionPanel,
    MatExpansionPanelContent,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatLabel,
    MatOption,
    MatSelect,
    MatTooltip,
  ],
})
export class MselCasterTabComponent implements OnInit, OnDestroy {
  private mselQuery = inject(MselQuery);
  private mselDataService = inject(MselDataService);
  private mselCasterExportService = inject(MselCasterExportService);
  private casterService = inject(CasterService);
  private permissionDataService = inject(PermissionDataService);
  private settingsService = inject(ComnSettingsService);
  private dialogService = inject(CrucibleDialogService);
  private errorService = inject(ErrorService);

  readonly loggedInUserId = input<string>(undefined);

  msel = new MselPlus();
  // the directory chosen and not yet saved
  casterDirectoryId: string | null = null;
  isChanged = false;
  directoryList: CasterDirectory[] = [];
  directoryError = '';
  copy: MselCasterExport | null = null;
  copyLoaded = false;
  // a copy that could not be read is unknown, not absent: saving another directory may delete it
  copyError = false;
  // the first read of the copy, cancelled once a store, delete or relink has settled it, so a late answer
  // cannot put back what was there before
  private copyRead?: Subscription;
  busy = false;
  private unsubscribe$ = new Subject();

  constructor() {
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (!msel) {
          return;
        }
        const isNewMsel = this.msel.id !== msel.id;
        // a save, or an import, can change the directory, and a pending choice is kept only on the same MSEL
        const directoryChanged =
          this.msel.casterDirectoryId !== msel.casterDirectoryId;
        Object.assign(this.msel, msel);
        if (isNewMsel || !this.isChanged || directoryChanged) {
          this.casterDirectoryId = msel.casterDirectoryId ?? null;
          this.isChanged = false;
        }
        if (isNewMsel) {
          this.loadCopy(msel.id);
        }
      });
  }

  ngOnInit() {
    this.permissionDataService
      .load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();
    this.loadDirectories();
  }

  // the directories this user can view in Caster, which Caster answers with the user's own permissions
  private loadDirectories() {
    this.casterService
      .getCasterDirectories()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (directories) => {
          this.directoryList = directories || [];
          this.directoryError = '';
        },
        error: (error) => {
          console.error('Failed to load Caster directories:', error);
          this.directoryList = [];
          this.directoryError =
            'Caster directories could not be loaded. You need access to Caster to choose one.';
        },
      });
  }

  private loadCopy(mselId: string) {
    this.copy = null;
    this.copyLoaded = false;
    this.copyError = false;
    this.copyRead?.unsubscribe();
    this.copyRead = this.mselCasterExportService
      .getMselCasterExport(mselId)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (copy) => {
          // the answer for a MSEL the user has since left is not this one's
          if (this.msel.id !== mselId) {
            return;
          }
          this.copy = copy || null;
          this.copyLoaded = true;
        },
        error: (error) => {
          console.error(
            'Failed to load the MSEL copy of its Caster directory:',
            error,
          );
          if (this.msel.id === mselId) {
            this.copyError = true;
          }
        },
      });
  }

  integrationsLocked(): boolean {
    return integrationsLocked(this.msel);
  }

  private hasEditMsels(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels);
  }

  // the directory is one of the MSEL's settings, saved as they are
  canEditDirectory(): boolean {
    return (
      !this.integrationsLocked() &&
      canUpdateMsel(this.msel, this.loggedInUserId(), this.hasEditMsels())
    );
  }

  canEditCopy(): boolean {
    return (
      !this.integrationsLocked() &&
      canEditCasterCopy(this.msel, this.loggedInUserId(), this.hasEditMsels())
    );
  }

  directoryLabel(directory: CasterDirectory): string {
    return `${directory.projectName} / ${directory.name}`;
  }

  linkedDirectory(): CasterDirectory | undefined {
    return this.directoryList.find((d) => d.id === this.msel.casterDirectoryId);
  }

  // On its project page, Caster expands a directory from ?directory=; a Caster without it opens the project
  linkedDirectoryUrl(): string {
    const directory = this.linkedDirectory();
    if (!directory) {
      return '';
    }
    const casterUrl =
      (this.settingsService.settings as { CasterUrl?: string }).CasterUrl || '';
    const baseUrl =
      casterUrl && !casterUrl.endsWith('/') ? `${casterUrl}/` : casterUrl;
    return `${baseUrl}projects/${directory.projectId}?directory=${directory.id}`;
  }

  copyPath(): string {
    return (this.copy?.directories || []).map((d) => d.name).join(' / ');
  }

  // the API leaves out file contents for contributors who may not change the copy
  contentsIncluded(): boolean {
    return !!this.copy?.contentsIncluded;
  }

  // the copy's files, from the project's root down: those shared from above, then the exported directory's own
  copyFiles(): CasterCopyFile[] {
    if (!this.copy) {
      return [];
    }
    const directories = [...(this.copy.directories || [])].sort(
      (a, b) => Number(a.level) - Number(b.level),
    );
    const exported = directories[directories.length - 1];
    const above: CasterCopyFile[] = directories.slice(0, -1).flatMap((d, i) =>
      (d.files || []).map((f) => ({
        path: [...directories.slice(0, i + 1).map((x) => x.name), f.name].join(
          '/',
        ),
        note: 'shared from above',
        content: f.content ?? '',
      })),
    );
    const own: CasterCopyFile[] = (this.copy.entries || []).map((e) => ({
      path: `${exported?.name ?? ''}/${e.path}`,
      note: e.workspace ? `workspace ${e.workspace}` : '',
      content: e.content ?? '',
    }));
    return [...above, ...own];
  }

  // the linked directory when Caster does not list it (deleted, or not visible to this user), so it can be cleared
  unlistedDirectoryId(): string | null {
    const id = this.msel.casterDirectoryId;
    return id && !this.directoryList.some((d) => d.id === id) ? id : null;
  }

  // what a push does with the MSEL's Caster settings as they are now
  pushPlan(): string {
    if (this.msel.casterDirectoryId) {
      return 'The push creates a workspace in the linked directory.';
    }
    if (this.copy && this.msel.isTemplate) {
      return 'No directory is linked. Import the copy into Caster before this template can be launched: a launch deploys the linked directory and never imports a copy.';
    }
    if (this.copy) {
      return "No directory is linked, so the push imports the copy into Caster as a new project, as you, links the MSEL to it, and creates a workspace there. You need Caster's Create Projects permission.";
    }
    return 'Link a Caster directory, or upload a MSEL file that carries a copy of one, before pushing.';
  }

  saveChanges() {
    // The API deletes the copy of a directory when the MSEL links another one. A copy that could not be read may
    // exist, so it is asked about too.
    const linksAnother =
      !!this.casterDirectoryId &&
      this.casterDirectoryId !== this.msel.casterDirectoryId;
    const replacesCopy = linksAnother && (!!this.copy || this.copyError);
    if (!replacesCopy) {
      this.doSave(false);
      return;
    }
    this.dialogService
      .confirm({
        title: 'Link Another Directory',
        message: this.copy
          ? `Linking another directory deletes the stored copy of "${this.copyPath()}" from ${this.copy.projectName}. Link it?`
          : 'The stored copy of a Caster directory could not be read. Linking another directory deletes any stored copy. Link it?',
        confirmText: 'Link',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => confirmed && this.doSave(true));
  }

  private doSave(replacesCopy: boolean) {
    const update: Msel = {
      ...(this.mselQuery.getActive() as MselPlus),
      casterDirectoryId: this.casterDirectoryId || null,
    };
    const mselId = this.msel.id;
    this.busy = true;
    this.mselDataService.updateMsel(update).subscribe({
      next: () => {
        this.busy = false;
        // the answer for a MSEL the user has since left is not this one's
        if (this.msel.id !== mselId) {
          return;
        }
        this.isChanged = false;
        // the API deleted the copy of the old directory
        if (replacesCopy) {
          this.copyKnown(null);
        }
      },
      // the choice stays up to be retried
      error: (err) => {
        this.busy = false;
        this.errorService.handleError(err);
      },
    });
  }

  cancelChanges() {
    this.isChanged = false;
    this.casterDirectoryId = this.msel.casterDirectoryId ?? null;
  }

  hasPendingChanges(): boolean {
    return this.isChanged;
  }

  captureCopy() {
    const replace = !!this.copy;
    if (!replace) {
      this.doCapture();
      return;
    }
    this.dialogService
      .confirm({
        title: 'Store a New Copy',
        message: `Copy the linked Caster directory now, replacing the copy taken ${this.copyTaken()}?`,
        confirmText: 'Replace',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => confirmed && this.doCapture());
  }

  private doCapture() {
    const mselId = this.msel.id;
    this.busy = true;
    this.mselCasterExportService.captureMselCasterExport(mselId).subscribe({
      next: (copy) => {
        this.busy = false;
        if (this.msel.id !== mselId) {
          return;
        }
        this.copyKnown(copy);
        if (copy.warnings?.length) {
          this.showMessage(
            'Copy Stored With Warnings',
            copy.warnings.join('\n'),
          );
        }
      },
      error: (err) => {
        this.busy = false;
        this.errorService.handleError(err);
      },
    });
  }

  importCopy() {
    this.dialogService
      .confirm({
        title: 'Import into Caster',
        message: `Create a new Caster project named "${this.copy?.projectName}" from the copy, and link the MSEL to its directory "${this.copyPath()}"? You need Caster's Create Projects permission.`,
        confirmText: 'Import',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy = true;
        this.mselCasterExportService
          .importMselCasterExport(this.msel.id)
          .subscribe({
            next: (result) => {
              this.busy = false;
              // the new directory is not in the list loaded before it existed
              this.loadDirectories();
              if (result.msel) {
                this.mselDataService.setAsDates(result.msel);
                this.mselDataService.updateStore(result.msel);
              }
              // what the import changed to fit Caster, and any file Caster held back
              const notes = [...(result.warnings ?? [])];
              if (result.lockedFiles?.length) {
                notes.push(
                  `Caster did not import these locked files: ${result.lockedFiles.join(', ')}`,
                );
              }
              if (notes.length) {
                this.showMessage('Imported With Changes', notes.join('\n'));
              }
            },
            error: (err) => {
              this.busy = false;
              this.errorService.handleError(err);
            },
          });
      });
  }

  deleteCopy() {
    const linked = !!this.msel.casterDirectoryId;
    this.dialogService
      .confirm({
        title: 'Delete the Copy',
        message: linked
          ? 'Delete the stored copy of the Caster directory? Downloading the MSEL file takes a new one from the linked directory.'
          : 'Delete the stored copy of the Caster directory? No directory is linked, so the MSEL has no topology to push until one is.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        const mselId = this.msel.id;
        this.busy = true;
        this.mselCasterExportService.deleteMselCasterExport(mselId).subscribe({
          next: () => {
            this.busy = false;
            if (this.msel.id === mselId) {
              this.copyKnown(null);
            }
          },
          error: (err) => {
            this.busy = false;
            this.errorService.handleError(err);
          },
        });
      });
  }

  // a store, delete, import or relink that succeeded says whether there is a copy, whatever the first read did
  private copyKnown(copy: MselCasterExport | null) {
    this.copyRead?.unsubscribe();
    this.copy = copy;
    this.copyLoaded = true;
    this.copyError = false;
  }

  private copyTaken(): string {
    const date = this.copy?.dateExported
      ? new Date(this.copy.dateExported).toLocaleString()
      : '';
    return date ? `on ${date}` : 'earlier';
  }

  private showMessage(title: string, message: string) {
    this.dialogService.confirm({
      title,
      message,
      confirmText: '',
      cancelText: 'OK',
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
