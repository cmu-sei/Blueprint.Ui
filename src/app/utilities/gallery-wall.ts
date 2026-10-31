// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

// Builds the Gallery wall a team would see from a MSEL's scenario events,
// using the same field mapping the Gallery push uses
// (Blueprint.Api/Infrastructure/Extensions/IntegrationGalleryExtensions.cs,
// CreateArticlesAsync / GetArticleValue / ParseItemStatus, and
// ScenarioEventService.GetMovesAndInjects). Where this file and the push
// disagree, the push is right and this file has a bug.

import {
  Card,
  CardTeam,
  DataField,
  DataValue,
  Move,
  ScenarioEvent,
  Team,
} from 'src/app/generated/blueprint.api';

/** Blueprint.Api.Data.Enumerations.GalleryArticleParameter: the DataField.galleryArticleParameter values the push reads. */
export const GALLERY_ARTICLE_PARAMETERS = [
  'Name',
  'Description',
  'Status',
  'SourceType',
  'SourceName',
  'Url',
  'DatePosted',
  'OpenInNewTab',
  'CardId',
  'ToOrg',
  'FromOrg',
  'Summary',
] as const;
export type GalleryArticleParameter = (typeof GALLERY_ARTICLE_PARAMETERS)[number];

/** How the wall names each parameter in its placeholders. */
export const GALLERY_ARTICLE_PARAMETER_LABELS: Record<GalleryArticleParameter, string> = {
  Name: 'Name',
  Description: 'Description',
  Status: 'Status',
  SourceType: 'Source Type',
  SourceName: 'Source Name',
  Url: 'URL',
  DatePosted: 'Date Posted',
  OpenInNewTab: 'Open In New Tab',
  CardId: 'Card',
  ToOrg: 'To Org',
  FromOrg: 'From Org',
  Summary: 'Summary',
};

/** Gallery article statuses, named for the color the wall shows, best to worst. */
export const GALLERY_ITEM_STATUSES = ['Gray', 'Green', 'Yellow', 'Orange', 'Red'] as const;
export type GalleryItemStatus = (typeof GALLERY_ITEM_STATUSES)[number];

/** The color Gallery shows for each article status. */
export const GALLERY_ITEM_STATUS_COLORS: Record<GalleryItemStatus, string> = {
  Gray: '#b5b5b5',
  Green: 'rgb(163, 235, 163)',
  Yellow: 'rgb(250, 235, 100)',
  Orange: 'rgb(250, 163, 2)',
  Red: '#ff3333',
};

/** The names Gallery used before its statuses were named for colors; existing MSELs still hold them. */
export const LEGACY_GALLERY_ITEM_STATUSES: Record<string, GalleryItemStatus> = {
  unused: 'Gray',
  open: 'Green',
  affected: 'Yellow',
  critical: 'Orange',
  closed: 'Red',
};

/** Gallery.Api.Client.SourceType, in enum order so a numeric value maps like Enum.TryParse does. */
export const GALLERY_SOURCE_TYPES = ['News', 'Social', 'Email', 'Phone', 'Intel', 'Reporting', 'Orders'] as const;
export type GallerySourceType = (typeof GALLERY_SOURCE_TYPES)[number];

/**
 * ParseItemStatus: a color name or a legacy name, any case; anything else
 * (including a number or nothing) is Gray.
 */
export function parseGalleryItemStatus(value: string | null | undefined): GalleryItemStatus {
  const trimmed = (value ?? '').trim();
  if (!trimmed || /^-?\d+$/.test(trimmed)) {
    return 'Gray';
  }
  const lower = trimmed.toLowerCase();
  const named = GALLERY_ITEM_STATUSES.find((s) => s.toLowerCase() === lower);
  return named ?? LEGACY_GALLERY_ITEM_STATUSES[lower] ?? 'Gray';
}

/**
 * Enum.TryParse(typeof(SourceType), value, ignoreCase: true): a name in any
 * case, or the enum's number; anything else is News.
 */
export function parseGallerySourceType(value: string | null | undefined): GallerySourceType {
  const trimmed = (value ?? '').trim();
  const lower = trimmed.toLowerCase();
  const named = GALLERY_SOURCE_TYPES.find((s) => s.toLowerCase() === lower);
  if (named) {
    return named;
  }
  if (/^\d+$/.test(trimmed) && +trimmed < GALLERY_SOURCE_TYPES.length) {
    return GALLERY_SOURCE_TYPES[+trimmed];
  }
  return 'News';
}

/**
 * GetArticleValue: the value of the data field assigned to the parameter.
 * The push sends '' both when no field is assigned and when the value is
 * blank; the wall tells them apart so the planner can see which it is.
 */
export interface ArticleValue {
  /** The data field assigned to the parameter, if any. */
  dataField?: DataField;
  /** The stored value, trimmed; '' when the field is unassigned or blank. */
  value: string;
}

export function getArticleValue(
  parameter: GalleryArticleParameter,
  dataValues: DataValue[],
  dataFields: DataField[],
): ArticleValue {
  const dataField = dataFields.find((df) => df.galleryArticleParameter === parameter);
  if (!dataField) {
    return { value: '' };
  }
  const dataValue = dataValues.find((dv) => dv.dataFieldId === dataField.id);
  return { dataField, value: (dataValue?.value ?? '').trim() };
}

