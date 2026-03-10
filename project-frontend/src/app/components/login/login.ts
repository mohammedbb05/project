import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DespesaService } from '../../services/despesa';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // CommonModule necessari per ngModel
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  email = '';
  password = '';

  constructor(private despesaService: DespesaService, private router: Router) {}

  login() {
    this.despesaService.login(this.email, this.password).subscribe({
      next: (res: any) => {
        if (res && res.token) {
          localStorage.setItem('token', res.token); // Guardem token
          this.router.navigate(['/despeses']);     // Redirigim al Dashboard
        } else {
          alert("Login incorrecte: resposta inesperada del servidor");
        }
      },
      error: (err: any) => {
        console.error("Error al login:", err);
        alert("Login incorrecte");
      }
    });
  }
}