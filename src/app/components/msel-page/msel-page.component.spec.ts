// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { MselPage, MselPageService } from 'src/app/generated/blueprint.api';
import { MselPageComponent } from './msel-page.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';

const PAGE: MselPage = { id: 'page-1', mselId: 'msel-1', name: 'Read Ahead', content: '<p>Welcome to the exercise</p>' };

async function renderMselPage() {
  const pageApi = {
    getMselPage: vi.fn(() => of(structuredClone(PAGE))),
  } satisfies ApiStub<MselPageService>;
  const { route } = activatedRouteStub({}, { id: 'page-1' });
  const rendered = await renderComponent(MselPageComponent, {
    imports: [AngularEditorModule],
    declarations: [MselPageComponent],
    providers: [
      { provide: MselPageService, useValue: pageApi },
      { provide: ActivatedRoute, useValue: route },
      { provide: ComnSettingsService, useValue: { settings: { AppTitle: 'Blueprint' } } satisfies Pick<ComnSettingsService, 'settings'> },
      // angular-editor injects HttpClient for its image upload.
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, pageApi };
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
});
