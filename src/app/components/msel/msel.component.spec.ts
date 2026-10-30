// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject } from 'rxjs';
import { Theme } from '@cmusei/crucible-common';
import { Msel, MselUnit } from 'src/app/generated/blueprint.api';
import { MselUnitStore } from 'src/app/data/msel-unit/msel-unit.store';
import { XApiService } from 'src/app/services/xapi/xapi.service';
import { MselComponent } from './msel.component';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';
import { MselInfoComponent } from '../msel-info/msel-info.component';
import { MselContributorsComponent } from '../msel-contributors/msel-contributors.component';
import { MselTeamsComponent } from '../msel-teams/msel-teams.component';
import { DataFieldListComponent } from '../data-field-list/data-field-list.component';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { MoveListComponent } from '../move-list/move-list.component';
import { PlayerApplicationListComponent } from '../player-application-list/player-application-list.component';
import { CardListComponent } from '../card-list/card-list.component';
import { CiteActionListComponent } from '../cite-action-list/cite-action-list.component';
import { CiteDutyListComponent } from '../cite-duty-list/cite-duty-list.component';
import { MselCompetenciesComponent } from '../msel-competencies/msel-competencies.component';
import { ScenarioEventListComponent } from '../scenario-event-list/scenario-event-list.component';
import { MselViewComponent } from '../msel-view/msel-view.component';
import { AssessorViewComponent } from '../assessor-view/assessor-view.component';
import { InvitationListComponent } from '../invitation-list/invitation-list.component';
import { MselPlaybookComponent } from '../msel-playbook/msel-playbook.component';
import { MselAssistantComponent } from '../msel-assistant/msel-assistant.component';
import { MselAiBuildComponent } from '../msel-ai-build/msel-ai-build.component';
import { MselAiBuildService } from 'src/app/data/msel/msel-ai-build.service';

// One stub per tab; each declares the inputs MselComponent binds.
@Component({ selector: 'app-msel-info', template: '' })
class MselInfoStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly deleteThisMsel = output<string>();
}
@Component({ selector: 'app-msel-contributors', template: '' })
class MselContributorsStub {
  readonly loggedInUserId = input<string>(undefined);
}
@Component({ selector: 'app-msel-teams', template: '' })
class MselTeamsStub {
  readonly loggedInUserId = input<string>(undefined);
}
@Component({ selector: 'app-data-field-list', template: '' })
class DataFieldListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly showTemplates = input<boolean>(undefined);
  readonly userTheme = input<Theme>(undefined);
}
@Component({ selector: 'app-organization-list', template: '' })
class OrganizationListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly showTemplates = input<boolean>(undefined);
}
@Component({ selector: 'app-move-list', template: '' })
class MoveListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
}
@Component({ selector: 'app-player-application-list', template: '' })
class PlayerApplicationListStub {
  readonly loggedInUserId = input<string>(undefined);
}
@Component({ selector: 'app-card-list', template: '' })
class CardListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly showTemplates = input<boolean>(undefined);
}
@Component({ selector: 'app-cite-action-list', template: '' })
class CiteActionListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}
@Component({ selector: 'app-cite-duty-list', template: '' })
class CiteDutyListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}
@Component({ selector: 'app-msel-competencies', template: '' })
class MselCompetenciesStub {
  readonly loggedInUserId = input<string>(undefined);
}
@Component({ selector: 'app-scenario-event-list', template: '' })
class ScenarioEventListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
}
@Component({ selector: 'app-msel-view', template: '' })
class MselViewStub {
  readonly tabHeight = input<number>(undefined);
  readonly userTheme = input<Theme>(undefined);
}
@Component({ selector: 'app-assessor-view', template: '' })
class AssessorViewStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
  readonly canEditCheckboxes = input<boolean>(undefined);
}
@Component({ selector: 'app-invitation-list', template: '' })
class InvitationListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
  readonly hideSearch = input<boolean>(undefined);
}
@Component({ selector: 'app-msel-playbook', template: '' })
class MselPlaybookStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
}


