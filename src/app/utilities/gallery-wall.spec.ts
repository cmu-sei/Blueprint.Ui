// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { Card, CardTeam, DataField, DataFieldType, DataValue, Move, ScenarioEvent, Team } from 'src/app/generated/blueprint.api';
import {
  articlePlaceholder,
  buildGalleryWall,
  buildGalleryWallArticles,
  getArticleValue,
  getGalleryMovesAndInjects,
  hasArticleProblems,
  parseGalleryItemStatus,
  parseGallerySourceType,
  sortArticlesNewestFirst,
} from './gallery-wall';

// A MSEL with every Gallery parameter assigned to a data field, by parameter not by name.
const FIELDS: DataField[] = [
  { id: 'df-title', name: 'Title', dataType: DataFieldType.String, galleryArticleParameter: 'Name' },
  { id: 'df-summary', name: 'Summary', dataType: DataFieldType.String, galleryArticleParameter: 'Summary' },
  { id: 'df-body', name: 'Body', dataType: DataFieldType.Html, galleryArticleParameter: 'Description' },
  { id: 'df-from', name: 'From Org', dataType: DataFieldType.Organization, galleryArticleParameter: 'FromOrg' },
  { id: 'df-to', name: 'To Org', dataType: DataFieldType.TeamsMultiple, galleryArticleParameter: 'ToOrg' },
  { id: 'df-status', name: 'Article Status', dataType: DataFieldType.String, galleryArticleParameter: 'Status' },
  { id: 'df-type', name: 'Type', dataType: DataFieldType.SourceType, galleryArticleParameter: 'SourceType' },
  { id: 'df-source', name: 'Source', dataType: DataFieldType.String, galleryArticleParameter: 'SourceName' },
  { id: 'df-url', name: 'Link', dataType: DataFieldType.Url, galleryArticleParameter: 'Url' },
  { id: 'df-date', name: 'Simulated Time', dataType: DataFieldType.DateTime, galleryArticleParameter: 'DatePosted' },
  { id: 'df-tab', name: 'New Tab', dataType: DataFieldType.Boolean, galleryArticleParameter: 'OpenInNewTab' },
  { id: 'df-card', name: 'Card', dataType: DataFieldType.Card, galleryArticleParameter: 'CardId' },
  // a Description-named field with no parameter: the push ignores it
  { id: 'df-desc', name: 'Description', dataType: DataFieldType.String },
];
const CARDS: Card[] = [
  { id: 'card-news', mselId: 'msel-1', name: 'News', description: 'Press coverage' },
  { id: 'card-intel', mselId: 'msel-1', name: 'Intel', description: 'Reports' },
];
const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const RED: Team = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'RED' };
const MOVES: Move[] = [
  { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0 },
  { id: 'move-2', mselId: 'msel-1', moveNumber: 2, deltaSeconds: 600 },
];

function event(id: string, deltaSeconds: number, integrationTarget = 'Gallery'): ScenarioEvent {
  return { id, mselId: 'msel-1', deltaSeconds, groupOrder: 0, integrationTarget };
}
function values(scenarioEventId: string, byField: Record<string, string>): DataValue[] {
  return Object.entries(byField).map(([dataFieldId, value]) => ({
    id: `${scenarioEventId}-${dataFieldId}`,
    scenarioEventId,
    dataFieldId,
    value,
  }));
}
const FULL_VALUES = {
  'df-title': 'Bank hit by ransomware',
  'df-summary': 'A consortium bank is down.',
  'df-body': '<p>Details <b>inside</b></p>',
  'df-from': 'CC News',
  'df-to': 'BLUE, RED',
  'df-status': 'Red',
  'df-type': 'News',
  'df-source': 'CC News',
  'df-url': 'https://example.test/story',
  'df-date': '2026-10-31T14:00:00Z',
  'df-tab': 'true',
  'df-card': 'card-news',
  'df-desc': 'ignored',
};

describe('parseGalleryItemStatus', () => {
  /**
   * Verifies: a color name in any case, a legacy status name, and anything else map as the push's ParseItemStatus does.
   * Interacts with: parseGalleryItemStatus.
   * Data: 'red', ' Yellow ', 'Critical', 'closed', '3', '', undefined, 'Purple'.
   */
  it.each([
    ['red', 'Red'],
    [' Yellow ', 'Yellow'],
    ['Critical', 'Orange'],
    ['closed', 'Red'],
    ['Unused', 'Gray'],
    ['3', 'Gray'],
    ['', 'Gray'],
    [undefined, 'Gray'],
    ['Purple', 'Gray'],
  ])('maps %j to %s', (value, expected) => {
    expect(parseGalleryItemStatus(value)).toBe(expected);
  });
});

