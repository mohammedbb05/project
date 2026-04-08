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

  categories = ['Dietes', 'Gasolina', 'Transport', 'Parking', 'Restaurant', 'Oficina', 'Altres'];

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // ✅ Validació dies laborables
  esDiaLaboral(data: string): boolean {
    const dia = new Date(data)
    const diaSemana = dia.getDay() // 0=diumenge, 6=dissabte
    return diaSemana !== 0 && diaSemana !== 6
  }

  onDataCanvi() {
    if (this.despesa.data && !this.esDiaLaboral(this.despesa.data)) {
      this.error = '⚠️ Atenció: la data seleccionada és cap de setmana. Les despeses laborals haurien de ser en dies feiners.'
    } else {
      this.error = ''
    }
  }

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

        // ✅ Comprova si la data és cap de setmana
        if (this.despesa.data && !this.esDiaLaboral(this.despesa.data)) {
          this.error = '⚠️ Atenció: la data del tiquet és cap de setmana!'
        }

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