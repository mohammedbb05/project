# 📋 Gestió de Despeses — Explicació Completa del Projecte

---

## 🎯 Què és aquest projecte?

**Gestió de Despeses** és una aplicació web fullstack per gestionar despeses empresarials de forma digital. Permet als empleats pujar tiquets i factures, als validadors aprovar-les o rebutjar-les, i als administradors gestionar tot el sistema. Els documents es guarden automàticament a **DocuWare** (sistema de gestió documental empresarial) i s'envien notificacions via **n8n** (automatització de workflows).

---

## 🏗️ Arquitectura General

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   FRONTEND      │ ──────▶│    BACKEND      │ ──────▶│   BASE DE DADES │
│   Angular 17    │  HTTP  │   Node.js +     │ Prisma │     MySQL       │
│   Port 4200     │◀────── │   Express       │ ──────▶│                 │
└─────────────────┘  JSON  │   Port 3000     │        └─────────────────┘
                           └────────┬────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌──────────┐   ┌──────────┐   ┌──────────────┐
             │DocuWare  │   │   n8n    │   │ OpenRouter   │
             │Cloud DMS │   │Webhooks  │   │ (Claude OCR) │
             └──────────┘   └──────────┘   └──────────────┘
```

---

## 📁 Estructura de Carpetes

```
project/
├── backend/
│   ├── server.js              ← API REST principal
│   ├── middleware/
│   │   ├── auth.js            ← Autenticació JWT
│   │   └── upload.js          ← Gestió fitxers (multer)
│   ├── prisma/
│   │   └── schema.prisma      ← Model de dades
│   ├── uploads/               ← Imatges pujades
│   └── .env                   ← Variables d'entorn
│
└── frontend/
    └── src/app/
        ├── components/
        │   ├── login/         ← Pantalla login
        │   ├── dashboard/     ← Llistat despeses principal
        │   ├── ocr-form/      ← Formulari nova despesa + OCR
        │   ├── fulles/        ← Fulles de despeses
        │   ├── calendari/     ← Vista calendari
        │   ├── estadistiques/ ← Gràfics i estadístiques
        │   ├── admin/         ← Gestió d'usuaris
        │   ├── perfil/        ← Perfil d'usuari
        │   ├── sidebar/       ← Menú lateral reutilitzable
        │   └── canviar-contrasenya/
        ├── services/
        │   ├── despesa.ts     ← Servei HTTP principal
        │   └── fulla.service.ts
        └── app.routes.ts      ← Definició de rutes
```

---

## 🗄️ Model de Dades (Base de Dades MySQL)

### Taula `usuari`
```
id                 → Identificador únic
nom                → Nom complet
email              → Email únic (per login)
password           → Contrasenya encriptada (bcrypt)
perfil             → "usuari" | "validador" | "admin"
pressupost         → Pressupost mensual assignat (€)
mustChangePassword → Si ha de canviar contrasenya en primer login
```

### Taula `despesa`
```
id             → Identificador únic
proveidor      → Nom de l'empresa/establiment
cif            → CIF/NIF (obligatori per factures)
importTotal    → Import en euros
iva            → Percentatge IVA (opcional)
baseImposable  → Base imposable (opcional)
data           → Data del document
concepte       → Descripció del que s'ha comprat
categoria      → Dietes | Gasolina | Transport | Parking | Restaurant | Oficina | Altres
urlImatge      → URL de la imatge del tiquet/factura
tipusDocument  → "tiquet" | "factura"
estat          → "draft" | "pendent" | "aprovat" | "rebutjat"
comentari      → Motiu del rebuig (opcional)
docuwareId     → ID del document a DocuWare
usuariId       → FK → usuari
fullaId        → FK → FullaDespesa (opcional)
```

### Taula `FullaDespesa`
```
id        → Identificador únic
titol     → Nom de la fulla
mes       → Mes (Gener, Febrer...)
any       → Any numèric
estat     → "draft" | "pendent" | "aprovat" | "rebutjat"
usuariId  → FK → usuari
createdAt → Data de creació
```

---

## 🔐 Sistema d'Autenticació

### Com funciona el Login:
```
1. Usuari envia email + password
2. Backend busca l'usuari a MySQL
3. Compara password amb bcrypt.compare()
4. Si és vàlid → genera JWT token (24h)
5. Retorna token + dades usuari + mustChangePassword
6. Frontend guarda tot al localStorage
7. Si mustChangePassword=true → redirigeix a canviar contrasenya
```

### JWT Token:
```javascript
// Contingut del token (payload)
{
  userId: 1,
  perfil: "admin",
  iat: 1234567890,  // issued at
  exp: 1234654290   // expires in 24h
}
```

### Middleware d'autenticació:
Cada petició protegida passa per `authenticate`:
```
Header: Authorization: Bearer <token>
         ↓
    Verifica JWT
         ↓
    Afegeix req.user
         ↓
    Continua o 401
