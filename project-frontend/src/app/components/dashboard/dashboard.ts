import { Component } from '@angular/core';
import { DespesaService } from '../../services/despesa';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  despeses: any[] = [];

  constructor(private despesaService: DespesaService) {}

  ngOnInit() {
    this.loadDespeses();
  }

  loadDespeses() {
    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        // property name fixes
        this.despeses = res.despeses;
      },
      error: (err: any) => {
        console.error(err);
        alert('Error carregant despeses');
      }
    });
  }

  aprovar(despesa: any) {
    this.despesaService.aprovarDespesa(despesa.id).subscribe(() => {
      this.loadDespeses();
    });
  }

  rebutjar(despesa: any) {
    this.despesaService.rebutjarDespesa(despesa.id).subscribe(() => {
      this.loadDespeses();
    });
  }

  eliminar(despesa: any) {
    if (confirm('Segur que vols eliminar aquesta despesa?')) {
      this.despesaService.deleteDespesa(despesa.id).subscribe(() => {
        this.loadDespeses();
      });
    }
  }
}