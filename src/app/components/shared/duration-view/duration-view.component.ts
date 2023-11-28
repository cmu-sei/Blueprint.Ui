import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-duration-view',
  templateUrl: './duration-view.component.html',
  styleUrls: ['./duration-view.component.scss']
})
export class DurationViewComponent {
  @Input() startTime: Date;
  @Input() durationSeconds: number;
  @Input() showRealTime: boolean;

  getDeltaTime(deltaSeconds: number) {
    // <span *ngIf="item.deltaSeconds > 86400">{{ getDays(item.deltaSeconds) }} </span>{{ item.deltaSeconds * 1000 | date:'hh:mm:ss' }}
    let timeString = '';
    // get the number of days
    if (deltaSeconds > 86400) {
      const days = Math.floor(deltaSeconds / 86400);
      deltaSeconds = deltaSeconds % 86400;
      timeString = days + ' ';
    }
    // get the number of hours
    const hours = Math.floor(deltaSeconds / 3600);
    if (hours < 10) {
      timeString = timeString + '0' + hours + ':';
    } else {
      timeString = timeString + hours + ':';
    }
    deltaSeconds = deltaSeconds % 3600;
    // get the number of minutes
    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 10) {
      timeString = timeString + '0' + minutes + ':';
    } else {
      timeString = timeString + minutes + ':';
    }
    // get the number of seconds
    const seconds = deltaSeconds % 60;
    if (seconds < 10) {
      timeString = timeString + '0' + seconds;
    } else {
      timeString = timeString + seconds;
    }
    return timeString;
  }

  getDate(deltaSeconds: number) {
    const startDate = new Date(this.startTime);
    const scenarioEventDate = new Date(startDate.getTime() + deltaSeconds * 1000);
    return scenarioEventDate.toLocaleString();
  }

}
