// src/app/components/fulles/fulles.ts
import { Component, inject, PLATFORM_ID, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FullaService } from '../../services/fulla.service';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-fulles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fulles.html',
  styleUrls: ['./fulles.css']
})
export class FullesComponent implements OnInit {

  fulles: any[] = [];
  despesesSenseAssignar: any[] = [];
  loading = false;
  error = '';
  missatge = '';
  perfil = '';
  nomUsuari = '';

  // Formulari nova fulla
  mostrarFormulari = false;
  novaFulla = { titol: '', mes: '', any: new Date().getFullYear() }
  mesos = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
           'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre']

  // Fulla seleccionada per veure detall
  fullaSeleccionada: any = null

  private platformId = inject(PLATFORM_ID)
  private fullaService = inject(FullaService)
  private despesaService = inject(DespesaService)
  public  router = inject(Router)
  private cdr = inject(ChangeDetectorRef)

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return

    const token = localStorage.getItem('token')
    if (!token) {
      this.router.navigate(['/login'])
      return
    }

    this.perfil = localStorage.getItem('perfil') || 'usuari'
    this.nomUsuari = localStorage.getItem('nom') || ''

    this.loadFulles()
    this.loadDespesesSenseAssignar()
  }

  get esValidador(): boolean {
    return this.perfil === 'validador' || this.perfil === 'admin'
  }

  loadFulles() {
    this.loading = true
    this.fullaService.getFulles().subscribe({
      next: (res: any) => {
        this.fulles = res.fulles || []
        this.loading = false
        this.cdr.detectChanges()
      },
      error: (err: any) => {
        this.error = 'Error carregant fulles'
        this.loading = false
        this.cdr.detectChanges()
      }
    })
  }

  loadDespesesSenseAssignar() {
    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        // ✅ Només despeses sense fulla assignada
        this.despesesSenseAssignar = (res.despeses || []).filter((d: any) => !d.fullaId)
        this.cdr.detectChanges()
      },
      error: () => {}
    })
  }

  crearFulla() {
    if (!this.novaFulla.titol || !this.novaFulla.mes) {
      this.error = 'Cal posar títol i mes'
      return
    }

    this.fullaService.createFulla(this.novaFulla).subscribe({
      next: () => {
        this.missatge = '✅ Fulla creada!'
        this.mostrarFormulari = false
        this.novaFulla = { titol: '', mes: '', any: new Date().getFullYear() }
        this.loadFulles()
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error creant fulla'
        this.cdr.detectChanges()
      }
    })
  }

  veureFulla(fulla: any) {
    this.fullaSeleccionada = fulla
    this.cdr.detectChanges()
  }

  tancarDetall() {
    this.fullaSeleccionada = null
    this.loadFulles()
    this.loadDespesesSenseAssignar()
    this.cdr.detectChanges()
  }

  assignarDespesa(despesaId: number) {
    if (!this.fullaSeleccionada) return

    this.fullaService.assignarDespesa(this.fullaSeleccionada.id, despesaId).subscribe({
      next: () => {
        this.missatge = '✅ Despesa assignada!'
        // Refresca fulla seleccionada
        this.fullaService.getFulla(this.fullaSeleccionada.id).subscribe({
          next: (res: any) => {
            this.fullaSeleccionada = res.fulla
            this.loadDespesesSenseAssignar()
            this.cdr.detectChanges()
          }
        })
      },
      error: () => {
        this.error = 'Error assignant despesa'
        this.cdr.detectChanges()
      }
    })
  }

  enviarFulla(fulla: any) {
    this.fullaService.enviarFulla(fulla.id).subscribe({
      next: () => {
        this.missatge = '✅ Fulla enviada a aprovació!'
        fulla.estat = 'pendent'
        this.fulles = [...this.fulles]
        if (this.fullaSeleccionada?.id === fulla.id) {
          this.fullaSeleccionada.estat = 'pendent'
        }
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error enviant fulla'
        this.cdr.detectChanges()
      }
    })
  }

  aprovarFulla(fulla: any) {
    this.fullaService.aprovarFulla(fulla.id).subscribe({
      next: () => {
        this.missatge = '✅ Fulla aprovada!'
        fulla.estat = 'aprovat'
        this.fulles = [...this.fulles]
        if (this.fullaSeleccionada?.id === fulla.id) {
          this.fullaSeleccionada.estat = 'aprovat'
        }
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error aprovant fulla'
        this.cdr.detectChanges()
      }
    })
  }

  rebutjarFulla(fulla: any) {
    this.fullaService.rebutjarFulla(fulla.id).subscribe({
      next: () => {
        this.missatge = '✅ Fulla rebutjada'
        fulla.estat = 'rebutjat'
        this.fulles = [...this.fulles]
        if (this.fullaSeleccionada?.id === fulla.id) {
          this.fullaSeleccionada.estat = 'rebutjat'
        }
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error rebutjant fulla'
        this.cdr.detectChanges()
      }
    })
  }

  eliminarFulla(fulla: any) {
    if (!confirm('Segur que vols eliminar aquesta fulla?')) return

    this.fullaService.eliminarFulla(fulla.id).subscribe({
      next: () => {
        this.missatge = '✅ Fulla eliminada'
        this.fulles = this.fulles.filter(f => f.id !== fulla.id)
        if (this.fullaSeleccionada?.id === fulla.id) {
          this.fullaSeleccionada = null
        }
        this.loadDespesesSenseAssignar()
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error eliminant fulla'
        this.cdr.detectChanges()
      }
    })
  }

  getTotal(despeses: any[]): number {
    return despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
  }

  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('perfil')
    localStorage.removeItem('nom')
    this.router.navigate(['/login'])
  }
}