const MSEL: Msel = {
  id: 'msel-1',
  name: 'Exercise Alpha',
  usePlayer: true,
  useGallery: true,
  useCite: true,
  createdBy: 'someone-else',
  userMselRoles: [],
};

@Component({ selector: 'app-msel-assistant', template: '' })
class MselAssistantStub {
  readonly mselId = input<string>(undefined);
  readonly closePanel = output<void>();
}

@Component({ selector: 'app-msel-ai-build', template: '' })
class MselAiBuildStub {
  readonly mselId = input<string>(undefined);
  readonly mselName = input<string>(undefined);
  readonly stage = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly discard = output<string>();
}

async function renderMsel(
  overrides: { canEditMsel?: boolean; canAccessAdminSection?: boolean; canEditCheckboxes?: boolean; msel?: Msel; mselUnits?: MselUnit[] } = {},
) {
  const { canEditMsel = false, canAccessAdminSection = false, canEditCheckboxes = false, msel = MSEL, mselUnits = [] } = overrides;
  const apis = mselLoadApiStubs({ msel, mselUnits });
  const xApi = { viewedMsel: vi.fn(() => of(null)) } satisfies Pick<XApiService, 'viewedMsel'>;
  const { route, setQueryParams } = activatedRouteStub({ msel: 'msel-1' });
  const finished$ = new Subject<string>();
  const rendered = await renderComponent(MselComponent, {
    imports: [MatButtonModule, MatIconModule, MatListModule, MatSidenavModule],
    childStubs: [
      { replace: MselInfoComponent, with: MselInfoStub },
      { replace: MselContributorsComponent, with: MselContributorsStub },
      { replace: MselTeamsComponent, with: MselTeamsStub },
      { replace: DataFieldListComponent, with: DataFieldListStub },
      { replace: OrganizationListComponent, with: OrganizationListStub },
      { replace: MoveListComponent, with: MoveListStub },
      { replace: PlayerApplicationListComponent, with: PlayerApplicationListStub },
      { replace: CardListComponent, with: CardListStub },
      { replace: CiteActionListComponent, with: CiteActionListStub },
      { replace: CiteDutyListComponent, with: CiteDutyListStub },
      { replace: MselCompetenciesComponent, with: MselCompetenciesStub },
      { replace: ScenarioEventListComponent, with: ScenarioEventListStub },
      { replace: MselViewComponent, with: MselViewStub },
      { replace: AssessorViewComponent, with: AssessorViewStub },
      { replace: InvitationListComponent, with: InvitationListStub },
      { replace: MselPlaybookComponent, with: MselPlaybookStub },
      { replace: MselAssistantComponent, with: MselAssistantStub },
      { replace: MselAiBuildComponent, with: MselAiBuildStub },
    ],
    providers: [
      ...mselLoadApiProviders(apis),
      { provide: XApiService, useValue: xApi },
      { provide: ActivatedRoute, useValue: route },
      { provide: MselAiBuildService, useValue: { finished$ } },
    ],
    inputs: { canEditMsel, canAccessAdminSection, canEditCheckboxes, loggedInUserId: 'user-me', userTheme$: of(Theme.LIGHT) },
  });
  return { ...rendered, apis, xApi, setQueryParams, finished$ };
}

const nav = () => within(document.querySelector('mat-drawer mat-list') as HTMLElement);
async function openTab(name: string) {
  const user = userEvent.setup();
  await user.click(nav().getByText(name));
  return user;
}
function child<T>(fixture: ComponentFixture<unknown>, stub: new (...args: never[]) => T): T | undefined {
  return fixture.debugElement.query(By.directive(stub))?.componentInstance;
}

