// src/app/services/fulla.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FullaService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getFulles(): Observable<any> {
    return this.http.get(`${this.baseUrl}/fulla`);
  }

  getFulla(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/fulla/${id}`);
  }

  createFulla(fulla: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/fulla`, fulla);
  }

  assignarDespesa(fullaId: number, despesaId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/fulla/${fullaId}/despesa/${despesaId}`, {});
  }

  enviarFulla(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/fulla/${id}/enviar`, {});
  }

  aprovarFulla(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/fulla/${id}/aprovar`, {});
  }

  rebutjarFulla(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/fulla/${id}/rebutjar`, {});
  }

  eliminarFulla(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/fulla/${id}`);
  }
}