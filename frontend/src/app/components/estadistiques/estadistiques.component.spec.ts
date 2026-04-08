import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Estadistiques } from './estadistiques';

describe('Estadistiques', () => {
  let component: Estadistiques;
  let fixture: ComponentFixture<Estadistiques>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Estadistiques],
    }).compileComponents();

    fixture = TestBed.createComponent(Estadistiques);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
