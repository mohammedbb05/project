import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { OcrFormComponent } from './components/ocr-form/ocr-form';
import { FullesComponent } from './components/fulles/fulles';
import { EstadistiquesComponent } from './components/estadistiques/estadistiques';
import { RegisterComponent } from './components/registre/registre';
import { AdminComponent } from './components/admin/admin'

export const routes: Routes = [

  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

  { path: 'despeses', component: DashboardComponent },

  { path: 'nova-despesa', component: OcrFormComponent },

  { path: 'register', component: RegisterComponent },

  { path: 'fulles', component: FullesComponent },

  { path: 'estadistiques', component: EstadistiquesComponent },

  { path: 'admin', component: AdminComponent },

];