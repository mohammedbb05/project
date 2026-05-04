import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { OcrFormComponent } from './components/ocr-form/ocr-form';
import { FullesComponent } from './components/fulles/fulles';
import { EstadistiquesComponent } from './components/estadistiques/estadistiques';
import { RegisterComponent } from './components/registre/registre';
import { AdminComponent } from './components/admin/admin';
import { PerfilComponent } from './components/perfil/perfil';
import { CanviarContrasenyaComponent } from './components/canviar-contrasenya/canviar-contrasenya';
import { CalendariComponent } from './components/calendari/calendari';
import { LayoutComponent } from './components/layout/layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'despeses', component: DashboardComponent },
      { path: 'nova-despesa', component: OcrFormComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'fulles', component: FullesComponent },
      { path: 'estadistiques', component: EstadistiquesComponent },
      { path: 'admin', component: AdminComponent },
      { path: 'perfil', component: PerfilComponent },
      { path: 'canviar-contrasenya', component: CanviarContrasenyaComponent },
      { path: 'calendari', component: CalendariComponent },
    ]
  }
];