// src/app/components/ocr-form/ocr-form.ts
import { Component, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-ocr-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr-form.html',
  styleUrls: ['./ocr-form.css']
})
export class OcrFormComponent {
  // Estats
  loading = false;
  loadingOcr = false;
  missatge = '';
  error = '';
  imatgePreview: string | null = null;
  fitxerSeleccionat: File | null = null;

  // Dades del formulari
  despesa = {
    proveidor: '',
    cif: '',
    importTotal: 0,
    iva: null as number | null,
    baseImposable: null as number | null,
    data: '',
    concepte: '',
    categoria: 'Altres',
    urlImatge: ''
  };

  categories = ['Dietes', 'Gasolina', 'Transport', 'Parking', 'Oficina', 'Altres'];

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Quan l'usuari selecciona una imatge
  onFitxerSeleccionat(event: any) {
    const fitxer = event.target.files[0];
    if (!fitxer) return;

    this.fitxerSeleccionat = fitxer;

    // Previsualització
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imatgePreview = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(fitxer);
  }

  // Enviar imatge a OCR
  analitzarImatge() {
    if (!this.fitxerSeleccionat) {
      this.error = 'Selecciona una imatge primer';
      return;
    }

    this.loadingOcr = true;
    this.error = '';
    this.missatge = '';

    this.despesaService.ocrDespesa(this.fitxerSeleccionat).subscribe({
      next: (res: any) => {
        // ✅ Omple el formulari amb les dades de la IA
        const d = res.dades;
        this.despesa.proveidor = d.proveidor || '';
        this.despesa.cif = d.cif || '';
        this.despesa.importTotal = d.importTotal || 0;
        this.despesa.iva = d.iva || null;
        this.despesa.baseImposable = d.baseImposable || null;
        this.despesa.data = d.data || '';
        this.despesa.concepte = d.concepte || '';
        this.despesa.categoria = d.categoria || 'Altres';
        this.despesa.urlImatge = res.urlImatge || '';

        this.loadingOcr = false;
        this.missatge = '✅ Dades extretes! Revisa i confirma.';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error OCR:', err);
        this.error = 'Error processant la imatge. Torna-ho a intentar.';
        this.loadingOcr = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Guardar la despesa
  guardarDespesa() {
    if (!this.despesa.proveidor || !this.despesa.importTotal || !this.despesa.data || !this.despesa.concepte) {
      this.error = 'Falten camps obligatoris: Proveïdor, Import, Data i Concepte';
      return;
    }

    this.loading = true;
    this.error = '';

    this.despesaService.createDespesa(this.despesa).subscribe({
      next: () => {
        this.missatge = '✅ Despesa guardada correctament!';
        this.loading = false;
        this.cdr.detectChanges();
        // Redirigeix al dashboard després de 1.5s
        setTimeout(() => this.router.navigate(['/despeses']), 1500);
      },
      error: (err: any) => {
        console.error('Error guardant:', err);
        this.error = 'Error guardant la despesa';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  tornar() {
    this.router.navigate(['/despeses']);
  }
}