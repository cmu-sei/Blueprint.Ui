// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { formatDate } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Card, CardTeam, DataField, DataFieldType, DataValue, Move, Msel, ScenarioEvent, Team } from 'src/app/generated/blueprint.api';
import { CardStore } from 'src/app/data/card/card.store';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { TeamStore } from 'src/app/data/team/team.store';
import { getTimezoneAbbr } from 'src/app/utilities/timezone-abbr';
import { renderComponent } from 'src/app/test-utils/render-component';
import { GalleryWallComponent } from './gallery-wall.component';

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', useGallery: true };
const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const RED: Team = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'RED' };
const MOVES: Move[] = [
  { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Opening' },
  { id: 'move-2', mselId: 'msel-1', moveNumber: 2, deltaSeconds: 600, description: 'Escalation' },
];
const CARDS: Card[] = [
  { id: 'card-news', mselId: 'msel-1', name: 'News', description: 'Press coverage' },
  { id: 'card-intel', mselId: 'msel-1', name: 'Intel', description: 'Reports' },
  // another MSEL's card, which this wall must not show
  { id: 'card-other', mselId: 'msel-2', name: 'Other MSEL', description: '' },
];
const CARD_TEAMS: CardTeam[] = [
  { id: 'ct-1', cardId: 'card-news', teamId: 'team-blue', isShownOnWall: true },
  { id: 'ct-2', cardId: 'card-intel', teamId: 'team-blue', isShownOnWall: true },
  { id: 'ct-3', cardId: 'card-news', teamId: 'team-red', isShownOnWall: true },
];
// Every Gallery parameter but Summary is assigned, by parameter, not by name: the article's
// Description comes from the Body field, and the Description-named field is ignored.
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, galleryArticleParameter: 'Name' },
  { id: 'df-body', mselId: 'msel-1', name: 'Body', dataType: DataFieldType.Html, galleryArticleParameter: 'Description' },
  { id: 'df-desc', mselId: 'msel-1', name: 'Description', dataType: DataFieldType.String },
  { id: 'df-from', mselId: 'msel-1', name: 'From Org', dataType: DataFieldType.Organization, galleryArticleParameter: 'FromOrg' },
  { id: 'df-to', mselId: 'msel-1', name: 'To Org', dataType: DataFieldType.TeamsMultiple, galleryArticleParameter: 'ToOrg' },
  { id: 'df-status', mselId: 'msel-1', name: 'Article Status', dataType: DataFieldType.String, galleryArticleParameter: 'Status' },
  { id: 'df-type', mselId: 'msel-1', name: 'Type', dataType: DataFieldType.SourceType, galleryArticleParameter: 'SourceType' },
  { id: 'df-source', mselId: 'msel-1', name: 'Source', dataType: DataFieldType.String, galleryArticleParameter: 'SourceName' },
  { id: 'df-url', mselId: 'msel-1', name: 'Link', dataType: DataFieldType.Url, galleryArticleParameter: 'Url' },
  { id: 'df-date', mselId: 'msel-1', name: 'Simulated Time', dataType: DataFieldType.DateTime, galleryArticleParameter: 'DatePosted' },
  { id: 'df-tab', mselId: 'msel-1', name: 'New Tab', dataType: DataFieldType.Boolean, galleryArticleParameter: 'OpenInNewTab' },
  { id: 'df-card', mselId: 'msel-1', name: 'Card', dataType: DataFieldType.Card, galleryArticleParameter: 'CardId' },
];

