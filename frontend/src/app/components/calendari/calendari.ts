// src/app/components/calendari/calendari.ts
import { Component, inject, PLATFORM_ID, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-calendari',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendari.html'
})
export class CalendariComponent implements OnInit {

  despeses: any[] = []
  loading = false
  perfil = ''

  dataActual = new Date()
  anyActual = this.dataActual.getFullYear()
  mesActual = this.dataActual.getMonth() // 0-11

  diesDelMes: { dia: number | null, despeses: any[] }[] = []

  despesaSeleccionada: any = null
  mostrarModal = false

  private platformId = inject(PLATFORM_ID)
  private despesaService = inject(DespesaService)
  public router = inject(Router)
  private cdr = inject(ChangeDetectorRef)

  readonly MESOS = [
    'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
    'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
  ]

  readonly DIES = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return
    const token = localStorage.getItem('token')
    if (!token) { this.router.navigate(['/login']); return }
    this.perfil = localStorage.getItem('perfil') || ''
    this.carregarDespeses()
  }

  carregarDespeses() {
    this.loading = true
    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        this.despeses = res.despeses || []
        this.generarCalendari()
        this.loading = false
        this.cdr.detectChanges()
      },
      error: () => {
        this.loading = false
        this.cdr.detectChanges()
      }
    })
  }

  generarCalendari() {
    const primerDia = new Date(this.anyActual, this.mesActual, 1)
    const ultimDia = new Date(this.anyActual, this.mesActual + 1, 0)

    // Dilluns = 0, diumenge = 6
    let diaSemana = primerDia.getDay()
    diaSemana = diaSemana === 0 ? 6 : diaSemana - 1

    this.diesDelMes = []

    // Buits inicials
    for (let i = 0; i < diaSemana; i++) {
      this.diesDelMes.push({ dia: null, despeses: [] })
    }

    // Dies del mes
    for (let d = 1; d <= ultimDia.getDate(); d++) {
      const despesesDelDia = this.despeses.filter(dep => {
        const dataDep = new Date(dep.data)
        return dataDep.getFullYear() === this.anyActual &&
               dataDep.getMonth() === this.mesActual &&
               dataDep.getDate() === d
      })
      this.diesDelMes.push({ dia: d, despeses: despesesDelDia })
    }
  }

  mesAnterior() {
    if (this.mesActual === 0) {
      this.mesActual = 11
      this.anyActual--
    } else {
      this.mesActual--
    }
    this.generarCalendari()
    this.cdr.detectChanges()
  }

  mesSeguent() {
    if (this.mesActual === 11) {
      this.mesActual = 0
      this.anyActual++
    } else {
      this.mesActual++
    }
    this.generarCalendari()
    this.cdr.detectChanges()
  }

  avui() {
    this.anyActual = new Date().getFullYear()
    this.mesActual = new Date().getMonth()
    this.generarCalendari()
    this.cdr.detectChanges()
  }

  getColor(estat: string): string {
    switch (estat) {
      case 'draft':    return '#f59e0b'
      case 'pendent':  return '#3b82f6'
      case 'aprovat':  return '#10b981'
      case 'rebutjat': return '#ef4444'
      default:         return '#64748b'
    }
  }

  esAvui(dia: number | null): boolean {
    if (!dia) return false
    const avui = new Date()
    return dia === avui.getDate() &&
           this.mesActual === avui.getMonth() &&
           this.anyActual === avui.getFullYear()
  }

  obrirDia(cell: { dia: number | null, despeses: any[] }) {
    if (!cell.dia || cell.despeses.length === 0) return
    if (cell.despeses.length === 1) {
      this.obrirDespesa(cell.despeses[0])
    } else {
      // Si hi ha múltiples despeses, obre la primera
      this.obrirDespesa(cell.despeses[0])
    }
  }

  obrirDespesa(despesa: any) {
    this.despesaSeleccionada = despesa
    this.mostrarModal = true
    this.cdr.detectChanges()
  }

  tancarModal() {
    this.mostrarModal = false
    this.despesaSeleccionada = null
    this.cdr.detectChanges()
  }

  aprovar() {
    if (!this.despesaSeleccionada) return
    this.despesaService.aprovarDespesa(this.despesaSeleccionada.id).subscribe({
      next: () => {
        this.despesaSeleccionada.estat = 'aprovat'
        this.generarCalendari()
        this.tancarModal()
        this.carregarDespeses()
      }
    })
  }

  rebutjar() {
    if (!this.despesaSeleccionada) return
    this.despesaService.rebutjarDespesa(this.despesaSeleccionada.id).subscribe({
      next: () => {
        this.despesaSeleccionada.estat = 'rebutjat'
        this.generarCalendari()
        this.tancarModal()
        this.carregarDespeses()
      }
    })
  }

  novaDespesa() {
    this.router.navigate(['/nova-despesa'])
  }

  getTotalDespesesMes(): number {
    return this.despeses.filter(d => {
      const data = new Date(d.data)
      return data.getFullYear() === this.anyActual && data.getMonth() === this.mesActual
    }).length
  }

  getTotalImportMes(): number {
    return this.despeses
      .filter(d => {
        const data = new Date(d.data)
        return data.getFullYear() === this.anyActual && data.getMonth() === this.mesActual
      })
      .reduce((acc, d) => acc + d.importTotal, 0)
  }
}