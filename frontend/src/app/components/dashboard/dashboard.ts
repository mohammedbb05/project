import { Component, inject, PLATFORM_ID, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DespesaService } from '../../services/despesa';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {

  despeses: any[] = [];
  tiquets: any[] = [];
  factures: any[] = [];
  loading = true;
  error = '';

  perfil = '';
  nomUsuari = '';

  pressupost = 0;
  totalGastat = 0;
  restant = 0;
  percentatge = 0;

  notificacions = 0;
  mostrarNotificacions = false;
  despesesPendents: any[] = [];

  mostrarComentari: { [key: number]: boolean } = {};
  comentariText: { [key: number]: string } = {};

  pestanya: 'tots' | 'tiquets' | 'factures' = 'tots';

  // ✅ NOU: ordenació per columna
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

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
    this.perfil = localStorage.getItem('perfil') || 'usuari';
    this.nomUsuari = localStorage.getItem('nom') || '';
    this.loadDespeses();
    this.loadPressupost();
    this.loadNotificacions();
  }

  get esValidador(): boolean {
    return this.perfil === 'validador' || this.perfil === 'admin';
  }

  get esAdmin(): boolean {
    return this.perfil === 'admin';
  }

  // ✅ NOU: getter que retorna les despeses ordenades
  get despesesMostrades(): any[] {
    let llista: any[] = [];
    if (this.pestanya === 'tiquets') llista = this.tiquets;
    else if (this.pestanya === 'factures') llista = this.factures;
    else llista = this.despeses;

    if (!this.sortColumn) return llista;

    return [...llista].sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      // Tractament especial per tipus de dades
      if (this.sortColumn === 'data' || this.sortColumn === 'createdAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else if (this.sortColumn === 'importTotal') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (this.sortColumn === 'usuari') {
        valA = a.usuari?.nom?.toLowerCase() || '';
        valB = b.usuari?.nom?.toLowerCase() || '';
      } else if (typeof valA === 'string') {
        valA = valA?.toLowerCase() || '';
        valB = valB?.toLowerCase() || '';
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // ✅ NOU: canvia columna i direcció d'ordenació
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.cdr.detectChanges();
  }

  // ✅ NOU: retorna la icona d'ordenació per a cada columna
  sortIcon(column: string): string {
    if (this.sortColumn !== column) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  loadDespeses() {
    this.loading = true;
    this.error = '';
    this.despesaService.getDespeses().subscribe({
      next: (res: any) => {
        this.despeses = [...(res.despeses || [])];
        this.tiquets = this.despeses.filter(d => d.tipusDocument === 'tiquet' || !d.tipusDocument);
        this.factures = this.despeses.filter(d => d.tipusDocument === 'factura');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('ERROR carregant despeses:', err);
        if (err.status === 401 || err.status === 403) {
          localStorage.clear();
          this.router.navigate(['/login']);
          return;
        }
        this.error = 'Error carregant despeses';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPressupost() {
    if (this.perfil !== 'usuari') return;
    this.despesaService.getPressupost().subscribe({
      next: (res: any) => {
        this.pressupost = res.pressupost;
        this.totalGastat = res.totalGastat;
        this.restant = res.restant;
        this.percentatge = res.percentatge;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
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

  toggleNotificacions() {
    this.mostrarNotificacions = !this.mostrarNotificacions;
    if (this.mostrarNotificacions) {
      this.despesesPendents = this.despeses.filter(d => d.estat === 'draft' || d.estat === 'pendent');
    }
    this.cdr.detectChanges();
  }

  toggleComentari(id: number) {
    this.mostrarComentari[id] = !this.mostrarComentari[id];
    if (!this.comentariText[id]) this.comentariText[id] = '';
    this.cdr.detectChanges();
  }

  aprovar(despesa: any) {
    this.despesaService.aprovarDespesa(despesa.id).subscribe({
      next: () => {
        despesa.estat = 'aprovat';
        this.despeses = [...this.despeses];
        this.notificacions = Math.max(0, this.notificacions - 1);
        this.mostrarNotificacions = false;
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
        this.notificacions = Math.max(0, this.notificacions - 1);
        this.mostrarNotificacions = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Error rebutjant:', err)
    });
  }

  rebutjarAmbComentari(despesa: any) {
    const comentari = this.comentariText[despesa.id] || '';
    this.despesaService.rebutjarDespesaAmbComentari(despesa.id, comentari).subscribe({
      next: () => {
        despesa.estat = 'rebutjat';
        despesa.comentari = comentari;
        this.mostrarComentari[despesa.id] = false;
        this.despeses = [...this.despeses];
        this.notificacions = Math.max(0, this.notificacions - 1);
        this.mostrarNotificacions = false;
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
          this.tiquets = this.tiquets.filter(d => d.id !== despesa.id);
          this.factures = this.factures.filter(d => d.id !== despesa.id);
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error('Error eliminant:', err)
      });
    }
  }

  exportarCSV() {
    const headers = ['Tipus', 'Proveïdor', 'Import', 'Data', 'Data Creació', 'Concepte', 'Categoria', 'Estat', 'Usuari', 'Comentari'];
    const files = this.despesesMostrades.map(d => [
      d.tipusDocument || 'tiquet',
      d.proveidor,
      d.importTotal,
      new Date(d.data).toLocaleDateString('ca'),
      d.createdAt ? new Date(d.createdAt).toLocaleString('ca') : '-',
      d.concepte,
      d.categoria,
      d.estat,
      d.usuari?.nom || '-',
      d.comentari || ''
    ]);
    const contingut = [headers, ...files]
      .map(fila => fila.map(cel => `"${cel}"`).join(','))
      .join('\n');
    const blob = new Blob([contingut], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.pestanya}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.clear();
    }
    this.router.navigate(['/login']);
  }
}