// src/app/components/canviar-contrasenya/canviar-contrasenya.ts
import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DespesaService } from '../../services/despesa';

@Component({
  selector: 'app-canviar-contrasenya',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canviar-contrasenya.html'
})
export class CanviarContrasenyaComponent implements OnInit {
  passwordActual = '';
  passwordNou = '';
  passwordConfirm = '';
  missatge = '';
  error = '';
  carregant = false;
  esPrimerLogin = false;

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  public router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login']); return; }

    this.route.queryParams.subscribe(params => {
      this.esPrimerLogin = params['primer'] === 'true';
    });
  }

  canviar() {
    if (!this.passwordActual || !this.passwordNou || !this.passwordConfirm) {
      this.error = 'Omple tots els camps'; return;
    }
    if (this.passwordNou !== this.passwordConfirm) {
      this.error = 'Les contrasenyes no coincideixen'; return;
    }
    if (this.passwordNou.length < 6) {
      this.error = 'La contrasenya ha de tenir mínim 6 caràcters'; return;
    }

    this.carregant = true;
    this.error = '';

    this.despesaService.canviarContrasenya(this.passwordActual, this.passwordNou).subscribe({
      next: () => {
        this.missatge = '✅ Contrasenya canviada correctament!';
        this.carregant = false;
        setTimeout(() => this.router.navigate(['/despeses']), 1500);
      },
      error: (err: any) => {
        this.error = err.error?.error || 'Error canviant la contrasenya';
        this.carregant = false;
      }
    });
  }

  tornar() {
    this.router.navigate(['/perfil']);
  }
}