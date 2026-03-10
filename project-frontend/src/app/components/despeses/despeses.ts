import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DespesaService {

  api = "http://localhost:3000";

  constructor(private http: HttpClient) {}

  login(email:string,password:string){
    return this.http.post(`${this.api}/login`,{
      email,
      password
    });
  }

}