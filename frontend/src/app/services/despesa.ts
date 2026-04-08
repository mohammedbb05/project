// src/app/services/despesa.ts
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

  register(nom: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, { nom, email, password, perfil: 'usuari' });
  }

  aprovarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/aprovar`, {});
  }

  rebutjarDespesa(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, {});
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

  // ✅ NOU
  getNotificacions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notificacions`);
  }

  rebutjarDespesaAmbComentari(id: number, comentari: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/despesa/${id}/rebutjar`, { comentari });
}
}