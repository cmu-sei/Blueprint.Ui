// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, OnDestroy, inject } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Card, CardTeam, DataField, DataValue, Move, Msel, ScenarioEvent, Team } from 'src/app/generated/blueprint.api';
import { CardQuery } from 'src/app/data/card/card.query';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import {
  ArticleFieldProblem,
  GALLERY_ITEM_STATUS_COLORS,
  GalleryArticleParameter,
  GalleryWall,
  GalleryWallArticle,
  GalleryWallTile,
  OffWallReason,
  articlePlaceholder,
  buildGalleryWall,
  buildGalleryWallArticles,
} from 'src/app/utilities/gallery-wall';

interface WallData {
  msel: Msel;
  teams: Team[];
  moves: Move[];
  cards: Card[];
  cardTeams: CardTeam[];
  dataFields: DataField[];
  dataValues: DataValue[];
  scenarioEvents: ScenarioEvent[];
}

/**
 * A read-only preview of the Gallery wall a MSEL team would see at the end of
 * a move, built with the field mapping the Gallery push uses, so a planner can
 * catch a mapping mistake before pushing. Nothing here writes to the API.
 */
@Component({
  selector: 'app-gallery-wall',
  templateUrl: './gallery-wall.component.html',
  styleUrls: ['./gallery-wall.component.scss'],
  imports: [DatePipe, NgTemplateOutlet, FormsModule, MatFormField, MatLabel, MatSelect, MatOption, MatIcon, MatTooltip, TimezoneAbbrPipe],
})
export class GalleryWallComponent implements OnDestroy {
  private mselQuery = inject(MselQuery);
  private teamQuery = inject(TeamQuery);
  private moveQuery = inject(MoveQuery);
  private cardQuery = inject(CardQuery);
  private cardTeamDataService = inject(CardTeamDataService);
  private dataFieldQuery = inject(DataFieldQuery);
  private dataValueQuery = inject(DataValueQuery);
  private scenarioEventQuery = inject(ScenarioEventQuery);
  private unsubscribe$ = new Subject<void>();

  teams: Team[] = [];
  moves: Move[] = [];
  selectedTeamId = '';
  selectedMoveNumber: number | null = null;
  expandedCardId = '';
  wall: GalleryWall = { tiles: [], offWall: [], articlesWithProblems: 0, articleCount: 0 };
  /** The articles the push would create, before the team and move filters. */
  articles: GalleryWallArticle[] = [];
  statusColors = GALLERY_ITEM_STATUS_COLORS;
  private data: WallData;

  constructor() {
    const data$: Observable<WallData> = combineLatest([
      this.mselQuery.selectActive() as Observable<Msel>,
      this.teamQuery.selectAll(),
      this.moveQuery.selectAll(),
      this.cardQuery.selectAll(),
      this.cardTeamDataService.cardTeams,
      this.dataFieldQuery.selectAll(),
      this.dataValueQuery.selectAll(),
      this.scenarioEventQuery.selectAll(),
    ]).pipe(
      map(([msel, teams, moves, cards, cardTeams, dataFields, dataValues, scenarioEvents]) => {
        const mselId = msel?.id;
        const ofMsel = <T extends { mselId?: string | null }>(items: T[]) => items.filter((item) => item.mselId === mselId);
        return {
          msel,
          teams: ofMsel(teams),
          moves: ofMsel(moves).sort((a, b) => +a.moveNumber - +b.moveNumber),
          cards: ofMsel(cards).filter((card) => !card.isTemplate),
          cardTeams,
          dataFields: ofMsel(dataFields),
          dataValues,
          scenarioEvents: ofMsel(scenarioEvents),
        };
      }),
    );
    data$.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      this.data = data;
      this.teams = data.teams;
      this.moves = data.moves;
      if (!this.teams.some((team) => team.id === this.selectedTeamId)) {
        this.selectedTeamId = this.teams[0]?.id ?? '';
      }
      if (!this.moves.some((move) => +move.moveNumber === this.selectedMoveNumber)) {
        this.selectedMoveNumber = this.moves.length > 0 ? +this.moves[0].moveNumber : null;
      }
      this.articles = buildGalleryWallArticles(data.scenarioEvents, data.dataFields, data.dataValues, data.cards, data.moves);
      this.rebuildWall();
    });
  }

  get selectedTeam(): Team | undefined {
    return this.teams.find((team) => team.id === this.selectedTeamId);
  }

  get hasGalleryEvents(): boolean {
    return this.articles.length > 0;
  }

  /** The one-line note under the title; empty when every article maps. */
  get problemNote(): string {
    const count = this.wall.articlesWithProblems;
    if (count === 0) {
      return '';
    }
    const noun = this.wall.articleCount === 1 ? 'article' : 'articles';
    const verb = count === 1 ? 'has' : 'have';
    return `${count} of ${this.wall.articleCount} ${noun} ${verb} fields the Gallery push cannot fill`;
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = teamId;
    this.rebuildWall();
  }

  selectMove(moveNumber: number) {
    this.selectedMoveNumber = moveNumber;
    this.rebuildWall();
  }

  toggleCard(tile: GalleryWallTile) {
    this.expandedCardId = this.expandedCardId === tile.card.id ? '' : tile.card.id;
  }

  isExpanded(tile: GalleryWallTile): boolean {
    return this.expandedCardId === tile.card.id;
  }

  articleCountLabel(tile: GalleryWallTile): string {
    const count = tile.articles.length;
    return count === 1 ? '1 article' : `${count} articles`;
  }

  problem(article: GalleryWallArticle, parameter: GalleryArticleParameter): ArticleFieldProblem | undefined {
    return article.problems[parameter];
  }

  placeholder(article: GalleryWallArticle, parameter: GalleryArticleParameter): string {
    const problem = this.problem(article, parameter);
    return problem ? articlePlaceholder(parameter, problem) : '';
  }

  /** The From Org → To Org line, with a placeholder for whichever side is missing. */
  toOrgText(article: GalleryWallArticle): string {
    return this.placeholder(article, 'ToOrg') || article.toOrgs.join(', ');
  }

  fromOrgText(article: GalleryWallArticle): string {
    return this.placeholder(article, 'FromOrg') || article.fromOrg;
  }

  offWallReason(reason: OffWallReason): string {
    switch (reason) {
      case 'no-card':
        return 'no card chosen, so Gallery shows it only in the archive';
      case 'card-not-found':
        return 'its card is not one of this MSEL\'s cards';
      default:
        return 'its card is not shown on this team\'s wall';
    }
  }

  trackTile(_index: number, tile: GalleryWallTile): string {
    return tile.card.id;
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private rebuildWall() {
    if (!this.data) {
      return;
    }
    this.wall = buildGalleryWall(this.data.cards, this.data.cardTeams, this.articles, this.selectedTeam, this.selectedMoveNumber ?? 0);
    if (!this.wall.tiles.some((tile) => tile.card.id === this.expandedCardId)) {
      this.expandedCardId = '';
    }
  }
}