```

---

## 👥 Sistema de Rols i Permisos

| Acció | Usuari | Validador | Admin |
|-------|--------|-----------|-------|
| Veure les seves despeses | ✅ | ✅ | ✅ |
| Veure totes les despeses | ❌ | ✅ | ✅ |
| Crear despeses | ✅ | ❌ | ✅ |
| Aprovar/Rebutjar despeses | ❌ | ✅ | ✅ |
| Gestionar pressupostos | ❌ | ✅ | ✅ |
| Crear usuaris | ❌ | ❌ | ✅ |
| Editar usuaris | ❌ | ❌ | ✅ |
| Eliminar usuaris | ❌ | ❌ | ✅ |

---

## 🔄 Flux de Vida d'una Despesa

```
USUARI puja tiquet/factura
          ↓
    [estat: DRAFT]
          ↓
  Opcionalment assigna
  a una Fulla de Despesa
          ↓
  Envia per aprovació
          ↓
   [estat: PENDENT]
          ↓
    VALIDADOR/ADMIN revisa
         /        \
        ✅          ❌
       ↓              ↓
  [APROVAT]      [REBUTJAT]
                  + comentari
```

---

## 🤖 Sistema OCR (Reconeixement de Tiquets)

### Flux:
```
1. Usuari puja una foto del tiquet
2. Backend rep la imatge (multer)
3. Converteix a base64
4. Envia a OpenRouter API (Claude claude-3-haiku)
5. IA analitza i extreu:
   - Proveïdor, CIF, Import, IVA
   - Data, Concepte, Categoria
   - tipusDocument (tiquet o factura)
6. Retorna JSON amb les dades
7. Frontend omple el formulari automàticament
8. Usuari revisa i confirma
```

### Diferència Tiquet vs Factura:
- **Tiquet**: Rebut simple, sense CIF ni IVA desglossat (bar, parking, taxi...)
- **Factura**: Document formal amb CIF empresa, base imposable i IVA desglossat

---

## 📦 Integració DocuWare

DocuWare és un sistema de gestió documental empresarial (DMS) al núvol.

### Flux de pujada:
```
1. Es crea la despesa a MySQL
2. En background (async) → subirADocuware()
3. Obté token OAuth2 de DocuWare
4. Crea formulari multipart amb:
   - JSON amb camps d'índex (metadades)
   - Fitxer de la imatge
