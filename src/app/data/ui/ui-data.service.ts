/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable } from '@angular/core';

export class UIState {
  selectedMselTab = '';
  selectedAdminTab = '';
  selectedTheme = '';
  expandedItems: string[] = [];
  navCollapsed: boolean;
  useRealTime: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UIDataService {
  private uiState = new UIState();

  constructor() {
    const savedState = JSON.parse(localStorage.getItem('uiState'));
    this.uiState = Object.assign(this.uiState, savedState);
  }

  //
  // Item Expansion
  isItemExpanded(id: string): boolean {
    return this.uiState.expandedItems.some((ei) => ei === id);
  }

  setItemExpanded(id: string) {
    this.uiState.expandedItems.push(id);
    this.saveChanges();
  }

  setItemCollapsed(id: string) {
    const index = this.uiState.expandedItems.indexOf(id, 0);
    this.uiState.expandedItems.splice(index, 1);
    this.saveChanges();
  }
  // end item expansion

  //
  // Nav bar Expansion
  isNavCollapsed(): boolean {
    return this.uiState.navCollapsed;
  }

  setNavCollapsed(value: boolean) {
    this.uiState.navCollapsed = value;
    this.saveChanges();
  }
  // end item expansion

  //
  // MSEL tab selection
  setMselTab(tabName: string) {
    this.uiState.selectedMselTab = tabName;
    this.saveChanges();
  }

  getMselTab(): string {
    return this.uiState.selectedMselTab;
  }
  // end MSEL tab section

  //
  // Admin tab selection
  setAdminTab(tabName: string) {
    this.uiState.selectedAdminTab = tabName;
    this.saveChanges();
  }

  getAdminTab(): string {
    return this.uiState.selectedAdminTab;
  }
  // end MSEL tab section

  inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  //
  // real time vs offset time display section
  useRealTime(): boolean {
    return this.uiState.useRealTime;
  }

  setUseRealTime(value: boolean) {
    this.uiState.useRealTime = value;
    this.saveChanges();
  }
  // end real time vs offset time display section

  //
  // theme section
  setTheme(theme: string) {
    this.uiState.selectedTheme = theme;
    this.saveChanges();
  }

  getTheme(): string {
    return this.uiState.selectedTheme;
  }
  // end theme

  saveChanges() {
    localStorage.setItem('uiState', JSON.stringify(this.uiState));
  }
}
