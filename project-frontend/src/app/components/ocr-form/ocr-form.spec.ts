import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcrForm } from './ocr-form';

describe('OcrForm', () => {
  let component: OcrForm;
  let fixture: ComponentFixture<OcrForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OcrForm],
    }).compileComponents();

    fixture = TestBed.createComponent(OcrForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