function event(id: string, deltaSeconds: number, integrationTarget = 'Gallery'): ScenarioEvent {
  return { id, mselId: 'msel-1', deltaSeconds, groupOrder: 0, integrationTarget };
}
const EVENTS: ScenarioEvent[] = [
  event('se-bank', 0),
  event('se-follow', 60),
  event('se-loose', 120),
  event('se-red', 600),
  event('se-steam', 0, 'Steamfitter'),
];
function values(scenarioEventId: string, byField: Record<string, string>): DataValue[] {
  return Object.entries(byField).map(([dataFieldId, value]) => ({ id: `${scenarioEventId}-${dataFieldId}`, scenarioEventId, dataFieldId, value }));
}
const BASE = {
  'df-from': 'CC News',
  'df-status': 'Green',
  'df-type': 'News',
  'df-source': 'CC News Desk',
  'df-url': 'https://example.test/story',
  'df-tab': 'true',
  'df-card': 'card-news',
  'df-desc': 'not the article description',
};
const BANK_POSTED = '2026-10-01T12:00:00Z';
const VALUES: DataValue[] = [
  ...values('se-bank', {
    ...BASE,
    'df-title': 'Bank hit by ransomware',
    'df-body': '<p>Details <b>inside</b></p><script>window.pwned = true</script>',
    'df-to': 'ALL',
    'df-date': BANK_POSTED,
  }),
  ...values('se-follow', { ...BASE, 'df-title': 'Follow-up for Blue', 'df-body': '<p>Blue only</p>', 'df-to': 'BLUE', 'df-status': 'Yellow', 'df-date': '2026-10-02T12:00:00Z' }),
  ...values('se-loose', { ...BASE, 'df-title': 'Loose article', 'df-body': '<p>No card</p>', 'df-to': 'ALL', 'df-card': '', 'df-date': '2026-10-02T13:00:00Z' }),
  ...values('se-red', { ...BASE, 'df-title': 'Red only in move 2', 'df-body': '<p>Red</p>', 'df-to': 'RED', 'df-status': 'Red', 'df-date': '2026-10-03T12:00:00Z' }),
  ...values('se-steam', { ...BASE, 'df-title': 'Not for Gallery', 'df-body': '<p>Steamfitter</p>', 'df-to': 'ALL' }),
];

interface Rows {
  teams?: Team[];
  moves?: Move[];
  cards?: Card[];
  cardTeams?: CardTeam[];
  dataFields?: DataField[];
  dataValues?: DataValue[];
  scenarioEvents?: ScenarioEvent[];
}

async function renderWall(rows: Rows = {}) {
  const rendered = await renderComponent(GalleryWallComponent, {
    imports: [MatFormFieldModule, MatSelectModule, MatTooltipModule],
  });
  // The stores are filled by MselComponent when the MSEL opens; seed them the same way.
  const mselStore = TestBed.inject(MselStore);
  mselStore.set([structuredClone(MSEL)]);
  mselStore.setActive('msel-1');
  TestBed.inject(TeamStore).set(structuredClone(rows.teams ?? [BLUE, RED]));
  TestBed.inject(MoveStore).set(structuredClone(rows.moves ?? MOVES));
  TestBed.inject(CardStore).set(structuredClone(rows.cards ?? CARDS));
  TestBed.inject(CardTeamDataService).cardTeams.next(structuredClone(rows.cardTeams ?? CARD_TEAMS));
  TestBed.inject(DataFieldStore).set(structuredClone(rows.dataFields ?? FIELDS));
  TestBed.inject(DataValueStore).set(structuredClone(rows.dataValues ?? VALUES));
  TestBed.inject(ScenarioEventStore).set(structuredClone(rows.scenarioEvents ?? EVENTS));
  rendered.fixture.detectChanges();
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const [teamSelect, moveSelect] = await TestbedHarnessEnvironment.loader(rendered.fixture).getAllHarnesses(MatSelectHarness);
  return { ...rendered, teamSelect, moveSelect };
}

