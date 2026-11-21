// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable, Subject, takeUntil } from 'rxjs';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import {
  Host,
  HostService,
  Network,
  NetworkService,
  Organization,
  Team,
} from 'src/app/generated/blueprint.api';
import { ErrorService } from 'src/app/services/error/error.service';
import {
  HostEditDialogComponent,
  HostEditDialogData,
} from './host-edit-dialog.component';
import {
  NetworkEditDialogComponent,
  NetworkEditDialogData,
} from './network-edit-dialog.component';

/**
 * The MSEL's range: its networks and the hosts on them, and the teams that defend them and the
 * organizations they belong to. A tabletop describes its network layout here; with Caster, the names
 * match the networks and machines in the template.
 */
@Component({
  selector: 'app-msel-networks',
  templateUrl: './msel-networks.component.html',
  styleUrls: ['./msel-networks.component.scss'],
  imports: [MatIconButton, MatIcon],
})
export class MselNetworksComponent implements OnInit, OnDestroy {
  readonly canEdit = input(false);

  private mselQuery = inject(MselQuery);
  private teamQuery = inject(TeamQuery);
  private organizationQuery = inject(OrganizationQuery);
  private networkService = inject(NetworkService);
  private hostService = inject(HostService);
  private dialog = inject(MatDialog);
  private dialogService = inject(CrucibleDialogService);
  private errorService = inject(ErrorService);
  private unsubscribe$ = new Subject<void>();

  readonly mselId = signal('');
  readonly networks = signal<Network[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel?.id && msel.id !== this.mselId()) {
          this.mselId.set(msel.id);
          this.load();
        }
      });
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) =>
        this.teams.set(
          teams
            .filter((t) => t.mselId === this.mselId())
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        ),
      );
    this.organizationQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((organizations) =>
        this.organizations.set(
          organizations
            .filter((o) => o.mselId === this.mselId())
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        ),
      );
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  load(): void {
    const mselId = this.mselId();
    this.loading.set(true);
    this.networkService.getNetworksByMsel(mselId).subscribe({
      next: (networks) => {
        this.networks.set(networks);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorService.handleError(err);
      },
    });
    this.hostService.getHostsByMsel(mselId).subscribe({
      next: (hosts) => this.hosts.set(hosts),
      error: (err) => this.errorService.handleError(err),
    });
  }

  teamNames(ids: string[] | null | undefined): string {
    return this.names(ids, this.teams());
  }

  organizationNames(ids: string[] | null | undefined): string {
    return this.names(ids, this.organizations());
  }

  /** How many hosts are on the network, counting each row's Count */
  hostCount(network: Network): number {
    return this.hosts()
      .filter((h) => h.interfaces?.some((i) => i.networkId === network.id))
      .reduce((sum, h) => sum + (h.count ?? 1), 0);
  }

  /** The host's interfaces as "network address" */
  interfaceText(host: Host): string {
    return (host.interfaces ?? [])
      .map((i) => {
        const network =
          this.networks().find((n) => n.id === i.networkId)?.name ?? '';

        return i.address ? `${network} ${i.address}` : network;
      })
      .sort()
      .join(', ');
  }

  editNetwork(network: Network | null): void {
    const data: NetworkEditDialogData = {
      network: network ?? {
        mselId: this.mselId(),
        name: '',
        teamIds: [],
        organizationIds: [],
      },
      networks: this.networks(),
      teams: this.teams(),
      organizations: this.organizations(),
    };
    this.dialog
      .open(NetworkEditDialogComponent, {
        data,
        width: '640px',
        maxWidth: '90vw',
      })
      .afterClosed()
      .subscribe((result: Network | undefined) => {
        if (!result) {
          return;
        }
        const save = result.id
          ? this.networkService.updateNetwork(result.id, result)
          : this.networkService.createNetwork(result);
        save.subscribe({
          next: () => this.load(),
          error: (err) => this.errorService.handleError(err),
        });
      });
  }

  deleteNetwork(network: Network): void {
    const hosts = this.hosts().filter((h) =>
      h.interfaces?.some((i) => i.networkId === network.id),
    ).length;
    this.dialogService
      .confirm({
        title: 'Delete Network',
        message:
          `Are you sure that you want to delete ${network.name}?` +
          (hosts
            ? ` The ${hosts === 1 ? 'host on it keeps' : hosts + ' hosts on it keep'} its other interfaces.`
            : ''),
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.networkService.deleteNetwork(network.id).subscribe({
            next: () => this.load(),
            error: (err) => this.errorService.handleError(err),
          });
        }
      });
  }

  editHost(host: Host | null): void {
    const data: HostEditDialogData = {
      host: host ?? {
        mselId: this.mselId(),
        name: '',
        count: 1,
        interfaces: [],
        teamIds: [],
        organizationIds: [],
      },
      hosts: this.hosts(),
      networks: this.networks(),
      teams: this.teams(),
      organizations: this.organizations(),
    };
    this.dialog
      .open(HostEditDialogComponent, { data, width: '720px', maxWidth: '90vw' })
      .afterClosed()
      .subscribe((result: Host | undefined) => {
        if (!result) {
          return;
        }
        const save = result.id
          ? this.hostService.updateHost(result.id, result)
          : this.hostService.createHost(result);
        save.subscribe({
          next: () => this.load(),
          error: (err) => this.errorService.handleError(err),
        });
      });
  }

  deleteHost(host: Host): void {
    this.dialogService
      .confirm({
        title: 'Delete Host',
        message: `Are you sure that you want to delete ${host.name}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.hostService.deleteHost(host.id).subscribe({
            next: () => this.load(),
            error: (err) => this.errorService.handleError(err),
          });
        }
      });
  }

  private names(
    ids: string[] | null | undefined,
    items: { id?: string; name?: string | null }[],
  ): string {
    return (ids ?? [])
      .map((id) => items.find((item) => item.id === id)?.name ?? '')
      .filter((name) => name)
      .sort()
      .join(', ');
  }
}
