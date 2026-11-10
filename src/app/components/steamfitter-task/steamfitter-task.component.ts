// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, input } from '@angular/core';
import {
  ScenarioEvent,
  SteamfitterIntegrationType
} from 'src/app/generated/blueprint.api';
import { EDITOR_CONFIG, VIEW_CONFIG_AUTO_SIZE } from 'src/app/utilities/editor-config';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { AngularEditorModule } from '@kolkov/angular-editor';

@Component({
    selector: 'app-steamfitter-task',
    templateUrl: './steamfitter-task.component.html',
    styleUrls: ['./steamfitter-task.component.scss'],
    imports: [MatFormField, MatLabel, MatInput, FormsModule, MatSelect, MatOption, AngularEditorModule]
})
export class SteamfitterTaskComponent {
  @Input() scenarioEvent: ScenarioEvent;
  readonly canEdit = input<boolean>(undefined);
  steamfitterIntegrationType = SteamfitterIntegrationType;
  taskTypes = [
    SteamfitterIntegrationType.Notification,
    SteamfitterIntegrationType.Email,
    SteamfitterIntegrationType.SituationUpdate,
    SteamfitterIntegrationType.HttpGet,
    SteamfitterIntegrationType.HttpPost,
    SteamfitterIntegrationType.HttpPut,
    SteamfitterIntegrationType.HttpDelete
  ];
  editorConfig = EDITOR_CONFIG;
  viewConfig = VIEW_CONFIG_AUTO_SIZE;

  constructor(
  ) { }

}
