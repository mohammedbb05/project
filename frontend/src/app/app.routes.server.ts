// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'login',
    renderMode: RenderMode.Server
  },
  {
    path: 'despeses',
    renderMode: RenderMode.Client
  },
  {
    path: 'nova-despesa',
    renderMode: RenderMode.Client  // ✅ afegit
  },
  {
    path: '**',
    renderMode: RenderMode.Client  // ✅ tot per defecte al client
  }
];