5. POST a /FileCabinets/{id}/Documents
6. DocuWare retorna ID del document
7. Backend guarda docuwareId a MySQL
```

### Camps indexats a DocuWare:
```
DOCUMENT_TYPE      → "Tiquet" o "Factura"
TIPUS_DOCUMENT     → "tiquet" o "factura"
STATUS             → draft | aprovat | rebutjat
DOCUMENT_DATE      → Data del document
TOTAL_REIMBURSEMENT → Import total
COMMENT            → Concepte/descripció
USER_ID            → ID de l'usuari
```

### Actualització d'estat:
Quan una despesa s'aprova o rebutja → `actualitzarEstatDocuware()` fa un PUT al camp STATUS de DocuWare.

---

## 📬 Sistema de Notificacions (n8n)

n8n és una plataforma d'automatització de workflows.

### Quan s'envien notificacions:
| Event | Destinatari |
|-------|-------------|
| Nova despesa creada | Tots els validadors i admins |
| Despesa aprovada | L'usuari que la va crear |
| Despesa rebutjada | L'usuari que la va crear |
| Nova fulla enviada | Tots els validadors i admins |
| Fulla aprovada | L'usuari propietari |
| Fulla rebutjada | L'usuari propietari |

### Estructura del webhook:
```javascript
{
  nomUsuari: "Joan",
  emailUsuari: "joan@empresa.com",
  proveidor: "SUPREME",
  importTotal: 621,
  subject: "✅ Despesa aprovada",
  missatge: "La teva despesa de 621€ ha estat aprovada."
}
```

n8n rep el webhook i pot enviar emails, Slack, Teams, etc.

---

## 🖥️ Frontend Angular — Components

### Sidebar (Reutilitzable)
- Mostra menú diferent per rol
- Marca la pàgina activa
- Badge de notificacions pendents
- Usuari i logout a la part inferior

### Dashboard
- Stats cards (total, aprovades, pendents, rebutjades)
- Taula ordenable per columnes
- Pestanyes: Totes / Tiquets / Factures
- Barra de pressupost (solo usuari)
- Botó aprovar/rebutjar inline (validador/admin)
- Export CSV

### Calendari
- Navega per mesos
- Punts de colors per estat en cada dia
- Modal amb detall de la despesa
- Aprovar/rebutjar des del modal

### Admin
- Llistat d'usuaris amb rols
- Modal crear usuari (amb contrasenya temporal)
- Modal editar usuari (nom, email, perfil, password)
- Eliminar usuari
- Editar pressupost individual

---

## 🌐 API REST — Endpoints

### Auth
```
POST /login              → Login, retorna JWT
POST /users              → Crear usuari (admin)
PUT  /users/:id          → Editar usuari (admin)
DELETE /users/:id        → Eliminar usuari (admin)
GET  /users              → Llistar usuaris (admin/validador)
```

### Perfil
```
GET /perfil              → Dades del propi perfil
PUT /perfil              → Actualitzar nom/email
PUT /perfil/contrasenya  → Canviar contrasenya
```

### Despeses
```
GET    /despesa           → Llistar despeses
POST   /despesa           → Crear despesa
PUT    /despesa/:id       → Editar despesa
DELETE /despesa/:id       → Eliminar despesa
POST   /despesa/:id/aprovar  → Aprovar
POST   /despesa/:id/rebutjar → Rebutjar amb comentari
GET    /despesa/filter    → Filtrar per estat/categoria/dates
```

### Fulles
```
GET  /fulla              → Llistar fulles
POST /fulla              → Crear fulla
GET  /fulla/:id          → Detall fulla
POST /fulla/:id/despesa/:despesaId → Assignar despesa
POST /fulla/:id/enviar   → Enviar a aprovació
POST /fulla/:id/aprovar  → Aprovar fulla
POST /fulla/:id/rebutjar → Rebutjar fulla
DELETE /fulla/:id        → Eliminar fulla
```

### Altres
```
POST /ocr                → Analitzar imatge amb IA
GET  /pressupost         → Dades pressupost usuari
PUT  /pressupost/:userId → Actualitzar pressupost
GET  /notificacions      → Nombre de pendents
GET  /estadistiques/categoria → Stats per categoria
GET  /estadistiques/total    → Import total
```

---

## ⚙️ Variables d'Entorn (.env)

```env
# Base de dades
DATABASE_URL="mysql://user:password@localhost:3306/despeses"

# JWT
JWT_SECRET="el_teu_secret_molt_segur"

# Servidor
PORT=3000
SERVER_URL=http://localhost:3000

# DocuWare
DOCUWARE_URL=https://empresa.docuware.cloud
DOCUWARE_TOKEN_URL=https://empresa.docuware.cloud/DocuWare/Platform/IdentityService/connect/token
DOCUWARE_USER=admin@empresa.com
DOCUWARE_PASSWORD=password
DOCUWARE_CABINET_ID=xxxx-xxxx-xxxx-xxxx

# IA (OCR)
OPENROUTER_API_KEY=sk-or-xxxxx
```

---

## 🚀 Com Arrancar el Projecte

```bash
# Instal·lar dependències
npm install

# Configurar base de dades
npx prisma db push

# Arrancar tot (frontend + backend)
npm run start

# O per separat:
npm run backend   # Node.js port 3000
npm run frontend  # Angular port 4200
```

---

## 🔒 Seguretat Implementada

- **Passwords**: Encriptats amb bcrypt (salt rounds: 10)
- **Tokens**: JWT amb expiració de 24h
- **Rols**: Middleware `requirePerfil()` per protegir endpoints
- **Primer login**: `mustChangePassword` força canvi de contrasenya
- **CORS**: Només permet peticions des de localhost:4200
- **Validacions**: Camps obligatoris verificats al backend

---

## 📊 Tecnologies Utilitzades

| Tecnologia | Versió | Ús |
|-----------|--------|-----|
| Angular | 17 | Frontend SPA |
| TypeScript | 5 | Tipat estàtic |
| Node.js | 18+ | Backend runtime |
| Express | 4 | Framework API REST |
| Prisma | 5 | ORM base de dades |
| MySQL | 8 | Base de dades |
| JWT | - | Autenticació |
| bcrypt | - | Encriptació passwords |
| Multer | - | Upload fitxers |
| Chart.js | - | Gràfics estadístiques |
| DocuWare | Cloud | Gestió documental |
| n8n | Self-hosted | Automatització |
| OpenRouter | - | API IA (Claude) |