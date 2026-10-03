// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { UIDataService } from './ui-data.service';

const saved = () => JSON.parse(localStorage.getItem('uiState'));

describe('UIDataService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: a fresh service starts from defaults when nothing is saved.
   * Interacts with: UIDataService constructor, localStorage.
   * Data: empty localStorage.
   */
  it('starts from defaults', () => {
    const ui = new UIDataService();

    expect(ui.getMselTab()).toBe('');
    expect(ui.getAdminTab()).toBe('');
    expect(ui.getTheme()).toBe('');
    expect(ui.isNavCollapsed()).toBeUndefined();
    expect(ui.useRealTime()).toBeUndefined();
    expect(ui.getVisibleDataFieldColumns()).toEqual([]);
    expect(ui.isItemExpanded('anything')).toBe(false);
  });

  /**
   * Verifies: every setter persists to localStorage and a new service instance restores the saved state.
   * Interacts with: UIDataService setters/getters, localStorage.
   * Data: tab, admin tab, theme, nav, real-time and visible column choices.
   */
  it('persists choices and restores them in a new instance', () => {
    const ui = new UIDataService();
    ui.setMselTab('Scenario Events');
    ui.setAdminTab('Users');
    ui.setTheme('dark-theme');
    ui.setNavCollapsed(true);
    ui.setUseRealTime(true);
    ui.setVisibleDataFieldColumns(['Title', 'Assigned To']);

    expect(saved()).toMatchObject({
      selectedMselTab: 'Scenario Events',
      selectedAdminTab: 'Users',
      selectedTheme: 'dark-theme',
      navCollapsed: true,
      useRealTime: true,
      visibleDataFieldColumns: ['Title', 'Assigned To'],
    });

    const restored = new UIDataService();
    expect(restored.getMselTab()).toBe('Scenario Events');
    expect(restored.getAdminTab()).toBe('Users');
    expect(restored.getTheme()).toBe('dark-theme');
    expect(restored.isNavCollapsed()).toBe(true);
    expect(restored.useRealTime()).toBe(true);
    expect(restored.getVisibleDataFieldColumns()).toEqual(['Title', 'Assigned To']);
  });

  /**
   * Verifies: a saved state without visibleDataFieldColumns (from an older version) still reads back as an empty list.
   * Interacts with: UIDataService constructor and getVisibleDataFieldColumns, localStorage.
   * Data: saved state with visibleDataFieldColumns null.
   */
  it('treats a missing column list as empty', () => {
    localStorage.setItem('uiState', JSON.stringify({ visibleDataFieldColumns: null }));

    expect(new UIDataService().getVisibleDataFieldColumns()).toEqual([]);
  });

  /**
   * Verifies: items can be expanded and collapsed, and the expansion list is persisted.
   * Interacts with: UIDataService setItemExpanded / setItemCollapsed / isItemExpanded, localStorage.
   * Data: items a and b expanded, then a collapsed.
   */
  it('tracks expanded items', () => {
    const ui = new UIDataService();
    ui.setItemExpanded('a');
    ui.setItemExpanded('b');
    expect(ui.isItemExpanded('a')).toBe(true);

    ui.setItemCollapsed('a');

    expect(ui.isItemExpanded('a')).toBe(false);
    expect(ui.isItemExpanded('b')).toBe(true);
    expect(saved().expandedItems).toEqual(['b']);
  });

  /**
   * Verifies: collapsing an item that is not expanded removes the most recently expanded item instead.
   * Interacts with: UIDataService.setItemCollapsed.
   * Data: items a and b expanded; "never-expanded" collapsed.
   */
  it('collapsing an unknown item collapses the last expanded one', () => {
    const ui = new UIDataService();
    ui.setItemExpanded('a');
    ui.setItemExpanded('b');

    ui.setItemCollapsed('never-expanded');

    expect(ui.isItemExpanded('a')).toBe(true);
    expect(ui.isItemExpanded('b')).toBe(false);
  });

  /**
   * Verifies: inIframe reports false when the app is the top window.
   * Interacts with: UIDataService.inIframe, window.self/window.top.
   * Data: the jsdom top-level window.
   */
  it('inIframe is false at the top level', () => {
    expect(new UIDataService().inIframe()).toBe(false);
  });
});
