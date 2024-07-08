import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataValueComponent } from './data-value.component';

describe('DataValueComponent', () => {
  let component: DataValueComponent;
  let fixture: ComponentFixture<DataValueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DataValueComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataValueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
