import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-data-value',
  templateUrl: './data-value.component.html',
  styleUrls: ['./data-value.component.scss']
})
export class DataValueComponent {
  @Input() value: any;
  @Output() valueChange = new EventEmitter<any>();

  valueChangeHandler() {
    this.valueChange.emit(this.value);
  }

}
