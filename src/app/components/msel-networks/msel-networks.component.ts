// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource,
} from '@angular/material/table';
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

/** The id of the row that lists the hosts on no network, which is not a network */
export const NO_NETWORK_ID = 'hosts-on-no-network';
const NO_NETWORK = {
  id: NO_NETWORK_ID,
  name: 'Hosts on no network',
  teamIds: [],
  organizationIds: [],
};

/**
 * The MSEL's range: its networks and the hosts on them, and the teams and
 * organizations with access to them. A tabletop describes its network layout here; with Caster, the names
 * match the networks and machines in the template.
 */
@Component({
  selector: 'app-msel-networks',
  templateUrl: './msel-networks.component.html',
  styleUrls: ['./msel-networks.component.scss'],
  imports: [
    FormsModule,
    MatIcon,
    MatIconButton,
    MatFormField,
    MatInput,
    MatSuffix,
    MatPaginator,
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
export class MselNetworksComponent implements OnInit, AfterViewInit, OnDestroy {
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
  /** The networks whose hosts are listed under them */
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly networkFilter = signal('');
  readonly networkSort = signal<Sort>({ active: 'name', direction: 'asc' });

  readonly networkColumns = [
    'action',
    'name',
    'range',
    'purpose',
    'hostCount',
    'teams',
    'organizations',
    'domains',
  ];
  readonly networkDetailColumns = ['expandedDetail'];
  readonly networkHostColumns = [
    'action',
    'name',
    'role',
    'operatingSystem',
    'address',
  ];
  readonly networkDataSource = new MatTableDataSource<Network>([]);
  readonly networkPaginator = viewChild<MatPaginator>('networkPaginator');

  /** The sort of the hosts under each network that has been sorted, by the network's id */
  readonly hostSorts = signal<Record<string, Sort>>({});

  /** The hosts on each network by the network's id, a host on several networks under each */
  readonly hostsByNetwork = computed(() => {
    const byNetwork = new Map<string, Host[]>();
    for (const host of [...this.hosts()].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? ''),
    )) {
      for (const i of host.interfaces ?? []) {
        byNetwork.set(i.networkId, [
          ...(byNetwork.get(i.networkId) ?? []),
          host,
        ]);
      }
    }

    return byNetwork;
  });

  /** Hosts with no interface, which no network lists */
  readonly hostsOnNoNetwork = computed(() =>
    this.hosts()
      .filter((h) => !h.interfaces?.length)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );

  // the networks that match the search in the sort's order, then the group of hosts on no network when there are some
  /** The hosts under each network in its sort's order, by the network's id; by name until a column is sorted */
  readonly sortedHostsByNetwork = computed(() => {
    const sorts = this.hostSorts();
    const sorted = new Map<string, Host[]>();
    for (const [id, hosts] of [
      ...this.hostsByNetwork(),
      [NO_NETWORK_ID, this.hostsOnNoNetwork()] as [string, Host[]],
    ]) {
      sorted.set(id, this.sortHosts(id, hosts, sorts[id]));
    }

    return sorted;
  });

  private readonly networkRows = computed(() => {
    const rows = this.arrange(
      this.networks(),
      this.networkFilter(),
      this.networkSort(),
      (n) => this.networkValues(n),
    );

    return this.hostsOnNoNetwork().length ? [...rows, NO_NETWORK] : rows;
  });
  constructor() {
    effect(() => (this.networkDataSource.data = this.networkRows()));
  }

  ngAfterViewInit(): void {
    this.networkDataSource.paginator = this.networkPaginator();
  }

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

  /** The distinct domains of the teams and organizations with access to the network */
  domains(network: Network): string {
    const teams = this.teams().filter((t) => network.teamIds?.includes(t.id));
    const organizations = this.organizations().filter((o) =>
      network.organizationIds?.includes(o.id),
    );

    return [
      ...new Set(
        [...teams, ...organizations]
          .map((x) => x.domain?.trim().toLowerCase())
          .filter((d) => !!d),
      ),
    ]
      .sort()
      .join(', ');
  }

  /** How many hosts are on the network */
  hostCount(network: Network): number {
    return this.hostsOn(network).length;
  }

  isExpanded(network: Network): boolean {
    return this.expanded().has(network.id);
  }

  toggle(network: Network): void {
    this.expanded.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(network.id)) {
        next.add(network.id);
      }

      return next;
    });
  }

  /** The hosts with an interface on the network; a host on several networks is listed under each */
  hostsOn(network: Network): Host[] {
    return this.isNoNetwork(network)
      ? this.hostsOnNoNetwork()
      : (this.hostsByNetwork().get(network.id) ?? []);
  }

  /** The row for the hosts on no network, which has no network to edit or delete */
  isNoNetwork(network: Network): boolean {
    return network.id === NO_NETWORK_ID;
  }

  /** The hosts under the network, sorted by the column the planner chose */
  sortedHostsOn(network: Network): Host[] {
    return this.sortedHostsByNetwork().get(network.id) ?? [];
  }

  hostSortChanged(network: Network, sort: Sort): void {
    this.hostSorts.update((sorts) => ({ ...sorts, [network.id]: sort }));
  }

  private sortHosts(networkId: string, hosts: Host[], sort?: Sort): Host[] {
    const active = sort?.direction ? sort.active : 'name';
    const dir = sort?.direction === 'desc' ? -1 : 1;
    const value = (h: Host): string | number => {
      switch (active) {
        case 'role':
          return h.role ?? '';
        case 'operatingSystem':
          return h.operatingSystem ?? '';
        case 'address':
          return (
            h.interfaces?.find((i) => i.networkId === networkId)?.address ?? ''
          );
        default:
          return h.name ?? '';
      }
    };

    return [...hosts].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), undefined, {
              numeric: true,
              sensitivity: 'base',
            });

      return (order || (a.name ?? '').localeCompare(b.name ?? '')) * dir;
    });
  }

  networkSortChanged(sort: Sort): void {
    this.networkSort.set(
      sort.direction ? sort : { active: 'name', direction: 'asc' },
    );
  }

  /** The rows that match the search, in the sort's order */
  private arrange<T>(
    items: T[],
    search: string,
    sort: Sort,
    values: (item: T) => Record<string, string | number>,
  ): T[] {
    const term = search.trim().toLowerCase();
    const dir = sort.direction === 'desc' ? -1 : 1;

    return items
      .filter(
        (item) =>
          !term ||
          Object.values(values(item)).some((v) =>
            String(v).toLowerCase().includes(term),
          ),
      )
      .sort((a, b) => {
        const x = values(a)[sort.active] ?? '';
        const y = values(b)[sort.active] ?? '';
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), undefined, {
                sensitivity: 'base',
              });

        return order * dir;
      });
  }

  private networkValues(n: Network): Record<string, string | number> {
    return {
      name: n.name ?? '',
      range: n.range ?? '',
      purpose: n.purpose ?? '',
      hostCount: this.hostCount(n),
      teams: this.teamNames(n.teamIds),
      organizations: this.organizationNames(n.organizationIds),
      domains: this.domains(n),
    };
  }

  /** The host's address on the network, empty when it has none */
  addressOn(host: Host, network: Network): string {
    return (
      host.interfaces?.find((i) => i.networkId === network.id)?.address ?? ''
    );
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

  /** Adds a host, or edits one; a new host from a network's row starts with an interface on that network */
  editHost(host: Host | null, network: Network | null = null): void {
    const data: HostEditDialogData = {
      host: host ?? {
        mselId: this.mselId(),
        name: '',
        interfaces: network ? [{ networkId: network.id, address: null }] : [],
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
