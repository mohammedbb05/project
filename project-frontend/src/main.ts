import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';  // ✅ importa app.config

bootstrapApplication(AppComponent, appConfig);  // ✅ usa appConfig