describe('parseGallerySourceType', () => {
  /**
   * Verifies: a source type name in any case or its enum number is kept; anything else is News, as Enum.TryParse leaves the default.
   * Interacts with: parseGallerySourceType.
   * Data: 'email', 'Intel', '2', '99', '', 'Carrier pigeon'.
   */
  it.each([
    ['email', 'Email'],
    ['Intel', 'Intel'],
    ['2', 'Email'],
    ['99', 'News'],
    ['', 'News'],
    ['Carrier pigeon', 'News'],
  ])('maps %j to %s', (value, expected) => {
    expect(parseGallerySourceType(value)).toBe(expected);
  });
});

describe('getArticleValue', () => {
  /**
   * Verifies: a parameter is read from the field assigned to it, not from a field that happens to share its name.
   * Interacts with: getArticleValue.
   * Data: Description parameter on the Body field; a Description-named field with no parameter.
   */
  it('reads the field assigned to the parameter, not the field with that name', () => {
    const read = getArticleValue('Description', values('se-1', FULL_VALUES), FIELDS);

    expect(read.dataField?.id).toBe('df-body');
    expect(read.value).toBe('<p>Details <b>inside</b></p>');
  });

  /**
   * Verifies: with no field assigned the value is empty and no field is reported; a blank value on an assigned field reports the field.
   * Interacts with: getArticleValue.
   * Data: fields without a Summary assignment; a Summary field whose value is spaces.
   */
  it('tells an unassigned parameter from a blank value', () => {
    const noField = getArticleValue('Summary', values('se-1', FULL_VALUES), FIELDS.filter((df) => df.id !== 'df-summary'));
    const blank = getArticleValue('Summary', values('se-1', { 'df-summary': '   ' }), FIELDS);

    expect(noField).toEqual({ value: '' });
    expect(blank.dataField?.id).toBe('df-summary');
    expect(blank.value).toBe('');
  });
});

describe('getGalleryMovesAndInjects', () => {
  /**
   * Verifies: move and inject numbers follow the push's GetMovesAndInjects: injects restart per move and advance when the time changes; events before the first move are in it.
   * Interacts with: getGalleryMovesAndInjects.
   * Data: moves at 0 and 600 seconds; events at -60, 0, 0, 300, 600, 900 seconds given out of order.
   */
  it('numbers events like the push does', () => {
    const events = [event('e', 900), event('a', -60), event('d', 300), event('b', 0), event('f', 600), event('c', 0)];

    const numbers = getGalleryMovesAndInjects(events, MOVES);

    expect(numbers).toEqual({
      a: [1, 0],
      b: [1, 1],
      c: [1, 1],
      d: [1, 2],
      f: [2, 0],
      e: [2, 1],
    });
  });

  /**
   * Verifies: with no moves every event is in move 0 and injects still count up by time.
   * Interacts with: getGalleryMovesAndInjects.
   * Data: no moves; events at 0 and 60 seconds.
   */
  it('uses move 0 when the MSEL has no moves', () => {
    expect(getGalleryMovesAndInjects([event('a', 0), event('b', 60)], [])).toEqual({ a: [0, 0], b: [0, 1] });
  });
});

