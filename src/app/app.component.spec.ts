// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { of } from 'rxjs';
import { ComnAuthQuery, ComnAuthService, CrucibleThemeService, Theme } from '@cmusei/crucible-common';
import { AppComponent } from './app.component';
import { activatedRouteStub } from './test-utils/activated-route';
import { renderComponent } from './test-utils/render-component';

@Component({ selector: 'comn-header-bar', template: '', standalone: false })
class HeaderBarStub {}

async function renderApp(overrides: { queryParams?: Record<string, string>; userTheme?: Theme } = {}) {
  const { queryParams = {}, userTheme = Theme.LIGHT } = overrides;
  const applyTheme = vi.fn();
  const setUserTheme = vi.fn();
  const { route } = activatedRouteStub(queryParams);
  const rendered = await renderComponent(AppComponent, {
    declarations: [AppComponent, HeaderBarStub],
    providers: [
      // The real registry, so the icon registration can be observed.
      { provide: MatIconRegistry, useClass: MatIconRegistry },
      { provide: CrucibleThemeService, useValue: { applyTheme } satisfies Pick<CrucibleThemeService, 'applyTheme'> },
      { provide: ComnAuthService, useValue: { setUserTheme } satisfies Pick<ComnAuthService, 'setUserTheme'> },
      { provide: ComnAuthQuery, useValue: { userTheme$: of(userTheme) } satisfies Pick<ComnAuthQuery, 'userTheme$'> },
      { provide: ActivatedRoute, useValue: route },
    ],
    configureTestBed: () => {
      const registry = TestBed.inject(MatIconRegistry);
      vi.spyOn(registry, 'addSvgIcon');
      vi.spyOn(registry, 'setDefaultFontSetClass');
    },
  });
  renderedFixture = rendered.fixture;
  return { ...rendered, applyTheme, setUserTheme };
}

// AppComponent.ngOnDestroy throws (see 'throws when it is destroyed'). Each
// test's fixture is destroyed here, before TestBed's own teardown, so that
// teardown does not fail on it.
let renderedFixture: ComponentFixture<AppComponent> | undefined;
afterEach(() => {
  try {
    renderedFixture?.destroy();
  } catch (error) {
    if (!(error instanceof Error && error.message === 'Method not implemented.')) {
      throw error;
    }
  }
  renderedFixture = undefined;
});

describe('AppComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers, registers the Blueprint icon and the mdi font set, and applies the user's theme.
   * Interacts with: MatIconRegistry (real, spied), CrucibleThemeService.applyTheme (stub), ComnAuthQuery.userTheme$ (stub).
   * Data: user theme dark; no theme query parameter.
   */
  it('renders with the default test providers', async () => {
    const { fixture, applyTheme, setUserTheme } = await renderApp({ userTheme: Theme.DARK });
    const registry = TestBed.inject(MatIconRegistry);

    expect(fixture.componentInstance).toBeInstanceOf(AppComponent);
    expect(registry.setDefaultFontSetClass).toHaveBeenCalledWith('mdi');
    expect(registry.addSvgIcon).toHaveBeenCalledWith('crucible-icon-blueprint', expect.anything());
    expect(applyTheme).toHaveBeenCalledWith(Theme.DARK);
    expect(setUserTheme).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('main.app-main router-outlet')).not.toBeNull();
  });

  /**
   * Verifies: a theme query parameter sets the user's theme.
   * Interacts with: ActivatedRoute.queryParamMap (stub), ComnAuthService.setUserTheme (stub).
   * Data: ?theme=dark-theme.
   */
  it('takes the theme from the query string', async () => {
    const { setUserTheme } = await renderApp({ queryParams: { theme: Theme.DARK } });

    expect(setUserTheme).toHaveBeenCalledWith(Theme.DARK);
  });

  /**
   * Verifies: destroying the component throws 'Method not implemented.' (current behavior).
   * Interacts with: AppComponent.ngOnDestroy.
   * Data: a rendered AppComponent.
   */
  it('throws when it is destroyed', async () => {
    const { fixture } = await renderApp();

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(() => fixture.destroy()).toThrow('Method not implemented.');
  });
});
