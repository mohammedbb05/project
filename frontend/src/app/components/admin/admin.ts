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

  // Pressupost
  editantPressupostId: number | null = null
  nouPressupost = 0

  // Crear usuari
  mostrarCrear = false
  nouUsuari = { nom: '', email: '', password: '', perfil: 'usuari' }
  creantUsuari = false

  // Editar usuari
  mostrarEditar = false
  usuariEditat: any = null
  editantUsuari = false

  // Eliminar
  eliminantId: number | null = null

  private platformId = inject(PLATFORM_ID)
  private despesaService = inject(DespesaService)
  public router = inject(Router)
  private cdr = inject(ChangeDetectorRef)

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return
    const token = localStorage.getItem('token')
    if (!token) { this.router.navigate(['/login']); return }
    const perfil = localStorage.getItem('perfil')
    if (perfil !== 'admin' && perfil !== 'validador') {
      this.router.navigate(['/despeses']); return
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

  // ── Pressupost ──
  editarPressupost(usuari: any) {
    this.editantPressupostId = usuari.id
    this.nouPressupost = usuari.pressupost || 1000
    this.cdr.detectChanges()
  }

  guardarPressupost(usuariId: number) {
    this.despesaService.updatePressupost(usuariId, this.nouPressupost).subscribe({
      next: () => {
        const u = this.usuaris.find(u => u.id === usuariId)
        if (u) u.pressupost = this.nouPressupost
        this.editantPressupostId = null
        this.mostrarMissatgeOk('✅ Pressupost actualitzat!')
        this.usuaris = [...this.usuaris]
        this.cdr.detectChanges()
      },
      error: () => { this.error = 'Error actualitzant pressupost'; this.cdr.detectChanges() }
    })
  }

  cancelarPressupost() {
    this.editantPressupostId = null
    this.cdr.detectChanges()
  }

  // ── Crear usuari ──
  obrirCrear() {
    this.mostrarCrear = true
    this.nouUsuari = { nom: '', email: '', password: '', perfil: 'usuari' }
    this.error = ''
    this.cdr.detectChanges()
  }

  tancarCrear() {
    this.mostrarCrear = false
    this.error = ''
    this.cdr.detectChanges()
  }

  crearUsuari() {
    if (!this.nouUsuari.nom || !this.nouUsuari.email || !this.nouUsuari.password) {
      this.error = 'Tots els camps són obligatoris'; this.cdr.detectChanges(); return
    }
    this.creantUsuari = true
    this.error = ''
    this.despesaService.crearUsuari(this.nouUsuari).subscribe({
      next: (res: any) => {
        this.usuaris = [...this.usuaris, { ...res.user, pressupost: 1000 }]
        this.mostrarCrear = false
        this.creantUsuari = false
        this.mostrarMissatgeOk(`✅ Usuari "${res.user.nom}" creat! Contrasenya temporal: ${this.nouUsuari.password}`)
        this.cdr.detectChanges()
      },
      error: (err: any) => {
        this.error = err.error?.error || 'Error creant usuari'
        this.creantUsuari = false
        this.cdr.detectChanges()
      }
    })
  }

  // ── Editar usuari ──
  obrirEditar(usuari: any) {
    this.usuariEditat = { ...usuari, passwordNou: '' }
    this.mostrarEditar = true
    this.error = ''
    this.cdr.detectChanges()
  }

  tancarEditar() {
    this.mostrarEditar = false
    this.usuariEditat = null
    this.error = ''
    this.cdr.detectChanges()
  }

  guardarEdicio() {
    if (!this.usuariEditat.nom || !this.usuariEditat.email) {
      this.error = 'Nom i email són obligatoris'; this.cdr.detectChanges(); return
    }
    this.editantUsuari = true
    this.error = ''
    const data: any = {
      nom: this.usuariEditat.nom,
      email: this.usuariEditat.email,
      perfil: this.usuariEditat.perfil
    }
    if (this.usuariEditat.passwordNou) data.password = this.usuariEditat.passwordNou
    this.despesaService.updateUsuari(this.usuariEditat.id, data).subscribe({
      next: (res: any) => {
        const idx = this.usuaris.findIndex(u => u.id === this.usuariEditat.id)
        if (idx !== -1) this.usuaris[idx] = { ...this.usuaris[idx], ...res.usuari }
        this.usuaris = [...this.usuaris]
        this.mostrarEditar = false
        this.editantUsuari = false
        this.mostrarMissatgeOk('✅ Usuari actualitzat!')
        this.cdr.detectChanges()
      },
      error: (err: any) => {
        this.error = err.error?.error || 'Error actualitzant usuari'
        this.editantUsuari = false
        this.cdr.detectChanges()
      }
    })
  }

  // ── Eliminar usuari ──
  eliminarUsuari(id: number) {
    if (!confirm('Segur que vols eliminar aquest usuari?')) return
    this.eliminantId = id
    this.despesaService.deleteUsuari(id).subscribe({
      next: () => {
        this.usuaris = this.usuaris.filter(u => u.id !== id)
        this.eliminantId = null
        this.mostrarMissatgeOk('✅ Usuari eliminat!')
        this.cdr.detectChanges()
      },
      error: (err: any) => {
        this.error = err.error?.error || 'Error eliminant usuari'
        this.eliminantId = null
        this.cdr.detectChanges()
      }
    })
  }

  mostrarMissatgeOk(msg: string) {
    this.missatge = msg
    this.cdr.detectChanges()
    setTimeout(() => { this.missatge = ''; this.cdr.detectChanges() }, 5000)
  }

  getPerfil(): string {
    return localStorage.getItem('perfil') || ''
  }
}