const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^Card ${name},`) });
const tiles = () => screen.getAllByRole('button', { name: /^Card / }).map((b) => b.getAttribute('aria-label'));
const articleList = (cardName: string) => within(screen.getByRole('list', { name: `${cardName} articles` }));
const articleNames = (list: ReturnType<typeof within>) => list.getAllByRole('listitem').map((row) => within(row).getByRole('heading', { level: 4 }).textContent.trim());
const expectedDate = (iso: string) => `${formatDate(iso, 'dd MMM yyyy HH:mm', 'en-US')} ${getTimezoneAbbr(iso)}`;

describe('GalleryWallComponent', () => {
  /**
   * Verifies: the wall opens on the first team and first move, with one tile per card shown to that team (an empty one included), each counting the team's articles released by that move; only the open MSEL's cards appear.
   * Interacts with: real MselQuery, TeamQuery, MoveQuery, CardQuery, CardTeamDataService, DataFieldQuery, DataValueQuery, ScenarioEventQuery (seeded stores).
   * Data: Blue sees News (2 articles by move 1) and Intel (none); a card of another MSEL.
   */
  it('shows the first team\'s cards at the first move with their article counts', async () => {
    const { teamSelect, moveSelect } = await renderWall();

    expect(await teamSelect.getValueText()).toBe('BLUE - Blue Team');
    expect(await moveSelect.getValueText()).toBe('1 - Opening');
    expect(tiles()).toEqual(['Card Intel, 0 articles', 'Card News, 2 articles']);
    expect(within(tile('Intel')).getByText('No articles posted')).toBeInTheDocument();
    expect(screen.queryByText('Other MSEL')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a tile's status strip and date follow its newest article, and the tile expands to list the articles newest first.
   * Interacts with: GalleryWallComponent.toggleCard, buildGalleryWall ordering.
   * Data: News for Blue at move 1: Follow-up (inject 1, Yellow) over Bank (inject 0, Green).
   */
  it('expands a tile to its articles, newest first', async () => {
    await renderWall();
    const user = userEvent.setup();

    expect(document.querySelector('[data-card-id="card-news"]')?.getAttribute('data-status')).toBe('Yellow');
    await user.click(tile('News'));

    expect(tile('News')).toHaveAttribute('aria-expanded', 'true');
    expect(articleNames(articleList('News'))).toEqual(['Follow-up for Blue', 'Bank hit by ransomware']);
  });

  /**
   * Verifies: an article row shows each Gallery field as the push would send it: name from the Name field, From Org → To Org, the status chip in Gallery's colour, Source Type / Source Name, Date Posted in local time with zone, and the Description from the field assigned to it (not the field named Description) rendered as HTML with scripts stripped by Angular's sanitizer.
   * Interacts with: GalleryWallComponent article template, DatePipe, TimezoneAbbrPipe, [innerHTML] sanitization.
   * Data: the Bank article, whose Body holds a <b> and a <script>.
   */
  it('renders each article field by its Gallery parameter, with sanitized HTML', async () => {
    await renderWall();
    const user = userEvent.setup();
    await user.click(tile('News'));

    const row = articleList('News').getAllByRole('listitem')[1];
    expect(row).toHaveAttribute('data-scenario-event-id', 'se-bank');
    expect(within(row).getByRole('heading', { level: 4 })).toHaveTextContent('Bank hit by ransomware');
    expect(within(row).getByText('CC News', { selector: '.article-orgs span' })).toBeInTheDocument();
    expect(within(row).getByText('ALL')).toBeInTheDocument();
    const chip = within(row).getByTitle('Status: Green');
    expect(chip).toHaveTextContent('Green');
    expect(chip.style.backgroundColor).toBe('rgb(163, 235, 163)');
    expect(within(row).getByText('News', { selector: '.article-source span' })).toBeInTheDocument();
    expect(within(row).getByText('CC News Desk')).toBeInTheDocument();
    expect(within(row).getByText(expectedDate(BANK_POSTED))).toBeInTheDocument();
    expect(within(row).getByText('Move 1, Inject 0')).toBeInTheDocument();
    const description = row.querySelector('.article-description');
    expect(description.innerHTML).toContain('<b>inside</b>');
    expect(description.innerHTML).not.toContain('script');
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
    expect(within(row).queryByText('not the article description')).not.toBeInTheDocument();
    expect(within(row).getByText('https://example.test/story')).toBeInTheDocument();
  });

  /**
   * Verifies: a parameter with no assigned field shows a muted placeholder in every article instead of blank, and the header counts the articles affected; an article with no card is listed off the wall with "Card not set".
   * Interacts with: articlePlaceholder, GalleryWallComponent.problemNote, the off-wall section.
   * Data: no Summary field; the Loose article with a blank Card.
   */
  it('flags the fields the push cannot fill', async () => {
    await renderWall();
    const user = userEvent.setup();

    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 articles have fields the Gallery push cannot fill');
    await user.click(tile('News'));
    expect(articleList('News').getAllByText('— no Summary field —')).toHaveLength(2);

    const offWall = within(screen.getByRole('region', { name: 'Articles not on the wall' }));
    expect(offWall.getByRole('heading', { level: 3 })).toHaveTextContent("Not on BLUE's wall");
    expect(articleNames(offWall)).toEqual(['Loose article']);
    expect(offWall.getByText('— Card not set —')).toBeInTheDocument();
    expect(offWall.getByText('no card chosen, so Gallery shows it only in the archive')).toBeInTheDocument();
  });

  /**
   * Verifies: with every parameter assigned and filled there is no header note and no placeholder.
   * Interacts with: GalleryWallComponent.problemNote.
   * Data: FIELDS plus a Summary field, filled on the Bank article only; Red at move 1.
   */
  it('shows no note when every field maps', async () => {
    const summary: DataField = { id: 'df-summary', mselId: 'msel-1', name: 'Summary', dataType: DataFieldType.String, galleryArticleParameter: 'Summary' };
    const { teamSelect } = await renderWall({
      dataFields: [...FIELDS, summary],
      dataValues: [...VALUES, ...values('se-bank', { 'df-summary': 'A bank is down.' })],
      scenarioEvents: [event('se-bank', 0)],
    });
    const user = userEvent.setup();

    await teamSelect.clickOptions({ text: 'RED - Red Team' });
    await user.click(tile('News'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/^— .* —$/)).not.toBeInTheDocument();
    expect(articleList('News').getByText('A bank is down.')).toBeInTheDocument();
  });

  /**
   * Verifies: choosing a team shows that team's cards and only the articles whose To Org names it or ALL; choosing a later move releases that move's articles.
   * Interacts with: Team and Move mat-selects, buildGalleryWall.
   * Data: Red at move 1 (Bank only) then move 2 (Red only in move 2 added); Blue's Follow-up never shown to Red.
   */
  it('filters by team and move', async () => {
    const { teamSelect, moveSelect } = await renderWall();
    const user = userEvent.setup();

    await teamSelect.clickOptions({ text: 'RED - Red Team' });
    expect(tiles()).toEqual(['Card News, 1 article']);
    await user.click(tile('News'));
    expect(articleNames(articleList('News'))).toEqual(['Bank hit by ransomware']);

    await moveSelect.clickOptions({ text: '2 - Escalation' });
    expect(tiles()).toEqual(['Card News, 2 articles']);
    expect(articleNames(articleList('News'))).toEqual(['Red only in move 2', 'Bank hit by ransomware']);
    expect(document.querySelector('[data-card-id="card-news"]')?.getAttribute('data-status')).toBe('Red');
    expect(screen.queryByText('Follow-up for Blue')).not.toBeInTheDocument();
    expect(screen.queryByText('Not for Gallery')).not.toBeInTheDocument();
  });

  /**
   * Verifies: with no team the wall says so instead of rendering nothing.
   * Interacts with: GalleryWallComponent template.
   * Data: no teams.
   */
  it('explains a wall with no teams', async () => {
    await renderWall({ teams: [] });

    expect(screen.getByText('This MSEL has no teams, so Gallery has no wall to show.')).toBeInTheDocument();
  });

  /**
   * Verifies: with no card shown to the chosen team the wall points at the Gallery Cards tab.
   * Interacts with: GalleryWallComponent template, Team mat-select.
   * Data: no card teams; Red chosen.
   */
  it('explains a wall with no cards for the team', async () => {
    const { teamSelect } = await renderWall({ cardTeams: [] });

    await teamSelect.clickOptions({ text: 'RED - Red Team' });

    expect(screen.getByText("No Gallery card is shown on RED's wall. Check the card's teams on the Gallery Cards tab.")).toBeInTheDocument();
  });

  /**
   * Verifies: with no scenario event targeting Gallery the wall says the push would create no articles.
   * Interacts with: GalleryWallComponent template.
   * Data: one Steamfitter-only event.
   */
  it('explains a wall with no Gallery events', async () => {
    await renderWall({ scenarioEvents: [event('se-steam', 0, 'Steamfitter')] });

    expect(screen.getByText('No scenario event has Gallery as an integration target, so the push would create no articles.')).toBeInTheDocument();
  });
});
