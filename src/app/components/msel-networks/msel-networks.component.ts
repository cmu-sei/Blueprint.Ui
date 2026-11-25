// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
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
import { Observable, Subject, Subscription, forkJoin, takeUntil } from 'rxjs';
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
  animations: [
    trigger('detailExpand', [
      state(
        'collapsed',
        style({ height: '0px', minHeight: '0', visibility: 'hidden' }),
      ),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
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
  private readonly allTeams = signal<Team[]>([]);
  private readonly allOrganizations = signal<Organization[]>([]);
  // the MSEL's own, by name, so they follow the active MSEL whichever of the two changes first
  readonly teams = computed(() =>
    this.allTeams()
      .filter((t) => t.mselId === this.mselId())
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );
  readonly organizations = computed(() =>
    this.allOrganizations()
      .filter((o) => o.mselId === this.mselId())
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );
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
    const term = this.networkFilter().trim().toLowerCase();
    const sort = this.networkSort();
    const dir = sort.direction === 'desc' ? -1 : 1;
    const rows = this.networks()
      .filter(
        (n) =>
          !term ||
          Object.values(this.networkValues(n)).some((v) =>
            String(v).toLowerCase().includes(term),
          ),
      )
      .sort((a, b) => {
        const x = this.networkValues(a)[sort.active] ?? '';
        const y = this.networkValues(b)[sort.active] ?? '';
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), undefined, {
                sensitivity: 'base',
              });

        return order * dir;
      });
    // the hosts on no network are listed last, and only when the search finds one of them or there is none
    const unattached = this.hostsOnNoNetwork().filter(
      (h) =>
        !term ||
        [h.name, h.role, h.operatingSystem].some((v) =>
          (v ?? '').toLowerCase().includes(term),
        ),
    );

    return unattached.length ? [...rows, NO_NETWORK] : rows;
  });
  private loadSubscription: Subscription | undefined;
  // a save that was sent finishes when the tab is left, but its failure does not reopen a dialog on a tab that is gone
  private destroyed = false;
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
          // nothing of the previous MSEL stays on screen while the new one loads
          this.networks.set([]);
          this.hosts.set([]);
          this.expanded.set(new Set());
          this.mselId.set(msel.id);
          this.load();
        }
      });
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => this.allTeams.set(teams));
    this.organizationQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((organizations) => this.allOrganizations.set(organizations));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.loadSubscription?.unsubscribe();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  load(): void {
    // a delete or save answered after the tab was left starts nothing
    if (this.destroyed) {
      return;
    }
    const mselId = this.mselId();
    this.loading.set(true);
    // an answer for a MSEL or a load that has been replaced is dropped, and the networks and hosts arrive together
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
      networks: this.networkService.getNetworksByMsel(mselId),
      hosts: this.hostService.getHostsByMsel(mselId),
    }).subscribe({
      next: ({ networks, hosts }) => {
        this.networks.set(networks);
        this.hosts.set(hosts);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorService.handleError(err);
      },
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

  /** Expands or collapses the row from the keyboard; a key pressed on a button in the row is that button's */
  toggleFromKey(event: Event, network: Network): void {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      this.toggle(network);
    }
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

  private networkValues(n: Network): Record<string, string | number> {
    return {
      name: n.name ?? '',
      range: n.range ?? '',
      purpose: n.purpose ?? '',
      hostCount: this.hostCount(n),
      teams: this.teamNames(n.teamIds) || 'Shared',
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
    this.openNetworkDialog(
      network ?? {
        mselId: this.mselId(),
        name: '',
        teamIds: [],
        organizationIds: [],
      },
    );
  }

  /** Opens the dialog on the network; when the save fails the dialog opens again with what was entered */
  private openNetworkDialog(network: Network): void {
    const mselId = this.mselId();
    const data: NetworkEditDialogData = {
      network,
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
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((result: Network | undefined) => {
        if (!result) {
          return;
        }
        const save = result.id
          ? this.networkService.updateNetwork(result.id, result)
          : this.networkService.createNetwork(result);
        save.subscribe({
          next: () => this.load(),
          error: (err) => {
            this.errorService.handleError(err);
            // the dialog opens again only while the tab still shows the MSEL it was for
            if (!this.destroyed && mselId === this.mselId()) {
              this.openNetworkDialog(result);
            }
          },
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
            ? ` The ${hosts === 1 ? 'host on it keeps its' : hosts + ' hosts on it keep their'} other interfaces.`
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
    this.openHostDialog(
      host ?? {
        mselId: this.mselId(),
        name: '',
        interfaces: network ? [{ networkId: network.id, address: null }] : [],
        teamIds: [],
        organizationIds: [],
      },
    );
  }

  /** Opens the dialog on the host; when the save fails the dialog opens again with what was entered */
  private openHostDialog(host: Host): void {
    const mselId = this.mselId();
    const data: HostEditDialogData = {
      host,
      hosts: this.hosts(),
      networks: this.networks(),
      teams: this.teams(),
      organizations: this.organizations(),
    };
    this.dialog
      .open(HostEditDialogComponent, { data, width: '720px', maxWidth: '90vw' })
      .afterClosed()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((result: Host | undefined) => {
        if (!result) {
          return;
        }
        const save = result.id
          ? this.hostService.updateHost(result.id, result)
          : this.hostService.createHost(result);
        save.subscribe({
          next: () => this.load(),
          error: (err) => {
            this.errorService.handleError(err);
            if (!this.destroyed && mselId === this.mselId()) {
              this.openHostDialog(result);
            }
          },
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
