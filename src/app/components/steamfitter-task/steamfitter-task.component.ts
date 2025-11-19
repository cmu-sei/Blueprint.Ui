// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input } from '@angular/core';
import {
  ScenarioEvent,
  SteamfitterIntegrationType
} from 'src/app/generated/blueprint.api';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
    selector: 'app-steamfitter-task',
    templateUrl: './steamfitter-task.component.html',
    styleUrls: ['./steamfitter-task.component.scss'],
    standalone: false
})
export class SteamfitterTaskComponent {
  @Input() scenarioEvent: ScenarioEvent;
  steamfitterIntegrationType = SteamfitterIntegrationType;
  taskTypes = [
    SteamfitterIntegrationType.Notification,
    SteamfitterIntegrationType.Email,
    SteamfitterIntegrationType.SituationUpdate,
    SteamfitterIntegrationType.http_get,
    SteamfitterIntegrationType.http_post,
    SteamfitterIntegrationType.http_put,
    SteamfitterIntegrationType.http_delete
  ];
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
  };

  constructor(
  ) {}

}
