import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InjectPageComponent } from './inject-page.component';

describe('InjectPageComponent', () => {
  let component: InjectPageComponent;
  let fixture: ComponentFixture<InjectPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InjectPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InjectPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
