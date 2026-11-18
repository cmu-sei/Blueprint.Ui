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
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ComnSettingsService, CrucibleDialogService } from '@cmusei/crucible-common';
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
import { canEditCasterCopy, canUpdateMsel, integrationsLocked } from 'src/app/utilities/msel-permissions';

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
  private directoriesRequested = false;
  copy: MselCasterExport | null = null;
  copyLoaded = false;
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
        const directoryChanged = this.msel.casterDirectoryId !== msel.casterDirectoryId;
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
    this.permissionDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
    this.loadDirectories();
  }

  // the directories this user can view in Caster, which Caster answers with the user's own permissions
  private loadDirectories() {
    if (this.directoriesRequested) {
      return;
    }
    this.directoriesRequested = true;
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
          this.directoryError = 'Caster directories could not be loaded. You need access to Caster to choose one.';
          this.directoriesRequested = false;
        },
      });
  }

  private loadCopy(mselId: string) {
    this.copy = null;
    this.copyLoaded = false;
    this.mselCasterExportService
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
          console.error('Failed to load the MSEL copy of its Caster directory:', error);
          this.copyLoaded = true;
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
    return !this.integrationsLocked() && canUpdateMsel(this.msel, this.loggedInUserId(), this.hasEditMsels());
  }

  canEditCopy(): boolean {
    return !this.integrationsLocked() && canEditCasterCopy(this.msel, this.loggedInUserId(), this.hasEditMsels());
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
    const casterUrl = (this.settingsService.settings as { CasterUrl?: string }).CasterUrl || '';
    const baseUrl = casterUrl && !casterUrl.endsWith('/') ? `${casterUrl}/` : casterUrl;
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
    const directories = [...(this.copy.directories || [])].sort((a, b) => Number(a.level) - Number(b.level));
    const exported = directories[directories.length - 1];
    const above: CasterCopyFile[] = directories.slice(0, -1).flatMap((d, i) =>
      (d.files || []).map((f) => ({
        path: [...directories.slice(0, i + 1).map((x) => x.name), f.name].join('/'),
        note: 'shared from above',
        content: f.content ?? '',
      }))
    );
    const own: CasterCopyFile[] = (this.copy.entries || []).map((e) => ({
      path: `${exported?.name ?? ''}/${e.path}`,
      note: e.workspace ? `workspace ${e.workspace}` : '',
      content: e.content ?? '',
    }));
    return [...above, ...own];
  }

  // what a push does with the MSEL's Caster settings as they are now
  pushPlan(): string {
    if (this.msel.casterDirectoryId) {
      return 'The push creates a workspace in the linked directory.';
    }
    if (this.copy) {
      return 'No directory is linked, so the push imports the copy into Caster as a new project, as you, links the MSEL to it, and creates a workspace there. You need Caster\'s Create Projects permission.';
    }
    return 'Link a Caster directory, or upload a MSEL file that carries a copy of one, before pushing.';
  }

  saveChanges() {
    const update: Msel = { ...(this.mselQuery.getActive() as MselPlus), casterDirectoryId: this.casterDirectoryId || null };
    this.busy = true;
    this.mselDataService.updateMsel(update).subscribe({
      next: () => {
        this.busy = false;
        this.isChanged = false;
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
        this.copy = copy;
        if (copy.warnings?.length) {
          this.showMessage('Copy Stored With Warnings', copy.warnings.join('\n'));
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
        this.mselCasterExportService.importMselCasterExport(this.msel.id).subscribe({
          next: (result) => {
            this.busy = false;
            // the new directory is not in the list loaded before it existed
            this.directoriesRequested = false;
            this.loadDirectories();
            if (result.msel) {
              this.mselDataService.setAsDates(result.msel);
              this.mselDataService.updateStore(result.msel);
            }
            if (result.lockedFiles?.length) {
              this.showMessage('Imported Without Some Files', `Caster did not import these locked files: ${result.lockedFiles.join(', ')}`);
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
        this.busy = true;
        this.mselCasterExportService.deleteMselCasterExport(this.msel.id).subscribe({
          next: () => {
            this.busy = false;
            this.copy = null;
          },
          error: (err) => {
            this.busy = false;
            this.errorService.handleError(err);
          },
        });
      });
  }

  private copyTaken(): string {
    const date = this.copy?.dateExported ? new Date(this.copy.dateExported).toLocaleString() : '';
    return date ? `on ${date}` : 'earlier';
  }

  private showMessage(title: string, message: string) {
    this.dialogService.confirm({ title, message, confirmText: '', cancelText: 'OK' });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
