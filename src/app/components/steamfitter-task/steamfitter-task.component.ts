// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnInit } from '@angular/core';
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
export class SteamfitterTaskComponent implements OnInit {
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
  // notification
  notificationText = '';
  // email
  fromText = '';
  toText = '';
  ccText = '';
  subjectText = '';
  messageText = '';
  accountText = '';
  mimeTypeText = '';
  // http_get, http_post, http_put, http_delete
  urlText = '';
  bodyText = '';
  headersText = '';

  constructor(
  ) {}

  ngOnInit() {
    if (!this.scenarioEvent.steamfitterTask) {
      this.scenarioEvent.steamfitterTask = {actionParameters: {
        Url: '',
        Body: '',
        Headers: '',
        From: '',
        To: '',
        cc: '',
        Subject: '',
        Message: '',
        Account: '',
        MimeType: ''
      }} as SteamfitterTask;
    }
  }

  notificationChange() {
    this.scenarioEvent.steamfitterTask.actionParameters['Url'] = 'http://localhost:4301/views/{viewId}/notifications';
    this.scenarioEvent.steamfitterTask.actionParameters['Body'] = this.notificationText;
    this.scenarioEvent.steamfitterTask.actionParameters['Headers'] = '';
  }

}
