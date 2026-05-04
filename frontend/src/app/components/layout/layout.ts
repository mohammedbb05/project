import { Component, inject, PLATFORM_ID, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit {
  perfil = '';
  nomUsuari = '';

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  private cdr = inject(ChangeDetectorRef);
  public router = inject(Router);

  notificacions = 0;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login']); return; }
    this.perfil = localStorage.getItem('perfil') || 'usuari';
    this.nomUsuari = localStorage.getItem('nom') || '';
    this.loadNotificacions();
  }

  get esValidador(): boolean {
    return this.perfil === 'validador' || this.perfil === 'admin';
  }

  loadNotificacions() {
    if (!this.esValidador) return;
    this.despesaService.getNotificacions().subscribe({
      next: (res: any) => {
        this.notificacions = res.count;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) localStorage.clear();
    this.router.navigate(['/login']);
  }
}