describe('buildGalleryWallArticles', () => {
  /**
   * Verifies: a scenario event with every parameter assigned becomes a fully filled article with no problems.
   * Interacts with: buildGalleryWallArticles, parseGalleryItemStatus, parseGallerySourceType.
   * Data: one Gallery event in move 1 with FULL_VALUES.
   */
  it('fills every article field from the assigned data fields', () => {
    const [article] = buildGalleryWallArticles([event('se-1', 0)], FIELDS, values('se-1', FULL_VALUES), CARDS, MOVES);

    expect(article).toMatchObject({
      scenarioEventId: 'se-1',
      move: 1,
      inject: 0,
      name: 'Bank hit by ransomware',
      summary: 'A consortium bank is down.',
      description: '<p>Details <b>inside</b></p>',
      fromOrg: 'CC News',
      toOrgs: ['BLUE', 'RED'],
      status: 'Red',
      sourceType: 'News',
      sourceName: 'CC News',
      url: 'https://example.test/story',
      openInNewTab: true,
      cardId: 'card-news',
      problems: {},
    });
    expect(article.card?.name).toBe('News');
    expect(article.datePosted?.toISOString()).toBe('2026-10-31T14:00:00.000Z');
  });

  /**
   * Verifies: only scenario events whose integration target includes Gallery become articles, as CreateArticlesAsync filters.
   * Interacts with: buildGalleryWallArticles.
   * Data: events targeting Gallery, Steamfitter, 'Gallery,Steamfitter' and nothing.
   */
  it('keeps only the events the push sends to Gallery', () => {
    const events = [event('g', 0), event('s', 0, 'Steamfitter'), event('gs', 0, 'Gallery,Steamfitter'), event('n', 0, null)];

    const articles = buildGalleryWallArticles(events, FIELDS, [], CARDS, MOVES);

    expect(articles.map((a) => a.scenarioEventId)).toEqual(['g', 'gs']);
  });

  /**
   * Verifies: a parameter with no assigned field, a blank value, an unknown card id and an unparsable date are each reported; blank optional fields are reported but do not make the article a problem.
   * Interacts with: buildGalleryWallArticles, hasArticleProblems.
   * Data: no Summary field; blank Name; card id with no card; 'yesterday' as the date; blank Url and New Tab.
   */
  it('reports each field the push cannot fill', () => {
    const fields = FIELDS.filter((df) => df.id !== 'df-summary');
    const dataValues = values('se-1', {
      ...FULL_VALUES,
      'df-title': '',
      'df-card': 'card-gone',
      'df-date': 'yesterday',
      'df-url': '',
      'df-tab': '',
    });

    const [article] = buildGalleryWallArticles([event('se-1', 0)], fields, dataValues, CARDS, MOVES);

    expect(article.problems).toEqual({
      Summary: 'no-field',
      Name: 'not-set',
      CardId: 'card-not-found',
      DatePosted: 'not-a-date',
      Url: 'not-set',
      OpenInNewTab: 'not-set',
    });
    expect(article.card).toBeUndefined();
    expect(article.datePosted).toBeNull();
    expect(article.status).toBe('Red');
    expect(hasArticleProblems(article)).toBe(true);
  });

  /**
   * Verifies: an article whose only gaps are the optional URL and Open In New Tab is not counted as a problem.
   * Interacts with: buildGalleryWallArticles, hasArticleProblems.
   * Data: FULL_VALUES with blank Url and New Tab.
   */
  it('does not count blank optional fields as problems', () => {
    const [article] = buildGalleryWallArticles([event('se-1', 0)], FIELDS, values('se-1', { ...FULL_VALUES, 'df-url': '', 'df-tab': '' }), CARDS, MOVES);

    expect(Object.keys(article.problems).sort()).toEqual(['OpenInNewTab', 'Url']);
    expect(hasArticleProblems(article)).toBe(false);
  });

  /**
   * Verifies: values carried on the scenario event are read when the data value store has none for it.
   * Interacts with: buildGalleryWallArticles.
   * Data: an event with its own dataValues and an empty store.
   */
  it('falls back to the values on the scenario event', () => {
    const se: ScenarioEvent = { ...event('se-1', 0), dataValues: values('se-1', { 'df-title': 'From the event' }) };

    const [article] = buildGalleryWallArticles([se], FIELDS, [], CARDS, MOVES);

    expect(article.name).toBe('From the event');
  });
});

describe('sortArticlesNewestFirst', () => {
  /**
   * Verifies: articles are ordered by move, then inject, then Date Posted, all descending, the way Gallery lists a card.
   * Interacts with: sortArticlesNewestFirst.
   * Data: four articles differing in move, inject and date.
   */
  it('orders by move, inject, then date, newest first', () => {
    const base = buildGalleryWallArticles([event('se-1', 0)], FIELDS, values('se-1', FULL_VALUES), CARDS, MOVES)[0];
    const articles = [
      { ...base, scenarioEventId: 'old', move: 1, inject: 0, datePosted: new Date('2026-01-01T00:00:00Z') },
      { ...base, scenarioEventId: 'later-date', move: 1, inject: 0, datePosted: new Date('2026-01-02T00:00:00Z') },
      { ...base, scenarioEventId: 'move-2', move: 2, inject: 0, datePosted: new Date('2025-01-01T00:00:00Z') },
      { ...base, scenarioEventId: 'inject-1', move: 1, inject: 1, datePosted: null },
    ];

    expect(sortArticlesNewestFirst(articles).map((a) => a.scenarioEventId)).toEqual(['move-2', 'inject-1', 'later-date', 'old']);
  });
});

