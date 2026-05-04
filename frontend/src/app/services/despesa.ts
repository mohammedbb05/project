import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DespesaService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // ── AUTH ──
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, { email, password });
  }

  register(nom: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, { nom, email, password, perfil: 'usuari' });
  }

  // ── PERFIL ──
  canviarContrasenya(passwordActual: string, passwordNou: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/perfil/contrasenya`,
      { passwordActual, passwordNou },
      { headers: this.getHeaders() }
    );
  }

  updatePerfil(data: { nom?: string, email?: string }): Observable<any> {
    return this.http.put(`${this.baseUrl}/perfil`, data, { headers: this.getHeaders() });
  }

  getPerfil(): Observable<any> {
    return this.http.get(`${this.baseUrl}/perfil`, { headers: this.getHeaders() });
  }

  // ── DESPESES ──
  getDespeses(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa`, { headers: this.getHeaders() });
  }

  getTiquets(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa?tipus=tiquet`, { headers: this.getHeaders() });
  }

  getFactures(): Observable<any> {
    return this.http.get(`${this.baseUrl}/despesa?tipus=factura`, { headers: this.getHeaders() });
  }

  createDespesa(despesa: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa`, despesa, { headers: this.getHeaders() });
  }

  updateDespesa(id: number, despesa: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/despesa/${id}`, despesa, { headers: this.getHeaders() });
  }

  deleteDespesa(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/despesa/${id}`, { headers: this.getHeaders() });
  }

  ocrDespesa(fitxer: File): Observable<any> {
    const formData = new FormData();
    formData.append('imatge', fitxer);
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    return this.http.post(`${this.baseUrl}/ocr`, formData, { headers });
  }

  aprovarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/aprovar`, {}, { headers: this.getHeaders() });
  }

  rebutjarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, {}, { headers: this.getHeaders() });
  }

  rebutjarDespesaAmbComentari(id: number, comentari: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, { comentari }, { headers: this.getHeaders() });
  }

  // ── USUARIS ──
  getUsuaris(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users`, { headers: this.getHeaders() });
  }

  crearUsuari(data: { nom: string; email: string; password: string; perfil: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, data, { headers: this.getHeaders() });
  }

  updateUsuari(id: number, data: { nom?: string, email?: string, perfil?: string, password?: string }): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, data, { headers: this.getHeaders() });
  }

  deleteUsuari(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  // ── PRESSUPOST ──
  getPressupost(): Observable<any> {
    return this.http.get(`${this.baseUrl}/pressupost`, { headers: this.getHeaders() });
  }

  updatePressupost(userId: number, pressupost: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/pressupost/${userId}`, { pressupost }, { headers: this.getHeaders() });
  }

  // ── NOTIFICACIONS ──
  getNotificacions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notificacions`, { headers: this.getHeaders() });
  }
}