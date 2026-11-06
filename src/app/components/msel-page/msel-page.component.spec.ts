// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { within } from '@testing-library/angular';
import { Msel, MselPage, MselPageService, MselService } from 'src/app/generated/blueprint.api';
import { MselPageComponent } from './msel-page.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';

const PAGE: MselPage = { id: 'page-1', mselId: 'msel-1', name: 'Read Ahead', content: '<p>Welcome to the exercise</p>' };

async function renderMselPage(marking: Partial<Msel> = {}, getMsel?: () => Observable<Msel>) {
  const pageApi = {
    getMselPage: vi.fn(() => of(structuredClone(PAGE))),
  } satisfies ApiStub<MselPageService>;
  const mselApi = {
    getMsel: vi.fn(getMsel ?? (() => of<Msel>({ id: 'msel-1', name: 'Deep Bite', ...marking }))),
  } satisfies ApiStub<MselService>;
  const { route } = activatedRouteStub({}, { id: 'page-1' });
  const rendered = await renderComponent(MselPageComponent, {
    imports: [AngularEditorModule],
    declarations: [MselPageComponent],
    providers: [
      { provide: MselPageService, useValue: pageApi },
      { provide: MselService, useValue: mselApi },
      { provide: ActivatedRoute, useValue: route },
      { provide: ComnSettingsService, useValue: { settings: { AppTitle: 'Blueprint' } } satisfies Pick<ComnSettingsService, 'settings'> },
      // angular-editor injects HttpClient for its image upload.
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, pageApi, mselApi };
}

describe('MselPageComponent', () => {
  // The component writes the page title into index.html's <title id="appTitle">.
  beforeEach(() => {
    const title = document.createElement('title');
    title.id = 'appTitle';
    document.head.appendChild(title);
  });
  afterEach(() => {
    document.getElementById('appTitle')?.remove();
  });

  /**
   * Verifies: the component mounts with the default test providers, loads the page named in the route, shows its content and titles the document.
   * Interacts with: MselPageService.getMselPage (stub), real MselPageDataService and MselPageQuery, the appTitle element.
   * Data: route id page-1, "Read Ahead".
   */
  it('renders with the default test providers', async () => {
    const { fixture, pageApi } = await renderMselPage();

    expect(fixture.componentInstance).toBeInstanceOf(MselPageComponent);
    expect(pageApi.getMselPage).toHaveBeenCalledWith('page-1');
    expect(fixture.nativeElement).toHaveTextContent('Welcome to the exercise');
    expect(document.getElementById('appTitle')).toHaveTextContent('Blueprint MSEL Page');
  });

  // by selector: naming a role reads computed styles, which jsdom cannot compute for the editor's stylesheet
  const banners = () => Array.from(document.querySelectorAll<HTMLElement>('[role="note"][aria-label="Marking"]'));

  /**
   * Verifies: a page of a MSEL with no marking, or with None, has no banner.
   * Interacts with: MselService.getMsel (stub), markingBanner.
   * Data: the MSEL of page-1 with no marking set, then with None.
   */
  it.each([
    { label: 'no marking set', marking: {} },
    { label: 'None', marking: { articleMarking: 'None' } },
  ])('draws no banner for a MSEL with $label', async ({ marking }) => {
    const { mselApi } = await renderMselPage(marking);

    expect(mselApi.getMsel).toHaveBeenCalledWith('msel-1');
    expect(banners()).toHaveLength(0);
  });

  /**
   * Verifies: the MSEL's marking is drawn above and below the page's content, in the words and colours of the Gallery article banner.
   * Interacts with: MselService.getMsel (stub), markingBanner, the banner template.
   * Data: the MSEL Deep Bite of page-1, marked with an exercise banner, TLP:AMBER, TLP with a level it does not know, and a SECRET classification.
   */
  it.each([
    { label: 'an exercise banner', marking: { articleMarking: 'Exercise' }, text: 'EXERCISE · EXERCISE · EXERCISE', subtext: 'Deep Bite · FICTIONAL SCENARIO', background: '#FDB516', color: '#000000' },
    { label: 'TLP:AMBER', marking: { articleMarking: 'Tlp', articleMarkingText: 'AMBER' }, text: 'TLP:AMBER', background: '#000000', color: '#FFC000' },
    { label: 'TLP of an unknown level', marking: { articleMarking: 'Tlp', articleMarkingText: 'purple' }, text: 'TLP:CLEAR', background: '#000000', color: '#FFFFFF' },
    { label: 'a SECRET classification', marking: { articleMarking: 'Classification', articleMarkingText: 'Secret//NoForn' }, text: 'SECRET//NOFORN', background: '#C8102E', color: '#FFFFFF' },
    { label: 'a CUI classification', marking: { articleMarking: 'Classification', articleMarkingText: 'CUI' }, text: 'CUI', background: '#502B85', color: '#FFFFFF' },
  ])('draws $label above and below the page', async ({ marking, text, subtext, background, color }) => {
    const { fixture } = await renderMselPage(marking);

    const [top, bottom] = banners();
    expect(banners()).toHaveLength(2);
    for (const banner of [top, bottom]) {
      expect(banner.style.backgroundColor).toBe(hexToRgb(background));
      expect(within(banner).getByText(text).style.color).toBe(hexToRgb(color));
      if (subtext) {
        expect(banner).toHaveTextContent(subtext);
      }
    }
    const page = fixture.nativeElement.querySelector('.page') as HTMLElement;
    expect(page.firstElementChild).toBe(top);
    expect(page.lastElementChild).toBe(bottom);
    expect(page).toHaveTextContent('Welcome to the exercise');
  });

  /**
   * Verifies: a classification marking with no words, which the API saves as none, draws no banner.
   * Interacts with: MselService.getMsel (stub), markingBanner.
   * Data: the MSEL of page-1 marked Classification with blank text.
   */
  it('draws no banner for a classification with no words', async () => {
    await renderMselPage({ articleMarking: 'Classification', articleMarkingText: '  ' });

    expect(banners()).toHaveLength(0);
  });

  /**
   * Verifies: when the page's MSEL cannot be read the page is still shown, without a banner.
   * Interacts with: MselService.getMsel (stub failing).
   * Data: page-1, whose MSEL read is refused.
   */
  it('shows the page without a banner when its MSEL cannot be read', async () => {
    const { fixture } = await renderMselPage({}, () => throwError(() => new Error('403')));

    expect(banners()).toHaveLength(0);
    expect(fixture.nativeElement).toHaveTextContent('Welcome to the exercise');
  });
});

function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
