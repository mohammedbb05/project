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

  private platformId = inject(PLATFORM_ID);
  private despesaService = inject(DespesaService);
  public router = inject(Router);

  login() {
    this.despesaService.login(this.email, this.password).subscribe({
      next: (res: any) => {
        if (isPlatformBrowser(this.platformId)) {
          // ✅ Guarda token + perfil + nom
          localStorage.setItem('token', res.token);
          localStorage.setItem('perfil', res.user.perfil);
          localStorage.setItem('nom', res.user.nom);
          console.log('TOKEN GUARDAT:', res.token);
          console.log('PERFIL:', res.user.perfil);
        }
        this.router.navigate(['/despeses']);
      },
      error: (err: any) => {
        console.error('Error login:', err);
        this.errorMsg = 'Email o password incorrectes';
        this.password = '';
      }
    });
  }
}