// src/app/components/admin/admin.ts
import { Component, inject, PLATFORM_ID, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html'
})
export class AdminComponent implements OnInit {

  usuaris: any[] = []
  loading = false
  missatge = ''
  error = ''
  editantId: number | null = null
  nouPressupost = 0

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

    const perfil = localStorage.getItem('perfil')
    if (perfil !== 'admin' && perfil !== 'validador') {
       this.router.navigate(['/despeses'])
       return
    }

    this.loadUsuaris()
  }

  loadUsuaris() {
    this.loading = true
    this.despesaService.getUsuaris().subscribe({
      next: (res: any) => {
        this.usuaris = res.usuaris || []
        this.loading = false
        this.cdr.detectChanges()
      },
      error: () => {
        this.error = 'Error carregant usuaris'
        this.loading = false
        this.cdr.detectChanges()
      }
    })
  }

  editarPressupost(usuari: any) {
    this.editantId = usuari.id
    this.nouPressupost = usuari.pressupost || 1000
    this.cdr.detectChanges()
  }

  guardarPressupost(usuariId: number) {
    this.despesaService.updatePressupost(usuariId, this.nouPressupost).subscribe({
      next: (res: any) => {
        const usuari = this.usuaris.find(u => u.id === usuariId)
        if (usuari) usuari.pressupost = this.nouPressupost
        this.editantId = null
        this.missatge = '✅ Pressupost actualitzat!'
        this.usuaris = [...this.usuaris]
        this.cdr.detectChanges()
        setTimeout(() => { this.missatge = ''; this.cdr.detectChanges() }, 3000)
      },
      error: () => {
        this.error = 'Error actualitzant pressupost'
        this.cdr.detectChanges()
      }
    })
  }

  cancelarEdicio() {
    this.editantId = null
    this.cdr.detectChanges()
  }
}