// The tabs that pass canEditMsel down, with the input each child receives it as.
const EDIT_TABS = [
  { tab: 'Organizations', read: (f: ComponentFixture<unknown>) => child(f, OrganizationListStub)?.canEdit() },
  { tab: 'Moves', read: (f: ComponentFixture<unknown>) => child(f, MoveListStub)?.canEditMsel() },
  { tab: 'Gallery Cards', read: (f: ComponentFixture<unknown>) => child(f, CardListStub)?.canEdit() },
  { tab: 'CITE Actions', read: (f: ComponentFixture<unknown>) => child(f, CiteActionListStub)?.canEdit() },
  { tab: 'CITE Duties', read: (f: ComponentFixture<unknown>) => child(f, CiteDutyListStub)?.canEdit() },
  { tab: 'Invitations', read: (f: ComponentFixture<unknown>) => child(f, InvitationListStub)?.canEditMsel() },
  { tab: 'MSEL Playbook', read: (f: ComponentFixture<unknown>) => child(f, MselPlaybookStub)?.canEditMsel() },
];

describe('MselComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: opening the page loads the MSEL named in the route and its data, logs the xAPI view, and shows the Info tab.
   * Interacts with: the MSEL endpoints (stubs), XApiService.viewedMsel (stub), real data services and stores.
   * Data: msel=msel-1; no saved tab.
   */
  it('loads the MSEL and opens the Info tab', async () => {
    const { fixture, apis, xApi } = await renderMsel();

    expect(xApi.viewedMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    for (const endpoint of [apis.move.getMovesByMsel, apis.dataField.getDataFieldsByMsel, apis.scenarioEvent.getScenarioEventsByMsel, apis.invitation.getInvitations, apis.mselUnit.getMselUnits]) {
      expect(endpoint).toHaveBeenCalledWith('msel-1');
    }
    expect(child(fixture, MselInfoStub)?.loggedInUserId()).toBe('user-me');
  });

  /**
   * Verifies: the AI draft banner gets the MSEL and its build stage, and a build that finishes loads the MSEL again; another MSEL's does not.
   * Interacts with: MselAiBuildService.finished$ (stub), the MSEL endpoints (stubs).
   * Data: msel-1 at the Articles stage; builds of msel-2, then msel-1, finish.
   */
  it('shows the AI draft banner and reloads when the build finishes', async () => {
    const { fixture, apis, finished$ } = await renderMsel({ canEditMsel: true, msel: { ...MSEL, aiDraftStage: 'Articles' } });
    const banner = child(fixture, MselAiBuildStub);

    expect(banner?.mselId()).toBe('msel-1');
    expect(banner?.stage()).toBe('Articles');
    expect(banner?.canEdit()).toBe(true);

    finished$.next('msel-2');
    expect(apis.msel.getMsel).toHaveBeenCalledTimes(1);
    finished$.next('msel-1');
    expect(apis.msel.getMsel).toHaveBeenCalledTimes(2);
    expect(apis.scenarioEvent.getScenarioEventsByMsel).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: a change to another query parameter, such as the theme, does not load the open MSEL again.
   * Interacts with: the route's queryParamMap (stub), the MSEL endpoints (stubs).
   * Data: msel=msel-1, then msel=msel-1 with theme=dark.
   */
  it('keeps the loaded MSEL when another query parameter changes', async () => {
    const { apis, setQueryParams } = await renderMsel();

    setQueryParams({ msel: 'msel-1', theme: 'dark' });

    expect(apis.msel.getMsel).toHaveBeenCalledTimes(1);
    expect(apis.move.getMovesByMsel).toHaveBeenCalledTimes(1);
    expect(apis.user.getMselUsers).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: the MSEL's users load once with the MSEL, and again only when its contributor units change, not when a contributor row is merely updated.
   * Interacts with: UserService.getMselUsers (stub), real MselUnitDataService and MselUnitStore.
   * Data: one contributor unit; then the same row updated; then a second unit added.
   */
  it('reloads the MSEL users only when its contributors change', async () => {
    const contributor: MselUnit = { id: 'mu-1', mselId: 'msel-1', unitId: 'unit-1' };
    const { fixture, apis } = await renderMsel({ mselUnits: [contributor] });
    const mselUnitStore = fixture.debugElement.injector.get(MselUnitStore);

    expect(apis.user.getMselUsers).toHaveBeenCalledTimes(1);

    mselUnitStore.upsert('mu-1', { ...contributor, mselId: 'msel-1' });
    expect(apis.user.getMselUsers).toHaveBeenCalledTimes(1);

    mselUnitStore.upsert('mu-2', { id: 'mu-2', mselId: 'msel-1', unitId: 'unit-2' });
    expect(apis.user.getMselUsers).toHaveBeenCalledTimes(2);
    expect(apis.user.getMselUsers).toHaveBeenLastCalledWith('msel-1');
  });

  /**
   * Verifies: the integration tabs appear only for the integrations the MSEL uses.
   * Interacts with: MselComponent.getTabListItems, real MselQuery.
   * Data: an MSEL with Player, Gallery and CITE all off.
   */
  it('hides the tabs of integrations the MSEL does not use', async () => {
    await renderMsel({ msel: { ...MSEL, usePlayer: false, useGallery: false, useCite: false } });

    expect(nav().getByText('Moves')).toBeInTheDocument();
    for (const tab of ['Player Apps', 'Gallery Cards', 'CITE Actions', 'CITE Duties']) {
      expect(nav().queryByText(tab)).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: each editing tab receives canEditMsel, as true when granted and false when not.
   * Interacts with: the side navigation, child stubs' inputs.
   * Data: canEditMsel true and false; one row per tab.
   */
  it.each(EDIT_TABS.flatMap((t) => [true, false].map((canEditMsel) => ({ ...t, canEditMsel }))))(
    '$tab gets canEditMsel $canEditMsel',
    async ({ tab, read, canEditMsel }) => {
      const { fixture } = await renderMsel({ canEditMsel });

      await openTab(tab);

      expect(read(fixture)).toBe(canEditMsel);
    },
  );

  /**
   * Verifies: the Assessor View tab receives canEditCheckboxes, true and false.
   * Interacts with: the side navigation, AssessorViewStub input.
   * Data: canEditCheckboxes true and false.
   */
  it.each([true, false])('passes canEditCheckboxes %s to the Assessor View', async (canEditCheckboxes) => {
    const { fixture } = await renderMsel({ canEditCheckboxes });

    await openTab('Assessor View');

    expect(child(fixture, AssessorViewStub)?.canEditCheckboxes()).toBe(canEditCheckboxes);
  });

  /**
   * Verifies: with canAccessAdminSection the navigation offers Administration, which opens /admin with the return URL.
   * Interacts with: Router.navigate (spy).
   * Data: canAccessAdminSection true.
   */
  it('offers Administration with canAccessAdminSection', async () => {
    await renderMsel({ canAccessAdminSection: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Administration' }));

    expect(navigate).toHaveBeenCalledWith(['/admin'], { queryParams: { returnUrl: '/' } });
  });

  /**
   * Verifies: without canAccessAdminSection there is no Administration button.
   * Interacts with: MselComponent template.
   * Data: canAccessAdminSection false; canEditMsel true (near miss: an MSEL editor without admin access).
   */
  it('hides Administration without canAccessAdminSection', async () => {
    await renderMsel({ canAccessAdminSection: false, canEditMsel: true });

    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: an MSEL editor gets Ask AI, which opens the assistant panel for this MSEL beside the tabs, and the panel closes itself.
   * Interacts with: the Ask AI button, MselAssistantStub mselId and closePanel.
   * Data: canEditMsel true; MSEL msel-1.
   */
  it('opens and closes Ask AI for an editor', async () => {
    const { fixture } = await renderMsel({ canEditMsel: true });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    const panel = child(fixture, MselAssistantStub);
    expect(panel.mselId()).toBe('msel-1');
    panel.closePanel.emit();
    fixture.detectChanges();

    expect(child(fixture, MselAssistantStub)).toBeUndefined();
  });

  /**
   * Verifies: without canEditMsel there is no Ask AI button and no panel.
   * Interacts with: MselComponent template.
   * Data: canEditMsel false.
   */
  it('hides Ask AI without canEditMsel', async () => {
    const { fixture } = await renderMsel({ canEditMsel: false });

    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
    expect(child(fixture, MselAssistantStub)).toBeUndefined();
  });
});