/**
 * GetMovesAndInjects: the move and inject number the push gives each scenario
 * event. Events are walked in deltaSeconds order; the inject number restarts
 * at 0 in each move and advances when the time changes. Events before the
 * first move count as being in it.
 */
export function getGalleryMovesAndInjects(
  scenarioEvents: ScenarioEvent[],
  moves: Move[],
): Record<string, [number, number]> {
  const result: Record<string, [number, number]> = {};
  const events = [...scenarioEvents].sort((a, b) => +a.deltaSeconds - +b.deltaSeconds);
  const sortedMoves = [...moves].sort((a, b) => +a.deltaSeconds - +b.deltaSeconds);
  let m = 0;
  let inject = 0;
  let deltaSeconds = events.length > 0 ? +events[0].deltaSeconds : 0;
  for (const event of events) {
    if (sortedMoves.length === 0 || m === sortedMoves.length - 1 || +event.deltaSeconds < +sortedMoves[m + 1].deltaSeconds) {
      if (+event.deltaSeconds !== deltaSeconds) {
        inject++;
      }
    } else {
      while (m < sortedMoves.length - 1 && +event.deltaSeconds >= +sortedMoves[m + 1].deltaSeconds) {
        m++;
      }
      inject = 0;
    }
    deltaSeconds = +event.deltaSeconds;
    // the push would fail with no moves; the wall shows move 0
    result[event.id] = [sortedMoves.length > 0 ? +sortedMoves[m].moveNumber : 0, inject];
  }
  return result;
}

/** Why an article field could not be filled from the MSEL. */
export type ArticleFieldProblem = 'no-field' | 'not-set' | 'card-not-found' | 'not-a-date';

export interface GalleryWallArticle {
  scenarioEventId: string;
  move: number;
  inject: number;
  name: string;
  summary: string;
  /** HTML, as Gallery renders it. */
  description: string;
  fromOrg: string;
  /** The To Org team short names, or ALL, as the push splits them. */
  toOrgs: string[];
  status: GalleryItemStatus;
  sourceType: GallerySourceType;
  sourceName: string;
  datePosted: Date | null;
  url: string;
  openInNewTab: boolean;
  /** The MSEL card id the Card field holds, '' when none. */
  cardId: string;
  /** The MSEL card the article lands on, if the id matches one. */
  card?: Card;
  /** The parameters the push cannot fill, and why. */
  problems: Partial<Record<GalleryArticleParameter, ArticleFieldProblem>>;
}

/** The parameters Gallery can do without; the wall shows their placeholder but does not count them as problems. */
export const OPTIONAL_GALLERY_ARTICLE_PARAMETERS: GalleryArticleParameter[] = ['Url', 'OpenInNewTab'];

/** Whether the push cannot fill a field Gallery needs for this article. */
export function hasArticleProblems(article: GalleryWallArticle): boolean {
  return Object.keys(article.problems).some(
    (parameter) => !OPTIONAL_GALLERY_ARTICLE_PARAMETERS.includes(parameter as GalleryArticleParameter),
  );
}

/**
 * The articles the push would create: one per scenario event whose integration
 * target includes Gallery, filled from the data fields assigned to each parameter.
 */
export function buildGalleryWallArticles(
  scenarioEvents: ScenarioEvent[],
  dataFields: DataField[],
  dataValues: DataValue[],
  cards: Card[],
  moves: Move[],
): GalleryWallArticle[] {
  const galleryEvents = scenarioEvents.filter((se) => se.integrationTarget?.includes('Gallery'));
  // the push numbers every scenario event, not only the Gallery ones
  const movesAndInjects = getGalleryMovesAndInjects(scenarioEvents, moves);
  const valuesByEvent = new Map<string, DataValue[]>();
  dataValues.forEach((dv) => {
    const list = valuesByEvent.get(dv.scenarioEventId) ?? [];
    list.push(dv);
    valuesByEvent.set(dv.scenarioEventId, list);
  });

  return galleryEvents.map((event) => {
    // the event's own values when the store has none for it
    const values = valuesByEvent.get(event.id) ?? event.dataValues ?? [];
    const problems: GalleryWallArticle['problems'] = {};
    const read = (parameter: GalleryArticleParameter): string => {
      const { dataField, value } = getArticleValue(parameter, values, dataFields);
      if (!dataField) {
        problems[parameter] = 'no-field';
      } else if (!value) {
        problems[parameter] = 'not-set';
      }
      return value;
    };

    const cardId = read('CardId');
    const card = cardId ? cards.find((c) => c.id === cardId) : undefined;
    if (cardId && !card) {
      problems.CardId = 'card-not-found';
    }
    const name = read('Name');
    const summary = read('Summary');
    const description = read('Description');
    const fromOrg = read('FromOrg');
    const toOrg = read('ToOrg');
    const status = parseGalleryItemStatus(read('Status'));
    const sourceType = parseGallerySourceType(read('SourceType'));
    const sourceName = read('SourceName');
    const url = read('Url');
    const datePostedValue = read('DatePosted');
    let datePosted: Date | null = null;
    if (datePostedValue) {
      const parsed = new Date(datePostedValue);
      if (isNaN(parsed.getTime())) {
        problems.DatePosted = 'not-a-date';
      } else {
        datePosted = parsed;
      }
    }
    const openInNewTab = read('OpenInNewTab').toLowerCase() === 'true';
    const [move, inject] = movesAndInjects[event.id] ?? [0, 0];

    return {
      scenarioEventId: event.id,
      move,
      inject,
      name,
      summary,
      description,
      fromOrg,
      toOrgs: toOrg ? toOrg.split(',').map((s) => s.trim()).filter((s) => s) : [],
      status,
      sourceType,
      sourceName,
      datePosted,
      url,
      openInNewTab,
      cardId,
      card,
      problems,
    };
  });
}

