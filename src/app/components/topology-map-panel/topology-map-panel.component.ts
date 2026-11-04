// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TopologyMapService } from 'src/app/generated/blueprint.api/api/topologyMap.service';
import { TopologyMapPreview } from 'src/app/generated/blueprint.api/model/topologyMapPreview';

/** What the panel needs of a MSEL. */
export interface TopologyMapMsel {
  id?: string;
  usePlayer?: boolean;
  useCaster?: boolean;
  playerViewId?: string | null;
  casterWorkspaceId?: string | null;
}

/**
 * The network map of a MSEL's Caster workspace: Blueprint draws it from Caster's saved layout, labelled
 * with the machines' Player names, and Update map writes it to the Player view as its VM map. The layout
 * is edited in Caster's topology view; Player's map editor changes are overwritten by the next update.
 */
@Component({
  selector: 'app-topology-map-panel',
  templateUrl: './topology-map-panel.component.html',
  styleUrls: ['./topology-map-panel.component.scss'],
  imports: [MatButton, MatIcon, MatProgressBar],
})
export class TopologyMapPanelComponent {
  private topologyMapService = inject(TopologyMapService);

  readonly msel = input<TopologyMapMsel>(undefined);
  /** The workspace in Caster, where the layout is edited. Empty when it is not known. */
  readonly casterWorkspaceUrl = input('');
  /** A MSEL owner, or a user with ManageMsels, as the push is. */
  readonly canUpdate = input(false);

  readonly preview = signal<TopologyMapPreview | null>(null);
  readonly loading = signal(false);
  readonly updating = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly workspaceId = computed(() => this.msel()?.casterWorkspaceId || '');
  readonly hasView = computed(() => !!this.msel()?.playerViewId);
  readonly hasMachines = computed(() => (this.preview()?.machineCount ?? 0) > 0);

  constructor() {
    // a new workspace, from a push, is a new drawing
    effect(() => {
      const workspaceId = this.workspaceId();
      const id = this.msel()?.id;
      const canUpdate = this.canUpdate();
      untracked(() => {
        this.preview.set(null);
        this.message.set('');
        if (id && workspaceId && canUpdate) {
          this.loadPreview();
        }
      });
    });
  }

  loadPreview() {
    const id = this.msel()?.id;
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.topologyMapService
      .previewTopologyMap(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (err) => this.error.set(this.describe(err, 'The map could not be drawn.')),
      });
  }

  updateMap() {
    const id = this.msel()?.id;
    if (!id || this.updating()) return;
    this.updating.set(true);
    this.error.set('');
    this.message.set('');
    this.topologyMapService
      .updateTopologyMap(id)
      .pipe(finalize(() => this.updating.set(false)))
      .subscribe({
        next: (result) => {
          if (result?.map) this.preview.set(result.map);
          const added = result?.applicationAdded ? ' and the Network Map application added' : '';
          this.message.set(`Map ${result?.created ? 'created' : 'updated'} in Player${added}.`);
        },
        error: (err) => this.error.set(this.describe(err, 'The map could not be updated in Player.')),
      });
  }

  private describe(err: unknown, fallback: string): string {
    const response = err as HttpErrorResponse;
    return response?.error?.title || response?.error?.detail || fallback;
  }
}
