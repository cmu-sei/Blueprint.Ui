import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MselPlaybookComponent } from './msel-playbook.component';

describe('MselPlaybookComponent', () => {
  let component: MselPlaybookComponent;
  let fixture: ComponentFixture<MselPlaybookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MselPlaybookComponent ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MselPlaybookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
