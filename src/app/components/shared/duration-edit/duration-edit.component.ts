// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';


@Component({
  selector: 'app-duration-edit',
  templateUrl: './duration-edit.component.html',
  styleUrls: ['./duration-edit.component.scss'],
})
export class DurationEditComponent implements OnChanges {
  @Input() startTime: Date;
  @Input()
  get durationSeconds() {
    return this.durationSecondsValue;
  }
  set durationSeconds(value) {
    this.durationSecondsValue = value;
    this.sign = value < 0 ? -1 : 1;
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
  sign = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (this.startTime && this.durationSeconds) {
      this.endTimeFormControl.setValue(
        this.getDateFromDurationSeconds(this.durationSeconds)
      );
      this.setDeltaValues();
    }
  }

  getDateFromDurationSeconds(durationSeconds: number): Date {
    const startTime = new Date(this.startTime);
    return new Date(startTime.getTime() + durationSeconds * 1000);
  }

  getDurationSecondsFromDate() {
    const endTimeValue = this.endTimeFormControl.value;
    const endTimeSeconds = endTimeValue.getTime() / 1000;
    const startValue = new Date(this.startTime);
    const startSeconds = startValue.getTime() / 1000;
    return endTimeSeconds - startSeconds;
  }

  setDeltaValues() {
    let durationSeconds = Math.abs(this.durationSeconds);
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
    return (
      this.sign *
      (this.days * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds)
    );
  }

  deltaUpdated(event: any, whichValue: string) {
    let setValue = +event.target.value;
    switch (whichValue) {
      case 'd':
        if (setValue < 0) {
          setValue = 0;
        }
        this.days = setValue;
        break;
      case 'h':
        if (setValue < 0) {
          if (this.days > 0) {
            this.days -= 1;
            setValue = 23;
          } else {
            setValue = 0;
          }
        } else if (setValue > 23) {
          this.days += 1;
          setValue = 0;
        }
        this.hours = setValue;
        break;
      case 'm':
        if (setValue < 0) {
          if (this.hours > 0) {
            this.hours -= 1;
            setValue = 59;
          } else {
            if (this.days > 0) {
              this.days -= 1;
              this.hours = 23;
              setValue = 59;
            } else {
              setValue = 0;
            }
          }
        } else if (setValue > 59) {
          if (this.hours === 23) {
            this.days += 1;
            this.hours = 0;
            setValue = 0;
          } else {
            this.hours += 1;
            setValue = 0;
          }
        }
        this.minutes = setValue;
        break;
      case 's':
        if (setValue < 0) {
          if (this.minutes > 0) {
            this.minutes -= 1;
            setValue = 59;
          } else {
            if (this.hours > 0) {
              this.hours -= 1;
              this.minutes = 59;
              setValue = 59;
            } else {
              if (this.days > 0) {
                this.days -= 1;
                this.hours = 23;
                this.minutes = 59;
                setValue = 59;
              } else {
                setValue = 0;
              }
            }
          }
        } else if (setValue > 59) {
          if (this.minutes === 59) {
            if (this.hours === 23) {
              this.days += 1;
              this.hours = 0;
              this.minutes = 0;
              setValue = 0;
            } else {
              this.hours += 1;
              this.minutes = 0;
              setValue = 0;
            }
          } else {
            this.minutes += 1;
            setValue = 0;
          }
        }
        this.seconds = setValue;
        break;
    }
    event.target.value = setValue < 10 ? '0' + setValue : setValue;
    this.durationSeconds = this.calculateDurationSeconds();
    this.change.emit(this.durationSeconds);
    this.endTimeFormControl.setValue(
      this.getDateFromDurationSeconds(this.durationSeconds)
    );
  }

  timeUpdated() {
    this.durationSeconds = this.getDurationSecondsFromDate();
    this.change.emit(this.durationSeconds);
    this.setDeltaValues();
  }

  changeSign() {
    this.durationSeconds = -this.durationSeconds;
    this.sign = -this.sign;
  }

  hasStartTime(): boolean {
    return this.startTime && this.startTime.valueOf() > 0;
  }
}
