/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/
import {
  ComnSettingsService,
  Theme
} from '@cmusei/crucible-common';
import { ActivatedRoute} from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject, Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import {
  ScenarioEventDataService,
  DataValuePlus,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import {
  DataField,
  DataFieldType,
  DataValue,
  Move,
  ScenarioEvent,
  MselItemStatus,
  Card,
  MselPage,
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
  MselCompetency,
  MselCompetencyService,
  Team,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { UntypedFormControl } from '@angular/forms';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { Sort } from '@angular/material/sort';
import { Component, OnDestroy, inject, input } from '@angular/core';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { CardQuery } from 'src/app/data/card/card.query';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { DatePipe, DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';

/** Competencies listed together in the print: a framework's, or a team's. */
export interface PlaybookCompetencyGroup {
  // the framework or team id ('' for competencies whose framework isn't known)
  key: string;
  name: string;
  competencies: Competency[];
}

// groups in heading order; a heading that two groups share gets each one's qualifier (a framework's version, a team's
// short name), so neither group is mistaken for the other
function namedGroups(
  groups: { key: string; name: string; qualifier: string; competencies: Competency[] }[],
): PlaybookCompetencyGroup[] {
  const counts = new Map<string, number>();
  groups.forEach((g) => counts.set(g.name, (counts.get(g.name) ?? 0) + 1));
  return groups
    .map((g) => ({
      key: g.key,
      name: counts.get(g.name) > 1 && g.qualifier && g.qualifier !== g.name ? `${g.name} (${g.qualifier})` : g.name,
      competencies: g.competencies.sort(byIdNumber),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * The MSEL's competencies by framework, keyed by framework id so same-named frameworks (versions of one framework)
 * stay apart. Competencies whose framework isn't in the list are listed last, together.
 */
export function frameworkCompetencyGroups(
  mselCompetencies: MselCompetency[],
  frameworks: CompetencyFramework[],
): PlaybookCompetencyGroup[] {
  const frameworksById = new Map(frameworks.map((f) => [f.id, f] as [string, CompetencyFramework]));
  const byFramework = new Map<string, Competency[]>();
  for (const competency of mselCompetencies.map((mc) => mc.competency).filter((c): c is Competency => !!c)) {
    const key = frameworksById.has(competency.competencyFrameworkId) ? competency.competencyFrameworkId : '';
    byFramework.set(key, [...(byFramework.get(key) ?? []), competency]);
  }
  const known = [...byFramework.entries()]
    .filter(([key]) => key)
    .map(([key, competencies]) => {
      const framework = frameworksById.get(key);
      return { key, name: framework.name?.trim() || 'Unnamed framework', qualifier: framework.version?.trim() ?? '', competencies };
    });
  const groups = namedGroups(known);
  const unknown = byFramework.get('');
  if (unknown) {
    groups.push({ key: '', name: groups.length ? 'Other competencies' : 'Competencies', competencies: unknown.sort(byIdNumber) });
  }
  return groups;
}

/** Each team's competencies, keyed by team id so same-named teams stay apart; teams not on the MSEL are left out. */
export function teamCompetencyGroups(teamCompetencies: TeamCompetency[], teams: Team[]): PlaybookCompetencyGroup[] {
  const teamsById = new Map(teams.map((t) => [t.id, t] as [string, Team]));
  const byTeam = new Map<string, Competency[]>();
  for (const tc of teamCompetencies.filter((tc) => tc.competency && teamsById.has(tc.teamId))) {
    byTeam.set(tc.teamId, [...(byTeam.get(tc.teamId) ?? []), tc.competency]);
  }
  return namedGroups(
    [...byTeam.entries()].map(([key, competencies]) => {
      const team = teamsById.get(key);
      return { key, name: team.name || team.shortName || '', qualifier: team.shortName ?? '', competencies };
    }),
  );
}

/** A competency as the print lists it, in full: its ID number, then its name, or its description where it has no name. */
export function competencyLabel(competency: Competency): string {
  const name = competency.shortName?.trim() || competency.description?.trim() || '';
  return [competency.idNumber?.trim(), name].filter((part) => part).join(' ');
}

// competencies in ID number order, the numbers inside them compared as numbers (T-2 before T-10)
function byIdNumber(a: Competency, b: Competency): number {
  return (a.idNumber ?? '').localeCompare(b.idNumber ?? '', undefined, { numeric: true, sensitivity: 'base' });
}

/** One move as the print-all output shows it: its title page, contents entry and events. */
export interface PlaybookPrintMove {
  // -1 for events that come before the first move, or for every event when the MSEL has no moves
  moveNumber: number;
  // "Move N", or for moveNumber -1 "Before Move N" or "Scenario Events"
  label: string;
  move?: Move;
  events: ScenarioEvent[];
}

/** Waits until the images under root have loaded, or failed, for at most timeoutMs, so a print doesn't catch a blank where one goes. */
export function imagesReady(root: ParentNode, timeoutMs = 10000): Promise<void> {
  const decoded = Array.from(root.querySelectorAll('img')).map((img) =>
    typeof img.decode === 'function' ? img.decode().catch(() => undefined) : undefined
  );
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, timeoutMs)));
  return Promise.race([Promise.all(decoded).then(() => undefined), timeout]).finally(() => clearTimeout(timer));
}

/**
 * The print footer's MSEL name, as an @page margin box for the "playbook"
 * named page. Margin box content can't read the DOM, so the name is written
 * into a CSS string.
 */
export function playbookFooterCss(mselName: string): string {
  const name = (mselName ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return `@page playbook { @bottom-left { content: "${name}"; } }`;
}

/** A duration as days, hours and minutes, e.g. "1 day 4 hours 30 minutes". */
export function formatPlaybookDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(+totalSeconds || 0));
  const parts: [number, string][] = [
    [Math.floor(seconds / 86400), 'day'],
    [Math.floor((seconds % 86400) / 3600), 'hour'],
    [Math.floor((seconds % 3600) / 60), 'minute'],
  ];
  const text = parts
    .filter(([n]) => n > 0)
    .map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`)
    .join(' ');
  return text || `${seconds} second${seconds === 1 ? '' : 's'}`;
}

@Component({
    selector: 'app-msel-playbook',
    templateUrl: './msel-playbook.component.html',
    styleUrls: ['./msel-playbook.component.scss'],
    imports: [MatPaginator, MatIconButton, MatIcon, DurationViewComponent, DatePipe, NgTemplateOutlet, TimezoneAbbrPipe]
})
export class MselPlaybookComponent implements OnDestroy {
  private settingsService = inject(ComnSettingsService);
  private moveDataService = inject(MoveDataService);
  private organizationDataService = inject(OrganizationDataService);
  private mselDataService = inject(MselDataService);
  private teamDataService = inject(TeamDataService);
  private dataFieldDataService = inject(DataFieldDataService);
  private dataValueDataService = inject(DataValueDataService);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private mselPageDataService = inject(MselPageDataService);
  private mselQuery = inject(MselQuery);
  private dataFieldQuery = inject(DataFieldQuery);
  private moveQuery = inject(MoveQuery);
  private dataValueQuery = inject(DataValueQuery);
  private scenarioEventQuery = inject(ScenarioEventQuery);
  private cardQuery = inject(CardQuery);
  private mselPageQuery = inject(MselPageQuery);
  private activatedRoute = inject(ActivatedRoute);
  private mselImageDataService = inject(MselImageDataService);
  private document = inject(DOCUMENT);
  private mselCompetencyService = inject(MselCompetencyService);
  private teamCompetencyService = inject(TeamCompetencyService);
  private competencyFrameworkService = inject(CompetencyFrameworkService);
  // the MSEL's competencies by framework, and each team's, for the print's Competencies section
  competencyGroups: PlaybookCompetencyGroup[] = [];
  teamCompetencyGroups: PlaybookCompetencyGroup[] = [];
  private competenciesMselId = '';
  // the competency lists as read, kept so the groups can be drawn again when the MSEL's teams change
  private competencyData: {
    mselCompetencies: MselCompetency[];
    teamCompetencies: TeamCompetency[];
    frameworks: CompetencyFramework[];
  } | null = null;

  readonly userTheme = input<Theme>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
  readonly loggedInUserId = input<string>(undefined);
  pageIndex = 0;
  pageSize = 1;
  defaultPageSizeOptions = [1, 5, 10, 20];
  pageSizeOptions = this.defaultPageSizeOptions;
  imageFilePath = '';
  // The cover's image. MselImageDataService owns the object URL (it is shared
  // with the MSEL cards and revoked there when the image changes).
  mselImageUrl: string | null = null;
  private mselImageKey: string | null = null;
  scenarioEventId = '';
  selectedMselId = '';
  selectedScenarioEventId = '';
  private unsubscribe$ = new Subject();
  msel = new MselPlus();
  sortedDataFields: DataField[] = [];
  cardList: Card[] = [];
  allDataFields: DataField[] = [];
  dateFormControls = new Map<string, UntypedFormControl>();
  dataValues: DataValue[] = [];
  mselScenarioEvents: ScenarioEvent[] = [];
  sortedScenarioEvents: ScenarioEvent[] = [];
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  moveList: Move[] = [];
  mselPages: MselPage[] = [];
  // the pages whose content opens with a heading of their own name, which the print does not repeat above it
  pagesTitledInContent = new Set<string>();
  // true while the playbook is drawn for print, when rows show no audio or video players
  printing = false;
  private readonly printedValues = new Map<string, string>();
  filteredScenarioEventList: ScenarioEvent[] = [];
  filterString = '';
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  sort: Sort = { active: 'deltaSeconds', direction: 'asc' };
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];
  darkThemeTint = this.settingsService.settings.DarkThemeTint
    ? this.settingsService.settings.DarkThemeTint
    : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint
    ? this.settingsService.settings.LightThemeTint
    : 0.4;

  constructor() {
    // Most data is loaded by parent component, but we need to load msel pages
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        const mselId = params.get('msel');
        const scenarioEventId = params.get('scenarioEventId');
        this.scenarioEventId = scenarioEventId;
        if (mselId && this.selectedMselId !== mselId) {
          this.selectedMselId = mselId;
          this.mselPageDataService.loadByMsel(mselId);
        }
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          // every update, not just a new MSEL, so the cover and the team competencies follow the MSEL's teams
          this.msel = this.getEditableMsel(msel) as MselPlus;
          this.loadMselImage(msel);
          this.loadCompetencies(msel);
          this.setCompetencyGroups();
        }
      });
    // subscribe to data fields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.getSortedDataFields(dataFields);
      });
    // subscribe to data values
    this.dataValueQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataValues) => {
        this.dataValues = [];
        dataValues.forEach((dv) => {
          this.dataValues.push({ ...dv });
        });
      });
    this.cardQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cards) => {
        this.cardList = cards;
      });

    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((scenarioEvents) => {
        this.mselScenarioEvents = this.getEditableScenarioEvents(
          scenarioEvents as ScenarioEvent[]
        );
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.moveAndGroupNumbers =
            this.scenarioEventDataService.getMoveAndGroupNumbers(
              this.mselScenarioEvents,
              this.moveList
            );
          this.filteredScenarioEventList = this.getFilteredScenarioEvents();
          this.sortedScenarioEvents = this.getSortedScenarioEvents(
            this.filteredScenarioEventList
          );
          this.setPageSizeOptions();
        }
      });
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1
        );
        this.moveAndGroupNumbers =
          this.scenarioEventDataService.getMoveAndGroupNumbers(
            this.mselScenarioEvents,
            this.moveList
          );
      });
    this.mselPageQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((pages) => {
        this.mselPages = pages.filter(p => p.includeInPlaybook);
        this.pagesTitledInContent = new Set(this.mselPages.filter(p => opensWithHeading(p.content, p.name)).map(p => p.id));
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  // read once per MSEL; a list that cannot be read leaves its part of the section out rather than failing the playbook
  private loadCompetencies(msel: MselPlus) {
    if (msel.id === this.competenciesMselId) {
      return;
    }
    this.competenciesMselId = msel.id;
    this.competencyData = null;
    this.setCompetencyGroups();
    forkJoin({
      msel: this.mselCompetencyService.getMselCompetencies(msel.id).pipe(catchError(() => of([]))),
      teams: this.teamCompetencyService.getMselTeamCompetencies(msel.id).pipe(catchError(() => of([]))),
      frameworks: this.competencyFrameworkService.getCompetencyFrameworks().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(({ msel: mselCompetencies, teams, frameworks }) => {
        if (msel.id !== this.competenciesMselId) {
          return;
        }
        this.competencyData = { mselCompetencies, teamCompetencies: teams, frameworks };
        this.setCompetencyGroups();
      });
  }

  // the team groups use the MSEL's current teams, so this runs again on each MSEL update
  private setCompetencyGroups() {
    const data = this.competencyData;
    this.competencyGroups = data ? frameworkCompetencyGroups(data.mselCompetencies, data.frameworks) : [];
    this.teamCompetencyGroups = data ? teamCompetencyGroups(data.teamCompetencies, this.msel.teams ?? []) : [];
  }

  competencyLabel(competency: Competency): string {
    return competencyLabel(competency);
  }

  private loadMselImage(msel: MselPlus) {
    const key = msel.id + '|' + (msel.imageDateModified ?? '');
    if (key === this.mselImageKey) {
      return;
    }
    this.mselImageKey = key;
    this.mselImageUrl = null;
    this.mselImageDataService
      .imageUrl(msel)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((url) => {
        if (key === this.mselImageKey) {
          this.mselImageUrl = url;
        }
      });
  }

  getEditableMsel(msel: MselPlus): MselPlus {
    const editableMsel = new MselPlus();
    Object.assign(editableMsel, msel);
    editableMsel.teams = (editableMsel.teams ?? [])
      .slice(0)
      .sort((a, b) =>
        (a.shortName ?? '').toLowerCase() < (b.shortName ?? '').toLowerCase() ? -1 : 1
      );
    editableMsel.units = (editableMsel.units ?? [])
      .slice(0)
      .sort((a, b) =>
        (a.shortName ?? '').toLowerCase() < (b.shortName ?? '').toLowerCase() ? -1 : 1
      );

    return editableMsel;
  }

  getSortedDataFields(dataFields: DataField[]) {
    if (dataFields) {
      this.sortedDataFields = dataFields
        .filter((df) => df.onScenarioEventList)
        .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
      this.allDataFields = dataFields.sort((a, b) =>
        +a.displayOrder > +b.displayOrder ? 1 : -1
      );
    }
    // create date form controls
    this.allDataFields.forEach((df) => {
      if (df.dataType === DataFieldType.DateTime) {
        this.dateFormControls[df.id] = new UntypedFormControl();
      }
    });
  }

  getEditableScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    const editableList: ScenarioEvent[] = [];
    scenarioEvents.forEach((scenarioEvent) => {
      const newScenarioEvent = { ...scenarioEvent };
      editableList.push(newScenarioEvent);
    });

    return editableList;
  }

  getFilteredScenarioEvents(): ScenarioEvent[] {
    const mselScenarioEvents: ScenarioEvent[] = [];
    if (this.mselScenarioEvents) {
      this.mselScenarioEvents.forEach((se) => {
        if (se.mselId === this.msel.id) {
          mselScenarioEvents.push({ ...se });
        }
      });
      if (
        mselScenarioEvents &&
        mselScenarioEvents.length > 0 &&
        this.filterString
      ) {
        const filterString = this.filterString.toLowerCase();
        const that = this;
        const filteredScenarioEvents = mselScenarioEvents.filter((a) =>
          this.sortedDataFields.some((df) =>
            that
              .getDataValue(a, df.name)
              .value?.toLowerCase()
              .includes(filterString)
          )
        );
        return filteredScenarioEvents;
      }
    }
    return mselScenarioEvents;
  }

  getDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    const dataFieldId = this.getDataFieldIdByName(scenarioEvent, dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    let dataValuePlus = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataFieldId &&
        dv.scenarioEventId === scenarioEvent.id
    ) as DataValuePlus;
    if (dataValuePlus) {
      dataValuePlus.valueArray = dataValuePlus.value
        ? dataValuePlus.value.split(', ')
        : [];
    } else {
      dataValuePlus = this.blankDataValue;
    }
    return dataValuePlus;
  }

  getDataFieldIdByName(scenarioEvent: ScenarioEvent, name: string): string {
    const dataField = this.allDataFields.find(
      (df) => df.name.toLowerCase() === name.toLowerCase()
    );
    return dataField ? dataField.id : '';
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    let sortedScenarioEvents: ScenarioEvent[];
    if (scenarioEvents) {
      if (scenarioEvents.length > 0 && this.sort && this.sort.direction) {
        sortedScenarioEvents = (scenarioEvents as ScenarioEvent[]).sort(
          (a: ScenarioEvent, b: ScenarioEvent) => this.sortScenarioEvents(a, b)
        );
      } else {
        sortedScenarioEvents = (scenarioEvents as ScenarioEvent[]).sort(
          (a, b) => (+a.deltaSeconds > +b.deltaSeconds ? 1 : -1)
        );
      }
    }
    return sortedScenarioEvents;
  }

  private sortScenarioEvents(a: ScenarioEvent, b: ScenarioEvent): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    if (!this.sort.direction || this.sort.active === 'deltaSeconds') {
      this.sort = { active: 'deltaSeconds', direction: 'asc' };
      return +a.deltaSeconds < +b.deltaSeconds ? -dir : dir;
    } else {
      const aValue = this.getDataValue(a, this.sort.active)
        .value?.toString()
        .toLowerCase();
      const bValue = this.getDataValue(b, this.sort.active)
        .value?.toString()
        .toLowerCase();
      if (aValue === bValue) {
        return +a.deltaSeconds < +b.deltaSeconds ? -dir : dir;
      } else {
        return aValue < bValue ? -dir : dir;
      }
    }
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    const dataField = this.allDataFields.find((df) => df.name === columnName);
    if (!dataField) {
      return '';
    }
    const dataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataField.id &&
        dv.scenarioEventId === scenarioEvent.id
    );

    if (dataValue) {
      if (dataField.dataType === 'Card') {
        return this.getCardNameById(dataValue.value);
      } else if (dataValue.value == null) {
        return '';
      } else {
        return this.printing ? this.printable(dataValue.value) : dataValue.value;
      }
    } else {
      return '';
    }
  }

  // a value as it prints, worked out once per value
  private printable(html: string): string {
    let printed = this.printedValues.get(html);
    if (printed === undefined) {
      printed = withoutMedia(html);
      this.printedValues.set(html, printed);
    }
    return printed;
  }

  getScenarioEventById(id: string): ScenarioEvent | undefined {
    return this.mselScenarioEvents.find((se) => se.id === id);
  }

  getScenarioEventTitle(scenarioEvent: ScenarioEvent): string {
    if (!scenarioEvent) {
      return '';
    }
    const titleField = this.allDataFields.find((df) => df.name === 'Title');
    if (!titleField) {
      return '';
    }
    const titleDataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === titleField.id &&
        dv.scenarioEventId === scenarioEvent.id
    );
    return titleDataValue ? titleDataValue.value : '';
  }

  getTitleForScenarioEvent(scenarioEventId: string): string {
    const scenarioEvent = this.getScenarioEventById(scenarioEventId);
    return scenarioEvent ? this.getScenarioEventTitle(scenarioEvent) : '';
  }

  // the rows are drawn again without their audio and video before the page is copied for print, so the browser never
  // loads a clip it cannot play on paper; the page reloads afterward, which draws them with their players again
  printpage() {
    this.print();
  }

  // every event on one page, from the first: a page index left over from paging would slice past the end
  printAllEvents() {
    this.pageIndex = 0;
    this.pageSize = this.sortedScenarioEvents.length;
    this.print();
  }

  // the copied body's images (the cover, images in pages and rows) load again from their URLs, so the print waits
  // for them rather than catching blanks
  private print() {
    this.printing = true;
    setTimeout(async () => {
      this.setPrintFooter();
      const printContents = document.getElementById('printable-area').innerHTML;
      document.body.innerHTML = printContents;
      await imagesReady(document.body);
      window.print();
      location.reload();
    }, 250);
  }

  getCardNameById(cardId: string): string {
    const card = this.cardList.find((c) => c.id === cardId);
    return card ? card.name : 'Unknown';
  }

  removeHtmlTags(content) {
    const template = document.createElement('template');
    template.innerHTML = content;
    return template.content.textContent;
  }

  changePage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getPagedScenarioEvents(): ScenarioEvent[] {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.sortedScenarioEvents.slice(startIndex, endIndex);
  }

  setPageSizeOptions() {
    const newOptions = [];
    const max = this.sortedScenarioEvents.length;
    this.defaultPageSizeOptions.forEach((m) => {
      if (m < max) {
        newOptions.push(m);
      }
    });
    newOptions.push(max);
    this.pageSizeOptions = newOptions;
  }

  getMoveNumber(scenarioEventId: string): number {
    return this.moveAndGroupNumbers[scenarioEventId]
      ? this.moveAndGroupNumbers[scenarioEventId][0]
      : -1;
  }

  getGroupNumber(scenarioEventId: string): number {
    return this.moveAndGroupNumbers[scenarioEventId]
      ? this.moveAndGroupNumbers[scenarioEventId][1]
      : 0;
  }

  isShowingAllEvents(): boolean {
    return this.pageSize >= this.sortedScenarioEvents.length;
  }

  /**
   * Every move in move number order with its events, including moves with no events, which print a page saying so.
   * Events before the first move (or in a MSEL with no moves) come first, under moveNumber -1.
   */
  getPrintMoves(): PlaybookPrintMove[] {
    const byNumber = new Map<number, PlaybookPrintMove>();
    for (const move of this.moveList) {
      const moveNumber = +move.moveNumber;
      if (!byNumber.has(moveNumber)) {
        byNumber.set(moveNumber, { moveNumber, label: `Move ${moveNumber}`, move, events: [] });
      }
    }
    for (const scenarioEvent of this.getPagedScenarioEvents()) {
      const moveNumber = this.getMoveNumber(scenarioEvent.id);
      let printMove = byNumber.get(moveNumber);
      if (!printMove) {
        printMove = { moveNumber, label: this.unmovedLabel(moveNumber), events: [] };
        byNumber.set(moveNumber, printMove);
      }
      printMove.events.push(scenarioEvent);
    }
    return [...byNumber.values()].sort((a, b) => a.moveNumber - b.moveNumber);
  }

  private unmovedLabel(moveNumber: number): string {
    if (moveNumber >= 0) {
      return `Move ${moveNumber}`;
    }
    return this.moveList.length ? `Before Move ${this.moveList[0].moveNumber}` : 'Scenario Events';
  }

  getTeamNames(): string {
    return (this.msel.teams ?? []).map((t) => t.name || t.shortName).join(', ');
  }

  formatDuration(totalSeconds: number): string {
    return formatPlaybookDuration(totalSeconds);
  }

  // Puts the MSEL name in the print footer; the page number is in the scss.
  private setPrintFooter() {
    const id = 'playbook-print-footer';
    let style = this.document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = this.document.createElement('style');
      style.id = id;
      this.document.head.appendChild(style);
    }
    style.textContent = playbookFooterCss(this.msel.name);
  }
}

// content that shows without text: when one of these comes first, the content doesn't open with a heading
const NON_TEXT_CONTENT = 'img, svg, video, audio, iframe, object, embed, canvas, hr';

// whether a page's content starts with a heading that says its name, as a drafted profiles page does; the first thing
// that shows (text or an image) must be in that heading, wrappers and empty paragraphs aside
export function opensWithHeading(content: string | null | undefined, name: string | null | undefined): boolean {
  if (!content || !name) {
    return false;
  }
  const doc = new DOMParser().parseFromString(content, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeType === Node.TEXT_NODE
        ? (node.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        : (node as Element).matches(NON_TEXT_CONTENT) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  const first = walker.nextNode();
  const firstElement = first?.nodeType === Node.TEXT_NODE ? first.parentElement : (first as Element | null);
  const heading = firstElement?.closest('h1, h2, h3, h4, h5, h6');
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  return !!heading && normalize(heading.textContent ?? '') === normalize(name);
}

/**
 * A value as the playbook prints it: each audio or video player becomes a line saying where the clip plays, since paper
 * cannot play it and loading a clip only slows the print, and each transcript is opened so it prints in full.
 */
export function withoutMedia(html: string): string {
  if (!/<(audio|video|details)\b/i.test(html)) {
    return html;
  }
  // a template's content is inert, so the clip is not loaded while it is taken out
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('audio, video').forEach((player) => {
    const note = document.createElement('p');
    note.className = 'playbook-media-note';
    const label = document.createElement('em');
    label.textContent = `${player.tagName.toLowerCase() === 'video' ? 'Video' : 'Audio'} clip: plays in Gallery.`;
    note.appendChild(label);
    player.replaceWith(note);
  });
  template.content.querySelectorAll('details').forEach((details) => details.setAttribute('open', ''));
  return template.innerHTML;
}
