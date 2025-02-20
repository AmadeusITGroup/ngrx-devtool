import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgrxDevtoolComponent } from './ngrx-devtool.component';

describe('NgrxDevtoolComponent', () => {
  let component: NgrxDevtoolComponent;
  let fixture: ComponentFixture<NgrxDevtoolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgrxDevtoolComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgrxDevtoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
