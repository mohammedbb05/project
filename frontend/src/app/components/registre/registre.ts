// src/app/components/register/register.ts
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DespesaService } from '../../services/despesa';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registre.html',
styleUrls: ['./registre.css']
})
export class RegisterComponent {
  nom = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMsg = '';
  loading = false;

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  public router = inject(Router);

  register() {
    if (!this.nom || !this.email || !this.password) {
      this.errorMsg = 'Tots els camps són obligatoris';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Les contrasenyes no coincideixen';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    this.despesaService.register(this.nom, this.email, this.password).subscribe({
      next: (res: any) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('perfil', res.user.perfil);
          localStorage.setItem('nom', res.user.nom);
        }
        this.router.navigate(['/despeses']);
      },
      error: (err: any) => {
        console.error('Error registre:', err);
        this.errorMsg = err.error?.error || 'Error al registrar-se';
        this.loading = false;
      }
    });
  }
}