// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Card, CardService, Msel, MselRole } from 'src/app/generated/blueprint.api';
import { CardStore } from 'src/app/data/card/card.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { CardListComponent } from './card-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { CardTeamsComponent } from '../card-teams/card-teams.component';

@Component({ selector: 'app-card-teams', template: '' })
class CardTeamsStub {
  @Input() cardId: string;
  @Input() loggedInUserId: string;
}

const ME = 'user-me';
const TEMPLATE: Card = { id: 'card-t', name: 'Template Card', description: 'A template', isTemplate: true, mselId: null, move: 0, inject: 0 };
const MSEL_CARD: Card = { id: 'card-1', name: 'Situation Card', description: 'Move 1 situation', mselId: 'msel-1', move: 1, inject: 0 };

function msel(overrides: Partial<Msel> = {}): Msel {
  return { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', userMselRoles: [], ...overrides };
}

async function renderCardList(
  overrides: { canEdit?: boolean; showTemplates?: boolean; activeMsel?: Msel | null } = {},
) {
  const { canEdit = true, showTemplates = false, activeMsel = msel() } = overrides;
  const cardApi = {
    getCardTemplates: vi.fn(() => of([structuredClone(TEMPLATE)])),
    deleteCard: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CardService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(CardListComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
    ],
    childStubs: [
      { replace: CardTeamsComponent, with: CardTeamsStub },
    ],
    providers: [
      { provide: CardService, useValue: cardApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its cards; the stores are seeded instead.
      // The admin page has no active MSEL.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          if (activeMsel) {
            store.set([activeMsel]);
            store.setActive(activeMsel.id);
          }
          return store;
        },
      },
      {
        provide: CardStore,
        useFactory: () => {
          const store = new CardStore();
          store.set([structuredClone(MSEL_CARD)]);
          return store;
        },
      },
    ],
    inputs: { canEdit, showTemplates, loggedInUserId: ME },
  });
  return { ...rendered, cardApi, confirm };
}

const table = () => screen.getByRole('table');
const TEMPLATE_HEADER = ['Add a template card', 'Upload Card templates from JSON', 'Download Card templates as JSON'];

describe('CardListComponent', () => {
  describe('templates (admin)', () => {
    /**
     * Verifies: with canEdit the template list offers add, upload, download, edit and delete.
     * Interacts with: CardService.getCardTemplates (stub), real CardDataService and CardQuery.
     * Data: showTemplates true; canEdit true; no active MSEL; one template card and one MSEL card.
     */
    it('offers template actions with canEdit', async () => {
      const { cardApi } = await renderCardList({ showTemplates: true, canEdit: true, activeMsel: null });

      expect(cardApi.getCardTemplates).toHaveBeenCalledTimes(1);
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).getByTitle(title)).toBeInTheDocument();
      }
      expect(within(table()).getByRole('button', { name: 'Edit Template Card' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Template Card' })).toBeInTheDocument();
      expect(within(table()).queryByText('Situation Card')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without canEdit the template list is read-only.
     * Interacts with: CardService.getCardTemplates (stub), CardListComponent template.
     * Data: showTemplates true; canEdit false; no active MSEL; one template card.
     */
    it('hides template actions without canEdit', async () => {
      await renderCardList({ showTemplates: true, canEdit: false, activeMsel: null });

      expect(within(table()).getByText('Template Card')).toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Edit Template Card' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Delete Template Card' })).not.toBeInTheDocument();
    });
  });

  describe('MSEL cards', () => {
    /**
     * Verifies: with canEdit the MSEL's cards can be added, edited, deleted and made into templates.
     * Interacts with: real MselStore/MselQuery (active MSEL), real CardStore/CardQuery (seeded).
     * Data: showTemplates false; canEdit true; the user holds no MSEL role.
     */
    it('offers card actions with canEdit', async () => {
      await renderCardList({ canEdit: true });

      expect(within(table()).getByTitle('Add card')).toBeInTheDocument();
      for (const name of ['Edit Situation Card', 'Delete Situation Card', 'Make Situation Card a template']) {
        expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
      }
      expect(within(table()).queryByText('Template Card')).not.toBeInTheDocument();
    });

    /**
     * Verifies: the MSEL owner may add, edit and delete cards without canEdit, but not make templates.
     * Interacts with: MselPlus.hasRole (owner by createdBy), CardListComponent template.
     * Data: showTemplates false; canEdit false; the MSEL was created by the user.
     */
    it('lets the MSEL owner edit cards without canEdit, but not make templates', async () => {
      await renderCardList({ canEdit: false, activeMsel: msel({ createdBy: ME }) });

      expect(within(table()).getByTitle('Add card')).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Edit Situation Card' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Situation Card' })).toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Make Situation Card a template' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: a non-owner without canEdit sees the cards but no card action, even as an MSEL Editor.
     * Interacts with: MselPlus.hasRole, CardListComponent template.
     * Data: showTemplates false; canEdit false; the user is an MSEL Editor (near miss: not Owner).
     */
    it('hides card actions without canEdit for a non-owner', async () => {
      await renderCardList({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Editor }] }),
      });

      expect(within(table()).getByText('Situation Card')).toBeInTheDocument();
      expect(within(table()).queryByTitle('Add card')).not.toBeInTheDocument();
      for (const name of ['Edit Situation Card', 'Delete Situation Card', 'Make Situation Card a template']) {
        expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    /**
     * Verifies: clicking a card row expands it and shows its team selection.
     * Interacts with: row click, CardTeamsStub inputs.
     * Data: showTemplates false; canEdit true.
     */
    it('expands a card to pick its teams', async () => {
      const { fixture } = await renderCardList({ canEdit: true });
      const user = userEvent.setup();

      await user.click(within(table()).getByText('Situation Card'));

      const teams = fixture.debugElement.query(By.directive(CardTeamsStub)).componentInstance as CardTeamsStub;
      expect(teams.cardId).toBe('card-1');
      expect(teams.loggedInUserId).toBe(ME);
    });

    /**
     * Verifies: confirming Delete removes the card through the API and from the list.
     * Interacts with: CrucibleDialogService.confirm (stub, confirms), CardService.deleteCard (stub), real CardStore.
     * Data: showTemplates false; canEdit true.
     */
    it('deletes a card after confirmation', async () => {
      const { cardApi, confirm } = await renderCardList({ canEdit: true });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Delete Situation Card' }));

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Card' }));
      expect(cardApi.deleteCard).toHaveBeenCalledWith('card-1');
      expect(within(table()).queryByText('Situation Card')).not.toBeInTheDocument();
    });
  });
});
