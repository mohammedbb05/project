import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Fulles } from './fulles';

describe('Fulles', () => {
  let component: Fulles;
  let fixture: ComponentFixture<Fulles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Fulles],
    }).compileComponents();

    fixture = TestBed.createComponent(Fulles);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
