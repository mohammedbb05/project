import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // ✅ Afegir

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  standalone: true,
  imports: [RouterOutlet] // ✅ Important!
})

export class AppComponent {
  title = '';
}