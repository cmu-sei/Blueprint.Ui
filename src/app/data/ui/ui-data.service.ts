/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable } from '@angular/core';

export class UIState {
  selectedTheme = '';
  selectedMselTab = '';
  expandedItems: string[] = [];
  navCollapsed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UIDataService {
  private uiState = JSON.parse(localStorage.getItem('uiState')) || new UIState();

  constructor() {}

  //
  // Item Expansion
  isItemExpanded(id: string): boolean {
    return this.uiState.expandedItems.some(ei => ei === id);
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
  // theme section
  setTheme(theme: string) {
    this.uiState.selectedTheme = theme;
    this.saveChanges();
  }

  getTheme(): string {
    return this.uiState.selectedTheme;
  }
  // end theme section

  saveChanges() {
    localStorage.setItem('uiState', JSON.stringify(this.uiState));
  }
}
