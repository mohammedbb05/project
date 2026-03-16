// src/app/components/estadistiques/estadistiques.ts
import { Component, inject, PLATFORM_ID, OnInit, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-estadistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estadistiques.html'
})
export class EstadistiquesComponent implements OnInit, AfterViewInit {

  @ViewChild('chartCategories') chartCategories!: ElementRef
  @ViewChild('chartEstats') chartEstats!: ElementRef
  @ViewChild('chartMensal') chartMensal!: ElementRef

  despeses: any[] = []
  totalGeneral = 0
  totalAprovat = 0
  totalPendent = 0
  totalDraft = 0
  perfil = ''
  nomUsuari = ''

  private platformId = inject(PLATFORM_ID)
  private despesaService = inject(DespesaService)
  public router = inject(Router)
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

    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        this.despeses = res.despeses || []
        this.calcularTotals()
        this.cdr.detectChanges()
        setTimeout(() => this.renderCharts(), 100)
      },
      error: () => {}
    })
  }

  ngAfterViewInit() {}

  calcularTotals() {
    this.totalGeneral = this.despeses.reduce((acc, d) => acc + d.importTotal, 0)
    this.totalAprovat = this.despeses
      .filter(d => d.estat === 'aprovat')
      .reduce((acc, d) => acc + d.importTotal, 0)
    this.totalPendent = this.despeses
      .filter(d => d.estat === 'pendent' || d.estat === 'draft')
      .reduce((acc, d) => acc + d.importTotal, 0)
    this.totalDraft = this.despeses.filter(d => d.estat === 'draft').length
  }

  countEstat(estat: string): number {
    return this.despeses.filter(d => d.estat === estat).length
  }

  renderCharts() {
    if (!isPlatformBrowser(this.platformId)) return
    import('chart.js/auto').then(({ default: Chart }) => {
      this.renderCategoriesChart(Chart)
      this.renderEstatsChart(Chart)
      this.renderMensalChart(Chart)
    })
  }

  renderCategoriesChart(Chart: any) {
    if (!this.chartCategories?.nativeElement) return

    const categories: any = {}
    this.despeses.forEach(d => {
      categories[d.categoria] = (categories[d.categoria] || 0) + d.importTotal
    })

    new Chart(this.chartCategories.nativeElement, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categories),
        datasets: [{
          data: Object.values(categories),
          backgroundColor: ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', padding: 16, font: { size: 12 } }
          }
        }
      }
    })
  }

  renderEstatsChart(Chart: any) {
    if (!this.chartEstats?.nativeElement) return

    const estats: any = { draft: 0, pendent: 0, aprovat: 0, rebutjat: 0 }
    this.despeses.forEach(d => {
      if (estats[d.estat] !== undefined) estats[d.estat]++
    })

    new Chart(this.chartEstats.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Draft', 'Pendent', 'Aprovat', 'Rebutjat'],
        datasets: [{
          label: 'Despeses',
          data: Object.values(estats),
          backgroundColor: ['#374151','#f59e0b','#22c55e','#ef4444'],
          borderRadius: 6,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: '#1e2130' }
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: '#1e2130' },
            beginAtZero: true
          }
        }
      }
    })
  }

  renderMensalChart(Chart: any) {
    if (!this.chartMensal?.nativeElement) return

    const mensal: any = {}
    this.despeses.forEach(d => {
      const mes = new Date(d.data).toLocaleDateString('ca', { month: 'short', year: '2-digit' })
      mensal[mes] = (mensal[mes] || 0) + d.importTotal
    })

    new Chart(this.chartMensal.nativeElement, {
      type: 'line',
      data: {
        labels: Object.keys(mensal),
        datasets: [{
          label: 'Import (€)',
          data: Object.values(mensal),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: '#1e2130' }
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: '#1e2130' },
            beginAtZero: true
          }
        }
      }
    })
  }
}