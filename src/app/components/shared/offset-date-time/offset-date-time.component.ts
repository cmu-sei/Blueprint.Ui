// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';


@Component({
  selector: 'app-offset-date-time',
  templateUrl: './offset-date-time.component.html',
  styleUrls: ['./offset-date-time.component.scss']
})
export class OffsetDateTimeComponent implements OnChanges {
  @Input() startTime: Date;
  @Input()
  get durationSeconds() {
    return this.durationSecondsValue;
  }
  set durationSeconds(value) {
    this.durationSecondsValue = value;
    this.durationSecondsChange.emit(this.durationSecondsValue);
  }
  @Input() timeName: string;
  @Input() postScript: string;
  @Output() durationSecondsChange = new EventEmitter<number>();
  @Output() change = new EventEmitter<number>();
  durationSecondsValue: number;
  endTimeFormControl = new UntypedFormControl();
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (this.startTime && this.durationSeconds) {
      this.endTimeFormControl.setValue(this.getDateFromDurationSeconds(this.durationSeconds));
      this.setDeltaValues();
    }
  }

  getDateFromDurationSeconds(durationSeconds: number): Date {
    const startTime = new Date(this.startTime);
    return new Date(startTime.getTime() + (durationSeconds * 1000));
  }

  getDurationSecondsFromDate() {
    const endTimeValue = this.endTimeFormControl.value;
    const endTimeSeconds = endTimeValue.getTime() / 1000;
    const startValue = new Date(this.startTime);
    const startSeconds = startValue.getTime() / 1000;
    return endTimeSeconds - startSeconds;
  }

  setDeltaValues() {
    let durationSeconds = this.durationSeconds;
    // get the number of days
    this.days = Math.floor(durationSeconds / 86400);
    durationSeconds = durationSeconds % 86400;
    // get the number of hours
    this.hours = Math.floor(durationSeconds / 3600);
    durationSeconds = durationSeconds % 3600;
    // get the number of minutes
    this.minutes = Math.floor(durationSeconds / 60);
    durationSeconds = durationSeconds % 60;
    // get the number of seconds
    this.seconds = +durationSeconds;
  }

  calculateDurationSeconds() {
    return this.days * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds;
  }

  deltaUpdated(event: any, whichValue: string) {
    let setValue = +event.target.value;
    switch (whichValue) {
      case 'd':
        setValue = setValue < 0 ? 0 : setValue;
        this.days = setValue;
        break;
      case 'h':
        setValue = setValue < 0 ? 0 : setValue > 23 ? 23 : setValue;
        this.hours = setValue;
        break;
      case 'm':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.minutes = setValue;
        break;
      case 's':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.seconds = setValue;
        break;
    }
    this.durationSeconds = this.calculateDurationSeconds();
    this.change.emit(this.durationSeconds);
    this.endTimeFormControl.setValue(this.getDateFromDurationSeconds(this.durationSeconds));
  }

  timeUpdated() {
    this.durationSeconds = this.getDurationSecondsFromDate();
    this.change.emit(this.durationSeconds);
    this.setDeltaValues();
  }



}
