// src/app/components/dashboard/dashboard.ts
import { Component, inject, PLATFORM_ID, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DespesaService } from '../../services/despesa';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {

  despeses: any[] = [];
  loading = true;
  error = '';

  // ✅ Rols
  perfil = '';
  nomUsuari = '';

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  private cdr = inject(ChangeDetectorRef);
  public router = inject(Router);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    // ✅ Carrega perfil i nom
    this.perfil = localStorage.getItem('perfil') || 'usuari';
    this.nomUsuari = localStorage.getItem('nom') || '';

    this.loadDespeses();
  }

  // ✅ Getters de rol
  get esValidador(): boolean {
    return this.perfil === 'validador' || this.perfil === 'admin';
  }

  get esAdmin(): boolean {
    return this.perfil === 'admin';
  }

  loadDespeses() {
    this.loading = true;
    this.error = '';

    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        this.despeses = [...(res.despeses || [])];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('ERROR carregant despeses:', err);

        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('perfil');
          localStorage.removeItem('nom');
          this.router.navigate(['/login']);
          return;
        }

        this.error = 'Error carregant despeses';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  aprovar(despesa: any) {
    this.despesaService.aprovarDespesa(despesa.id).subscribe({
      next: () => {
        despesa.estat = 'aprovat';
        this.despeses = [...this.despeses];
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Error aprovant:', err)
    });
  }

  rebutjar(despesa: any) {
    this.despesaService.rebutjarDespesa(despesa.id).subscribe({
      next: () => {
        despesa.estat = 'rebutjat';
        this.despeses = [...this.despeses];
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Error rebutjant:', err)
    });
  }

  eliminar(despesa: any) {
    if (!isPlatformBrowser(this.platformId)) return;

    if (confirm('Segur que vols eliminar aquesta despesa?')) {
      this.despesaService.deleteDespesa(despesa.id).subscribe({
        next: () => {
          this.despeses = this.despeses.filter(d => d.id !== despesa.id);
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error('Error eliminant:', err)
      });
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('perfil');
      localStorage.removeItem('nom');
    }
    this.router.navigate(['/login']);
  }
}