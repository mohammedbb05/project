import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Despeses } from './despeses';

describe('Despeses', () => {
  let component: Despeses;
  let fixture: ComponentFixture<Despeses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Despeses],
    }).compileComponents();

    fixture = TestBed.createComponent(Despeses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
