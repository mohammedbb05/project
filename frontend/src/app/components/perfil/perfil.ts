// src/app/components/perfil/perfil.ts
import { Component, inject, PLATFORM_ID, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html'
})
export class PerfilComponent implements OnInit {
  perfil = '';
  nom = '';
  email = '';
  userId = 0;

  // Editar dades
  editantDades = false;
  nomEditat = '';
  emailEditat = '';
  guardantDades = false;

  // Stats
  totalDespeses = 0;
  pressupost = 0;
  totalGastat = 0;
  percentatge = 0;

  missatge = '';
  error = '';

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  public router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login']); return; }

    this.perfil = localStorage.getItem('perfil') || '';
    this.nom = localStorage.getItem('nom') || '';
    this.email = localStorage.getItem('email') || '';
    this.userId = parseInt(localStorage.getItem('userId') || '0');

    this.nomEditat = this.nom;
    this.emailEditat = this.email;

    // Carregar stats si és usuari normal
    if (this.perfil === 'usuari') {
      this.despesaService.getPressupost().subscribe({
        next: (res: any) => {
          this.pressupost = res.pressupost;
          this.totalGastat = res.totalGastat;
          this.percentatge = res.percentatge;
          this.cdr.detectChanges();
        }
      });

      this.despesaService.getDespeses().subscribe({
        next: (res: any) => {
          this.totalDespeses = res.despeses?.length || 0;
          this.cdr.detectChanges();
        }
      });
    }
  }

  editarDades() {
    this.editantDades = true;
    this.nomEditat = this.nom;
    this.emailEditat = this.email;
    this.cdr.detectChanges();
  }

  guardarDades() {
    if (!this.nomEditat || !this.emailEditat) {
      this.error = 'El nom i email són obligatoris'; return;
    }
    this.guardantDades = true;
    this.error = '';

    this.despesaService.updatePerfil({ nom: this.nomEditat, email: this.emailEditat }).subscribe({
      next: (res: any) => {
        this.nom = this.nomEditat;
        this.email = this.emailEditat;
        localStorage.setItem('nom', this.nom);
        localStorage.setItem('email', this.email);
        this.editantDades = false;
        this.guardantDades = false;
        this.missatge = '✅ Dades actualitzades!';
        this.cdr.detectChanges();
        setTimeout(() => { this.missatge = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err: any) => {
        this.error = err.error?.error || 'Error actualitzant dades';
        this.guardantDades = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelarEdicio() {
    this.editantDades = false;
    this.error = '';
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  getBadgeColor(): string {
    if (this.perfil === 'admin') return '#ef4444';
    if (this.perfil === 'validador') return '#f59e0b';
    return '#3b82f6';
  }
}