describe('buildGalleryWall', () => {
  const cardTeams: CardTeam[] = [
    { id: 'ct-1', cardId: 'card-news', teamId: 'team-blue', isShownOnWall: true },
    { id: 'ct-2', cardId: 'card-intel', teamId: 'team-blue', isShownOnWall: true },
    { id: 'ct-3', cardId: 'card-news', teamId: 'team-red', isShownOnWall: true },
    // Red is on the Intel card but does not see it on its wall
    { id: 'ct-4', cardId: 'card-intel', teamId: 'team-red', isShownOnWall: false },
  ];
  const events = [event('all-m1', 0), event('blue-m1', 60), event('red-m2', 600), event('intel-m1', 120), event('nocard-m1', 180)];
  const dataValues = [
    ...values('all-m1', { ...FULL_VALUES, 'df-to': 'ALL', 'df-status': 'Green', 'df-date': '2026-10-01T00:00:00Z' }),
    ...values('blue-m1', { ...FULL_VALUES, 'df-to': 'BLUE', 'df-status': 'Yellow', 'df-date': '2026-10-02T00:00:00Z' }),
    ...values('red-m2', { ...FULL_VALUES, 'df-to': 'RED', 'df-status': 'Red', 'df-date': '2026-10-03T00:00:00Z' }),
    ...values('intel-m1', { ...FULL_VALUES, 'df-to': 'BLUE, RED', 'df-card': 'card-intel', 'df-status': 'Orange' }),
    ...values('nocard-m1', { ...FULL_VALUES, 'df-to': 'ALL', 'df-card': '' }),
  ];
  const articles = buildGalleryWallArticles(events, FIELDS, dataValues, CARDS, MOVES);

  /**
   * Verifies: a team's wall has one tile per card shown to it, each carrying the team's articles at the move newest first with the newest article's status and date; an article with no card is listed off the wall.
   * Interacts with: buildGalleryWall, isArticleForTeam, isArticleReleasedByMove.
   * Data: Blue at move 1 with articles to ALL, BLUE, RED and BLUE+RED on two cards, plus one without a card.
   */
  it('builds the tiles a team sees at a move', () => {
    const wall = buildGalleryWall(CARDS, cardTeams, articles, BLUE, 1);

    expect(wall.tiles.map((t) => t.card.name)).toEqual(['Intel', 'News']);
    const [intel, news] = wall.tiles;
    expect(news.articles.map((a) => a.scenarioEventId)).toEqual(['blue-m1', 'all-m1']);
    expect(news.status).toBe('Yellow');
    expect(news.datePosted?.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(intel.articles.map((a) => a.scenarioEventId)).toEqual(['intel-m1']);
    expect(intel.status).toBe('Orange');
    expect(wall.offWall).toEqual([{ article: expect.objectContaining({ scenarioEventId: 'nocard-m1' }), reason: 'no-card' }]);
    expect(wall.articleCount).toBe(4);
    expect(wall.articlesWithProblems).toBe(1);
  });

  /**
   * Verifies: the move selects what is released: at move 2 Red gets its move-2 article; at move 1 it does not; a card hidden from Red puts its article off the wall.
   * Interacts with: buildGalleryWall.
   * Data: Red at moves 1 and 2; Intel card not shown on Red's wall.
   */
  it('releases articles by move and keeps hidden cards off the wall', () => {
    const atMove1 = buildGalleryWall(CARDS, cardTeams, articles, RED, 1);
    const atMove2 = buildGalleryWall(CARDS, cardTeams, articles, RED, 2);

    expect(atMove1.tiles.map((t) => t.card.name)).toEqual(['News']);
    expect(atMove1.tiles[0].articles.map((a) => a.scenarioEventId)).toEqual(['all-m1']);
    expect(atMove1.offWall.map((o) => [o.article.scenarioEventId, o.reason])).toEqual([
      ['nocard-m1', 'no-card'],
      ['intel-m1', 'card-hidden'],
    ]);
    expect(atMove2.tiles[0].articles.map((a) => a.scenarioEventId)).toEqual(['red-m2', 'all-m1']);
    expect(atMove2.tiles[0].status).toBe('Red');
  });

  /**
   * Verifies: a card shown to the team with no articles still gets a tile, Gray with no date; with no team there is no wall.
   * Interacts with: buildGalleryWall.
   * Data: Blue at move 1 with no articles; undefined team.
   */
  it('keeps empty tiles and returns nothing without a team', () => {
    const empty = buildGalleryWall(CARDS, cardTeams, [], BLUE, 1);

    expect(empty.tiles.map((t) => [t.card.name, t.articles.length, t.status, t.datePosted])).toEqual([
      ['Intel', 0, 'Gray', null],
      ['News', 0, 'Gray', null],
    ]);
    expect(buildGalleryWall(CARDS, cardTeams, articles, undefined, 1)).toEqual({ tiles: [], offWall: [], articlesWithProblems: 0, articleCount: 0 });
  });
});

describe('articlePlaceholder', () => {
  /**
   * Verifies: each problem kind has its own muted wording, using the parameter's wall label.
   * Interacts with: articlePlaceholder.
   * Data: Summary/no-field, Name/not-set, CardId/card-not-found, DatePosted/not-a-date, SourceType/no-field.
   */
  it.each([
    ['Summary', 'no-field', '— no Summary field —'],
    ['Name', 'not-set', '— Name not set —'],
    ['CardId', 'card-not-found', '— Card not found —'],
    ['CardId', 'not-set', '— Card not set —'],
    ['DatePosted', 'not-a-date', '— Date Posted is not a date —'],
    ['SourceType', 'no-field', '— no Source Type field —'],
  ] as const)('words %s/%s as %s', (parameter, problem, expected) => {
    expect(articlePlaceholder(parameter, problem)).toBe(expected);
  });
});
