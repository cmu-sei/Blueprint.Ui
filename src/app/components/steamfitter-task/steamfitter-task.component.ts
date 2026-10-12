// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input } from '@angular/core';
import {
  ScenarioEvent,
  SteamfitterIntegrationType
} from 'src/app/generated/blueprint.api';
import { EDITOR_CONFIG, VIEW_CONFIG_AUTO_SIZE } from 'src/app/utilities/editor-config';

@Component({
  selector: 'app-steamfitter-task',
  templateUrl: './steamfitter-task.component.html',
  styleUrls: ['./steamfitter-task.component.scss'],
  standalone: false
})
export class SteamfitterTaskComponent {
  @Input() scenarioEvent: ScenarioEvent;
  @Input() canEdit: boolean;
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