/** CreateArticlesAsync: a team gets the article when To Org names ALL or the team's short name. */
export function isArticleForTeam(article: GalleryWallArticle, team: Team): boolean {
  return article.toOrgs.includes('ALL') || article.toOrgs.includes(team.shortName);
}

/**
 * Gallery's wall at the end of a move: articles in that move or an earlier
 * one (ArticleService.GetByExhibitAsync with every inject of the move released).
 */
export function isArticleReleasedByMove(article: GalleryWallArticle, moveNumber: number): boolean {
  return article.move <= moveNumber;
}

/** Newest first, the order Gallery lists a card's articles. */
export function sortArticlesNewestFirst(articles: GalleryWallArticle[]): GalleryWallArticle[] {
  return [...articles].sort((a, b) => {
    if (b.move !== a.move) {
      return b.move - a.move;
    }
    if (b.inject !== a.inject) {
      return b.inject - a.inject;
    }
    return (b.datePosted?.getTime() ?? 0) - (a.datePosted?.getTime() ?? 0);
  });
}

export interface GalleryWallTile {
  card: Card;
  /** The articles on this card for the team at the move, newest first. */
  articles: GalleryWallArticle[];
  /** The newest article's status; Gray with no articles, as Gallery shows it. */
  status: GalleryItemStatus;
  /** The newest article's Date Posted, if any. */
  datePosted: Date | null;
}

/** Why an article the team gets would not be on a wall tile. */
export type OffWallReason = 'no-card' | 'card-not-found' | 'card-hidden';

export interface OffWallArticle {
  article: GalleryWallArticle;
  reason: OffWallReason;
}

export interface GalleryWall {
  tiles: GalleryWallTile[];
  /** Articles the team gets at the move that land on no tile of its wall. */
  offWall: OffWallArticle[];
  /** How many articles the team gets at the move have fields the push cannot fill. */
  articlesWithProblems: number;
  /** How many articles the team gets at the move. */
  articleCount: number;
}

/**
 * The wall a team sees at the end of a move: one tile per card the team is
 * shown (CardTeam.isShownOnWall), carrying the articles the team gets.
 */
export function buildGalleryWall(
  cards: Card[],
  cardTeams: CardTeam[],
  articles: GalleryWallArticle[],
  team: Team | undefined,
  moveNumber: number,
): GalleryWall {
  if (!team) {
    return { tiles: [], offWall: [], articlesWithProblems: 0, articleCount: 0 };
  }
  const shownCardIds = new Set(
    cardTeams.filter((ct) => ct.teamId === team.id && ct.isShownOnWall).map((ct) => ct.cardId),
  );
  const teamArticles = sortArticlesNewestFirst(
    articles.filter((a) => isArticleForTeam(a, team) && isArticleReleasedByMove(a, moveNumber)),
  );
  const tiles: GalleryWallTile[] = cards
    .filter((card) => shownCardIds.has(card.id))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    .map((card) => {
      const cardArticles = teamArticles.filter((a) => a.card?.id === card.id);
      return {
        card,
        articles: cardArticles,
        status: cardArticles.length > 0 ? cardArticles[0].status : 'Gray',
        datePosted: cardArticles.length > 0 ? cardArticles[0].datePosted : null,
      };
    });
  const offWall: OffWallArticle[] = teamArticles
    .filter((a) => !a.card || !shownCardIds.has(a.card.id))
    .map((article) => ({
      article,
      reason: !article.cardId ? 'no-card' : !article.card ? 'card-not-found' : 'card-hidden',
    }));
  return {
    tiles,
    offWall,
    articlesWithProblems: teamArticles.filter(hasArticleProblems).length,
    articleCount: teamArticles.length,
  };
}

/** The muted text the wall shows in place of a field the push cannot fill. */
export function articlePlaceholder(parameter: GalleryArticleParameter, problem: ArticleFieldProblem): string {
  const label = GALLERY_ARTICLE_PARAMETER_LABELS[parameter];
  switch (problem) {
    case 'no-field':
      return `— no ${label} field —`;
    case 'card-not-found':
      return '— Card not found —';
    case 'not-a-date':
      return `— ${label} is not a date —`;
    default:
      return `— ${label} not set —`;
  }
}
