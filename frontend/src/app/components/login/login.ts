// src/app/components/login/login.ts
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DespesaService } from '../../services/despesa';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMsg = '';
  carregant = false;

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  public router = inject(Router);

  login() {
    if (!this.email || !this.password) {
      this.errorMsg = 'Omple tots els camps';
      return;
    }

    this.carregant = true;
    this.errorMsg = '';

    this.despesaService.login(this.email, this.password).subscribe({
      next: (res: any) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('perfil', res.user.perfil);
          localStorage.setItem('nom', res.user.nom);
          localStorage.setItem('userId', String(res.user.id));
          localStorage.setItem('email', res.user.email);

          // Si és primer login (mustChangePassword), redirigeix a canviar contrasenya
          if (res.user.mustChangePassword) {
            this.router.navigate(['/canviar-contrasenya'], { queryParams: { primer: true } });
          } else {
            this.router.navigate(['/despeses']);
          }
        }
        this.carregant = false;
      },
      error: (err: any) => {
        console.error('Error login:', err);
        this.errorMsg = 'Email o password incorrectes';
        this.password = '';
        this.carregant = false;
      }
    });
  }
}