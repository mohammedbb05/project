import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DespesaService {
  private baseUrl = 'http://localhost:3000';
  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, { email, password });
  }
  getDespeses(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa`);
  }
  getTiquets(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa?tipus=tiquet`);
  }
  getFactures(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa?tipus=factura`);
  }
  createDespesa(despesa: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa`, despesa);
  }
  updateDespesa(id: number, despesa: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/despesa/${id}`, despesa);
  }
  deleteDespesa(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/despesa/${id}`);
  }
  ocrDespesa(fitxer: File): Observable<any> {
    const formData = new FormData();
    formData.append('imatge', fitxer);
    return this.http.post(`${this.baseUrl}/ocr`, formData);
  }
  private getHeaders(): Record<string, string> | undefined {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }
  crearUsuari(data: { nom: string; email: string; password: string; perfil: string }): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post(`${this.baseUrl}/users`, data, { headers });
  }
  register(nom: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, { nom, email, password, perfil: 'usuari' });
  }
  aprovarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/aprovar`, {});
  }
  rebutjarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, {});
  }
  rebutjarDespesaAmbComentari(id: number, comentari: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, { comentari });
  }
  getPressupost(): Observable<any> {
    return this.http.get(`${this.baseUrl}/pressupost`);
  }
  getUsuaris(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users`);
  }
  updatePressupost(userId: number, pressupost: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/pressupost/${userId}`, { pressupost });
  }
  getNotificacions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notificacions`);
  }
  
  
}