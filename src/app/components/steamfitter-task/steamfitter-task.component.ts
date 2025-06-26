// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input } from '@angular/core';
import {
  ScenarioEvent,
  SteamfitterTask,
  SteamfitterIntegrationType
} from 'src/app/generated/blueprint.api';

@Component({
  selector: 'app-steamfitter-task',
  templateUrl: './steamfitter-task.component.html',
  styleUrls: ['./steamfitter-task.component.scss'],
})
export class SteamfitterTaskComponent {
  @Input() scenarioEvent: ScenarioEvent;
  steamfitterIntegrationType = SteamfitterIntegrationType;
  taskTypes = [
    SteamfitterIntegrationType.Notification,
    SteamfitterIntegrationType.Email,
    SteamfitterIntegrationType.http_get,
    SteamfitterIntegrationType.http_post,
    SteamfitterIntegrationType.http_put,
    SteamfitterIntegrationType.http_delete
  ];
  constructor(
  ) {}

}
