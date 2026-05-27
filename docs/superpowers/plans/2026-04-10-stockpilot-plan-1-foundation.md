# StockPilot — Plan 1 : Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the StockPilot project with authentication, complete multi-tenant Prisma schema, dashboard layout, and onboarding wizard — ready to build features on top.

**Architecture:** New Next.js 15 App Router project in a fresh directory (separate from OmniGestion). Supabase Auth handles JWT sessions; `middleware.ts` protects all `/dashboard/*` and `/onboarding` routes. Every server component / API route resolves tenant context via `requireTenant()`. Prisma schema is complete (all 7 plans' models) so migrations only run once.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS, Shadcn UI, Supabase Auth + `@supabase/ssr`, Prisma ORM, Upstash Redis, Upstash QStash, Jest + Testing Library

---

## Sprint Map (7 plans total — Plan 1 of 7)

| Plan | Feature | Prérequis |
|------|---------|-----------|
| Plan 1 (this) | Foundation: auth, schema, layout, onboarding | Aucun |
| Plan 2 | Catalogue: produits, catégories, fournisseurs | Plan 1 |
| Plan 3 | Entrepôts + Stock Core | Plan 2 |
| Plan 4 | Purchase Orders | Plan 3 |
| Plan 5 | Sales Orders | Plan 3 |
| Plan 6 | Dashboard KPIs + Redis | Plans 4 + 5 |
| Plan 7 | Scanner PWA + Serwist | Plan 3 |

---

## File Map

```
stockpilot/                            ← NEW directory (not inside OmniGestion)
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx             ← Login form (useActionState)
│   │   ├── register/page.tsx          ← Register form (useActionState)
│   │   └── actions.ts                 ← "use server": login, register, logout
│   ├── onboarding/
│   │   ├── page.tsx                   ← 3-step wizard (client component)
│   │   └── actions.ts                 ← "use server": saveStep1/2/3
│   ├── dashboard/
│   │   ├── layout.tsx                 ← Auth check + sidebar wrapper
│   │   ├── page.tsx                   ← Empty placeholder (will be KPIs in Plan 6)
│   │   ├── error.tsx                  ← Dashboard error boundary
│   │   └── loading.tsx                ← Dashboard loading skeleton
│   ├── error.tsx                      ← App-level error boundary (no html/body)
│   ├── global-error.tsx               ← Global error boundary (with html/body)
│   ├── layout.tsx                     ← Root layout (fonts, providers)
│   └── page.tsx                       ← Root redirect → /dashboard
├── components/
│   ├── ui/                            ← Shadcn primitives (auto-generated)
│   ├── dashboard/
│   │   ├── sidebar.tsx                ← Navigation sidebar (collapsible Stock sub-menu)
│   │   └── user-menu.tsx              ← Avatar dropdown (nom + logout)
│   └── onboarding/
│       └── wizard.tsx                 ← Multi-step form UI (client)
├── lib/
│   ├── db.ts                          ← Prisma singleton
│   ├── tenant.ts                      ← requireTenant() → { user, tenant }
│   ├── utils.ts                       ← cn(), formatCurrency(), formatDate()
│   ├── redis.ts                       ← Upstash Redis client
│   ├── qstash.ts                      ← Upstash QStash client
│   └── supabase/
│       ├── server.ts                  ← createClient() pour Server Components
│       └── client.ts                  ← createBrowserClient() pour Client Components
├── lib/__tests__/
│   └── utils.test.ts                  ← Tests unitaires formatCurrency, formatDate
├── middleware.ts                       ← JWT check + route protection
├── prisma/
│   └── schema.prisma                  ← Schéma complet (tous les modèles V1)
├── jest.config.ts
├── jest.setup.ts
├── .env.local                         ← Variables d'environnement (ne jamais committer)
└── package.json
```

---

### Task 1: Project Scaffold & Configuration

**Files:**
- Create: `stockpilot/` (via create-next-app)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Créer le projet**

Exécuter dans le dossier parent (ex: `D:\Amir's workx\claude code\`) :

```bash
npx create-next-app@latest stockpilot --typescript --tailwind --app --src-dir=no --import-alias="@/*" --eslint
cd stockpilot
```

- [ ] **Step 2: Installer les dépendances**

```bash
npm install @prisma/client @supabase/supabase-js @supabase/ssr @upstash/redis @upstash/qstash zod
npm install -D prisma jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest ts-node
```

- [ ] **Step 3: Initialiser Shadcn**

```bash
npx shadcn@latest init
```

Répondre : Default style → Slate → CSS variables: Yes.

- [ ] **Step 4: Ajouter les composants Shadcn**

```bash
npx shadcn@latest add button input label badge card table tabs select textarea skeleton avatar dropdown-menu sheet separator progress
```

- [ ] **Step 5: Configurer Jest**

Créer `jest.config.ts` :

```typescript
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
```

Créer `jest.setup.ts` :

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Mettre à jour `app/layout.tsx`**

Remplacer le fichier généré par create-next-app :

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StockPilot",
  description: "Gestion de stock pour PME algériennes et françaises",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Vérifier le build**

```bash
npm run build
```

Attendu : build réussi, aucune erreur TypeScript.

- [ ] **Step 8: Git init + premier commit**

```bash
git init
echo "node_modules\n.next\n.env.local\n.env*.local" > .gitignore
git add -A
git commit -m "chore: bootstrap StockPilot with Next.js 15 + Shadcn + Jest"
```

---

### Task 2: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`
- Create: `.env.local`

- [ ] **Step 1: Initialiser Prisma**

```bash
npx prisma init
```

Cela crée `prisma/schema.prisma` et ajoute `DATABASE_URL` dans `.env`.

- [ ] **Step 2: Créer `.env.local`**

```bash
# .env.local — ne jamais committer ce fichier
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
UPSTASH_REDIS_REST_URL="https://[redis-endpoint].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[redis-token]"
QSTASH_TOKEN="[qstash-token]"
QSTASH_CURRENT_SIGNING_KEY="[signing-key]"
QSTASH_NEXT_SIGNING_KEY="[next-signing-key]"
```

Remplir avec les vraies valeurs du dashboard Supabase et Upstash.

- [ ] **Step 3: Écrire le schéma Prisma complet**

Remplacer entièrement `prisma/schema.prisma` :

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── TENANT & AUTH ───────────────────────────────────

model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  country   String   // "DZ" | "FR"
  currency  String   // "DZD" | "EUR"
  plan      PlanType @default(FREE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  settings        TenantSettings?
  users           User[]
  locations       Location[]
  suppliers       Supplier[]
  categories      Category[]
  products        Product[]
  inventoryLevels InventoryLevel[]
  stockMovements  StockMovement[]
  purchaseOrders  PurchaseOrder[]
  salesOrders     SalesOrder[]
  alerts          Alert[]

  @@map("tenants")
}

// Compteurs de numérotation — mis à jour en transaction pour éviter les doublons
model TenantSettings {
  id        String @id @default(cuid())
  tenantId  String @unique
  nextPONum Int    @default(1)
  nextSONum Int    @default(1)
  poPrefix  String @default("PO")
  soPrefix  String @default("SO")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("tenant_settings")
}

model User {
  id         String   @id @default(cuid())
  tenantId   String
  supabaseId String   @unique  // Lien vers auth.users de Supabase
  email      String
  name       String
  role       UserRole @default(WAREHOUSE_STAFF)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  stockMovements StockMovement[]
  salesOrders    SalesOrder[]
  purchaseOrders PurchaseOrder[]

  @@unique([tenantId, email])  // Email unique par tenant, pas globalement
  @@map("users")
}

enum UserRole { ADMIN  MANAGER  WAREHOUSE_STAFF }
enum PlanType { FREE  PRO  ENTERPRISE }

// ─── CATALOGUE ───────────────────────────────────────

model Category {
  id       String  @id @default(cuid())
  tenantId String
  name     String
  color    String?

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  products Product[]

  @@unique([tenantId, name])  // Pas de doublon de catégorie par tenant
  @@map("categories")
}

model Supplier {
  id       String  @id @default(cuid())
  tenantId String
  name     String
  email    String?
  phone    String?
  address  String?
  notes    String?
  isActive Boolean @default(true)

  tenant         Tenant            @relation(fields: [tenantId], references: [id])
  purchaseOrders PurchaseOrder[]
  products       ProductSupplier[]

  @@map("suppliers")
}

model Product {
  id                String   @id @default(cuid())
  tenantId          String
  categoryId        String?
  sku               String
  name              String
  barcode           String?
  costPrice         Decimal  @db.Decimal(10, 2)
  sellPrice         Decimal  @db.Decimal(10, 2)
  unit              String   @default("unité")
  taxRate           Float    @default(19)
  lowStockThreshold Int      @default(5)
  imageUrl          String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tenant          Tenant              @relation(fields: [tenantId], references: [id])
  category        Category?           @relation(fields: [categoryId], references: [id])
  suppliers       ProductSupplier[]
  inventoryLevels InventoryLevel[]
  stockMovements  StockMovement[]
  purchaseItems   PurchaseOrderItem[]
  salesItems      SalesOrderItem[]
  alerts          Alert[]

  @@unique([tenantId, sku])
  @@map("products")
}

model ProductSupplier {
  id          String  @id @default(cuid())
  productId   String
  supplierId  String
  supplierSku String?
  costPrice   Decimal @db.Decimal(10, 2)
  isPreferred Boolean @default(false)

  product  Product  @relation(fields: [productId], references: [id])
  supplier Supplier @relation(fields: [supplierId], references: [id])

  @@unique([productId, supplierId])
  @@map("product_suppliers")
}

// ─── ENTREPÔTS ───────────────────────────────────────

model Location {
  id       String       @id @default(cuid())
  tenantId String
  name     String
  type     LocationType
  address  String?
  isActive Boolean      @default(true)

  tenant          Tenant           @relation(fields: [tenantId], references: [id])
  inventoryLevels InventoryLevel[]
  movementsFrom   StockMovement[]  @relation("FromLocation")
  movementsTo     StockMovement[]  @relation("ToLocation")
  purchaseOrders  PurchaseOrder[]
  salesItems      SalesOrderItem[]
  alerts          Alert[]

  @@map("locations")
}

enum LocationType { WAREHOUSE  STORE  VIRTUAL }

// ─── STOCK ───────────────────────────────────────────

model InventoryLevel {
  id         String @id @default(cuid())
  tenantId   String
  productId  String
  locationId String
  quantity   Int    @default(0)

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])
  location Location @relation(fields: [locationId], references: [id])

  @@unique([tenantId, productId, locationId])
  @@map("inventory_levels")
}

model StockMovement {
  id             String       @id @default(cuid())
  tenantId       String
  productId      String
  fromLocationId String?      // null = entrée externe (réception fournisseur)
  toLocationId   String?      // null = sortie externe (expédition client, perte)
  quantity       Int          // TOUJOURS POSITIF — direction déterminée par from/to + type
  type           MovementType
  referenceId    String?
  referenceType  String?      // "purchase_order" | "sales_order" | "adjustment"
  note           String?
  createdById    String
  createdAt      DateTime     @default(now())

  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  product      Product   @relation(fields: [productId], references: [id])
  fromLocation Location? @relation("FromLocation", fields: [fromLocationId], references: [id])
  toLocation   Location? @relation("ToLocation", fields: [toLocationId], references: [id])
  createdBy    User      @relation(fields: [createdById], references: [id])

  @@map("stock_movements")
}

// Direction d'un mouvement :
// RECEIVE   → from=null,     to=entrepôt  → InventoryLevel[to]   += quantity
// SHIP      → from=entrepôt, to=null      → InventoryLevel[from] -= quantity
// TRANSFER  → from=A,        to=B         → InventoryLevel[A] -= qty, InventoryLevel[B] += qty
// ADJUSTMENT/LOSS → from=entrepôt, to=null → InventoryLevel[from] -= quantity
enum MovementType { RECEIVE  SHIP  TRANSFER  ADJUSTMENT  LOSS }

// ─── ACHATS ──────────────────────────────────────────

model PurchaseOrder {
  id          String    @id @default(cuid())
  tenantId    String
  supplierId  String
  locationId  String    // Entrepôt de destination de la réception
  number      String
  status      POStatus  @default(DRAFT)
  expectedAt  DateTime?
  receivedAt  DateTime?
  notes       String?
  subtotal    Decimal   @db.Decimal(10, 2)
  taxAmount   Decimal   @db.Decimal(10, 2)
  total       Decimal   @db.Decimal(10, 2)
  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tenant    Tenant              @relation(fields: [tenantId], references: [id])
  supplier  Supplier            @relation(fields: [supplierId], references: [id])
  location  Location            @relation(fields: [locationId], references: [id])
  createdBy User                @relation(fields: [createdById], references: [id])
  items     PurchaseOrderItem[]

  @@unique([tenantId, number])
  @@map("purchase_orders")
}

enum POStatus { DRAFT  SENT  PARTIAL  RECEIVED  CANCELLED }

model PurchaseOrderItem {
  id               String  @id @default(cuid())
  purchaseOrderId  String
  productId        String
  quantityOrdered  Int
  quantityReceived Int     @default(0)
  unitCost         Decimal @db.Decimal(10, 2)
  taxRate          Float
  total            Decimal @db.Decimal(10, 2)

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  product       Product       @relation(fields: [productId], references: [id])

  @@map("purchase_order_items")
}

// ─── VENTES ──────────────────────────────────────────

model SalesOrder {
  id            String       @id @default(cuid())
  tenantId      String
  number        String
  channel       SalesChannel
  status        SOStatus     @default(DRAFT)
  customerName  String?
  customerEmail String?
  customerPhone String?
  notes         String?
  subtotal      Decimal      @db.Decimal(10, 2)
  taxAmount     Decimal      @db.Decimal(10, 2)
  total         Decimal      @db.Decimal(10, 2)
  soldAt        DateTime?
  createdById   String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  tenant    Tenant           @relation(fields: [tenantId], references: [id])
  createdBy User             @relation(fields: [createdById], references: [id])
  items     SalesOrderItem[]

  @@unique([tenantId, number])
  @@map("sales_orders")
}

enum SalesChannel { IN_STORE  ONLINE  WHOLESALE }
enum SOStatus     { DRAFT  CONFIRMED  SHIPPED  DELIVERED  CANCELLED }

model SalesOrderItem {
  id           String  @id @default(cuid())
  salesOrderId String
  productId    String
  locationId   String  // Entrepôt source de la marchandise
  quantity     Int
  unitPrice    Decimal @db.Decimal(10, 2)
  unitCost     Decimal @db.Decimal(10, 2)  // Snapshot au moment de la vente
  taxRate      Float
  total        Decimal @db.Decimal(10, 2)

  salesOrder SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  product    Product    @relation(fields: [productId], references: [id])
  location   Location   @relation(fields: [locationId], references: [id])

  @@map("sales_order_items")
}

// ─── ALERTES ─────────────────────────────────────────

model Alert {
  id         String    @id @default(cuid())
  tenantId   String
  productId  String
  locationId String    // Location concernée par le stock bas
  type       AlertType
  isRead     Boolean   @default(false)
  createdAt  DateTime  @default(now())

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])
  location Location @relation(fields: [locationId], references: [id])

  @@unique([tenantId, productId, locationId, type])  // Pas de doublon d'alerte par produit/location/type
  @@map("alerts")
}

enum AlertType { LOW_STOCK  OUT_OF_STOCK }
```

- [ ] **Step 4: Valider le schéma**

```bash
npx prisma validate
```

Attendu : `The schema at prisma/schema.prisma is valid`

- [ ] **Step 5: Pousser le schéma vers Supabase**

```bash
npx prisma db push
```

Attendu : `Your database is now in sync with your Prisma schema.`

- [ ] **Step 6: Générer le client Prisma**

```bash
npx prisma generate
```

- [ ] **Step 7: Créer `lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 8: Ajouter prisma generate au build**

Dans `package.json`, modifier le script `build` :

```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add complete Prisma schema and db client"
```

---

### Task 3: Supabase Auth Helpers & Middleware

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Créer `lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies en lecture seule, ignoré
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Créer `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Créer `middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes protégées — redirige vers login si non authentifié
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirige vers dashboard si déjà connecté et sur page auth
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 4: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur TypeScript.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth helpers and middleware route protection"
```

---

### Task 4: Auth Server Actions + Pages

**Files:**
- Create: `app/(auth)/actions.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`

- [ ] **Step 1: Créer `app/(auth)/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function login(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return error.message;

  redirect("/dashboard");
}

export async function register(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const orgName = formData.get("orgName") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) return error?.message ?? "Erreur lors de l'inscription";

  // Créer le tenant + user dans la base Prisma
  const slug = orgName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

  await db.tenant.create({
    data: {
      name: orgName,
      slug: `${slug}-${Date.now()}`,
      country: "DZ",      // Modifié à l'étape 1 de l'onboarding
      currency: "DZD",
      settings: { create: {} },
      users: {
        create: {
          supabaseId: data.user.id,
          email,
          name,
          role: "ADMIN",
        },
      },
    },
  });

  redirect("/onboarding");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Créer `app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
            <p className="text-slate-500 text-sm mt-1">
              Accédez à votre espace StockPilot
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Connexion en cours…" : "Se connecter"}
            </Button>
          </form>

          <p className="text-sm text-slate-500 text-center">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer `app/(auth)/register/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [error, formAction, isPending] = useActionState(register, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Créer un compte</h1>
            <p className="text-slate-500 text-sm mt-1">
              Démarrez gratuitement en moins de 2 minutes
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Votre nom</Label>
              <Input id="name" name="name" required placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Nom de l&apos;organisation</Label>
              <Input
                id="orgName"
                name="orgName"
                required
                placeholder="Ma Boutique SARL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Création en cours…" : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-sm text-slate-500 text-center">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Créer `app/page.tsx` (redirect racine)**

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Tester manuellement**

```bash
npm run dev
```

1. Aller sur `http://localhost:3000` → doit rediriger vers `/login` (non authentifié)
2. S'inscrire avec un email de test → doit créer le compte et rediriger vers `/onboarding`
3. Se déconnecter et se reconnecter → doit rediriger vers `/dashboard`

**Note Supabase :** Désactiver la confirmation email dans le dashboard Supabase → Authentication → Email → Disable email confirmations (pour le développement).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: auth pages and server actions (login, register, logout)"
```

---

### Task 5: Tenant Helper & Utility Library

**Files:**
- Create: `lib/tenant.ts`
- Create: `lib/utils.ts`
- Create: `lib/redis.ts`
- Create: `lib/qstash.ts`
- Create: `lib/__tests__/utils.test.ts`

- [ ] **Step 1: Écrire le test unitaire en premier**

Créer `lib/__tests__/utils.test.ts` :

```typescript
import { formatCurrency, formatDate } from "../utils";

describe("formatCurrency", () => {
  it("formate DZD avec séparateur de milliers et code devise", () => {
    const result = formatCurrency(1000, "DZD");
    expect(result).toMatch(/1[\s\u202f]000/); // espace insécable français
    expect(result).toMatch(/DZD/);
  });

  it("formate EUR avec symbole €", () => {
    const result = formatCurrency(1000, "EUR");
    expect(result).toMatch(/1[\s\u202f]000/);
    expect(result).toMatch(/€/);
  });

  it("accepte des Decimal Prisma (string)", () => {
    expect(() => formatCurrency("1500.50" as unknown as number, "DZD")).not.toThrow();
  });
});

describe("formatDate", () => {
  it("formate une date au format JJ/MM/AAAA", () => {
    // Fixer la date pour éviter les flottements de timezone
    const date = new Date("2026-01-15T12:00:00.000Z");
    const result = formatDate(date);
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain("2026");
  });

  it("accepte une string ISO", () => {
    expect(() => formatDate("2026-04-10")).not.toThrow();
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
npx jest lib/__tests__/utils.test.ts
```

Attendu : FAIL — `Cannot find module '../utils'`

- [ ] **Step 3: Implémenter `lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string,
  currency: "DZD" | "EUR"
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
```

- [ ] **Step 4: Vérifier que le test passe**

```bash
npx jest lib/__tests__/utils.test.ts
```

Attendu : PASS — 4 tests passed.

- [ ] **Step 5: Implémenter `lib/tenant.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import type { Tenant, User } from "@prisma/client";

type TenantContext = {
  user: User & { tenant: Tenant };
  tenant: Tenant;
};

/**
 * À appeler au début de chaque Server Component et API route protégée.
 * Résout l'utilisateur Supabase → User Prisma → Tenant.
 * Redirige vers /login si non authentifié.
 */
export async function requireTenant(): Promise<TenantContext> {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { tenant: true },
  });

  if (!user || !user.isActive) redirect("/login");

  return { user, tenant: user.tenant };
}
```

- [ ] **Step 6: Implémenter `lib/redis.ts`**

```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

- [ ] **Step 7: Implémenter `lib/qstash.ts`**

```typescript
import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tenant resolver, utils, redis, qstash clients"
```

---

### Task 6: Dashboard Layout & Sidebar

**Files:**
- Create: `components/dashboard/sidebar.tsx`
- Create: `components/dashboard/user-menu.tsx`
- Create: `app/dashboard/layout.tsx`
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Créer `components/dashboard/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Layers,
  ShoppingCart,
  TrendingUp,
  Settings,
  ChevronDown,
  Boxes,
} from "lucide-react";

type NavItem = {
  href?: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/produits", label: "Produits", icon: Package },
  { href: "/dashboard/entrepots", label: "Entrepôts", icon: Warehouse },
  {
    label: "Stock",
    icon: Layers,
    children: [
      { href: "/dashboard/stock/reception", label: "Réception" },
      { href: "/dashboard/stock/ajustement", label: "Ajustement" },
      { href: "/dashboard/stock/transfert", label: "Transfert" },
      { href: "/dashboard/stock/historique", label: "Historique" },
    ],
  },
  { href: "/dashboard/achats", label: "Achats", icon: ShoppingCart },
  { href: "/dashboard/ventes", label: "Ventes", icon: TrendingUp },
  { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [stockOpen, setStockOpen] = useState(
    pathname.startsWith("/dashboard/stock")
  );

  return (
    <aside className="w-60 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-700">
        <Boxes className="h-6 w-6 text-blue-400" />
        <span className="font-bold text-lg">StockPilot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setStockOpen((prev) => !prev)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname.startsWith("/dashboard/stock")
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      stockOpen && "rotate-180"
                    )}
                  />
                </button>
                {stockOpen && (
                  <div className="ml-7 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block px-3 py-1.5 rounded-lg text-sm transition-colors",
                          pathname === child.href
                            ? "text-white font-medium"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Créer `components/dashboard/user-menu.tsx`**

```tsx
"use client";

import { logout } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

type Props = {
  name: string;
  email: string;
};

export function UserMenu({ name, email }: Props) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors w-full">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-blue-600 text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm text-white font-medium truncate">{name}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 cursor-pointer"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Créer `app/dashboard/layout.tsx`**

```tsx
import { requireTenant } from "@/lib/tenant";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant } = await requireTenant();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar fixe — w-60 */}
      <div className="w-60 shrink-0">
        <Sidebar />
        {/* User menu en bas de la sidebar */}
        <div className="fixed bottom-0 left-0 w-60 p-2 border-t border-slate-700 bg-slate-900">
          <UserMenu name={user.name} email={user.email} />
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Breadcrumb / header organisation */}
        <div className="text-xs text-slate-400 mb-4">{tenant.name}</div>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Créer `app/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Bienvenue sur StockPilot — KPIs disponibles dans le Plan 6.
        </p>
      </div>
      <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400">
        Les indicateurs de performance seront affichés ici.
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Tester la navigation**

```bash
npm run dev
```

1. Se connecter → doit afficher le layout avec sidebar
2. Cliquer sur "Stock" → sous-menu doit s'ouvrir/fermer
3. L'item actif doit être surligné en bleu

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dashboard layout with sidebar and user menu"
```

---

### Task 7: Onboarding Wizard (3 étapes)

**Files:**
- Create: `app/onboarding/actions.ts`
- Create: `app/onboarding/page.tsx`
- Create: `components/onboarding/wizard.tsx`

- [ ] **Step 1: Créer `app/onboarding/actions.ts`**

```typescript
"use server";

import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function saveStep1(formData: FormData): Promise<string | null> {
  const { tenant } = await requireTenant();
  const country = formData.get("country") as "DZ" | "FR";
  if (!["DZ", "FR"].includes(country)) return "Pays invalide";

  const currency = country === "DZ" ? "DZD" : "EUR";

  await db.tenant.update({
    where: { id: tenant.id },
    data: { country, currency },
  });

  return null;
}

export async function saveStep2(formData: FormData): Promise<string | null> {
  const { tenant } = await requireTenant();
  const name = (formData.get("name") as string).trim();
  const type = formData.get("type") as "WAREHOUSE" | "STORE" | "VIRTUAL";

  if (!name) return "Nom requis";
  if (!["WAREHOUSE", "STORE", "VIRTUAL"].includes(type)) return "Type invalide";

  await db.location.create({
    data: { tenantId: tenant.id, name, type },
  });

  return null;
}

export async function saveStep3(formData: FormData): Promise<string | null> {
  const { tenant } = await requireTenant();
  const sku = (formData.get("sku") as string).trim();
  const name = (formData.get("name") as string).trim();
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const sellPrice = parseFloat(formData.get("sellPrice") as string);

  if (!sku || !name) return "SKU et nom requis";
  if (isNaN(costPrice) || costPrice < 0) return "Prix d'achat invalide";
  if (isNaN(sellPrice) || sellPrice < 0) return "Prix de vente invalide";

  // Vérifier doublon SKU
  const existing = await db.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku } },
  });
  if (existing) return "Ce SKU existe déjà";

  await db.product.create({
    data: {
      tenantId: tenant.id,
      sku,
      name,
      costPrice,
      sellPrice,
      unit: "unité",
      taxRate: tenant.country === "DZ" ? 19 : 20,
    },
  });

  redirect("/dashboard");
}
```

- [ ] **Step 2: Créer `components/onboarding/wizard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveStep1, saveStep2, saveStep3 } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = 1 | 2 | 3;

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [step1Error, step1Action, step1Pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const err = await saveStep1(formData);
      if (!err) setStep(2);
      return err;
    },
    null
  );
  const [step2Error, step2Action, step2Pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const err = await saveStep2(formData);
      if (!err) setStep(3);
      return err;
    },
    null
  );
  const [step3Error, step3Action, step3Pending] = useActionState(
    saveStep3,
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  s <= step
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 w-24 rounded ${
                    s < step ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-8 space-y-6">
          {/* Étape 1 : Pays & Devise */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Votre marché
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Choisissez votre pays pour configurer la devise.
                </p>
              </div>
              <form action={step1Action} className="space-y-4">
                {step1Error && (
                  <p className="text-sm text-red-600">{step1Error}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "DZ", label: "🇩🇿 Algérie", sub: "Dinar (DZD)" },
                    { value: "FR", label: "🇫🇷 France", sub: "Euro (EUR)" },
                  ].map(({ value, label, sub }) => (
                    <label
                      key={value}
                      className="border rounded-lg p-4 cursor-pointer has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="country"
                        value={value}
                        defaultChecked={value === "DZ"}
                        className="sr-only"
                      />
                      <div className="font-medium">{label}</div>
                      <div className="text-sm text-slate-500">{sub}</div>
                    </label>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={step1Pending}>
                  {step1Pending ? "Enregistrement…" : "Continuer →"}
                </Button>
              </form>
            </>
          )}

          {/* Étape 2 : Premier entrepôt */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Premier entrepôt
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Créez votre premier lieu de stockage.
                </p>
              </div>
              <form action={step2Action} className="space-y-4">
                {step2Error && (
                  <p className="text-sm text-red-600">{step2Error}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="loc-name">Nom</Label>
                  <Input
                    id="loc-name"
                    name="name"
                    required
                    placeholder="Entrepôt principal"
                    defaultValue="Entrepôt principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "WAREHOUSE", label: "Entrepôt" },
                      { value: "STORE", label: "Boutique" },
                      { value: "VIRTUAL", label: "Virtuel" },
                    ].map(({ value, label }) => (
                      <label
                        key={value}
                        className="border rounded-lg p-3 text-center cursor-pointer text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="type"
                          value={value}
                          defaultChecked={value === "WAREHOUSE"}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={step2Pending}>
                  {step2Pending ? "Enregistrement…" : "Continuer →"}
                </Button>
              </form>
            </>
          )}

          {/* Étape 3 : Premier produit */}
          {step === 3 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Premier produit
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Ajoutez un produit pour commencer.
                </p>
              </div>
              <form action={step3Action} className="space-y-4">
                {step3Error && (
                  <p className="text-sm text-red-600">{step3Error}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / Référence</Label>
                    <Input
                      id="sku"
                      name="sku"
                      required
                      placeholder="PROD-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-name">Nom du produit</Label>
                    <Input
                      id="prod-name"
                      name="name"
                      required
                      placeholder="Mon premier produit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Prix d&apos;achat HT</Label>
                    <Input
                      id="costPrice"
                      name="costPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellPrice">Prix de vente HT</Label>
                    <Input
                      id="sellPrice"
                      name="sellPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={step3Pending}>
                  {step3Pending ? "Enregistrement…" : "Terminer et accéder au dashboard →"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer `app/onboarding/page.tsx`**

```tsx
import { requireTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default async function OnboardingPage() {
  const { tenant } = await requireTenant();

  // Si le tenant a déjà au moins un produit → onboarding terminé
  const productCount = await db.product.count({
    where: { tenantId: tenant.id },
  });
  if (productCount > 0) redirect("/dashboard");

  return <OnboardingWizard />;
}
```

- [ ] **Step 4: Tester le flow complet**

```bash
npm run dev
```

1. S'inscrire → doit rediriger vers `/onboarding`
2. Étape 1 : choisir France → cliquer Continuer
3. Étape 2 : créer "Boutique Paris" (type Store) → cliquer Continuer
4. Étape 3 : SKU=`SHIRT-001`, Nom=`T-Shirt`, costPrice=`10`, sellPrice=`25` → cliquer Terminer
5. Doit rediriger vers `/dashboard`
6. Revenir sur `/onboarding` → doit rediriger vers `/dashboard` (déjà complété)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 3-step onboarding wizard (country, warehouse, product)"
```

---

### Task 8: Error Boundaries & Loading States

**Files:**
- Create: `app/global-error.tsx`
- Create: `app/error.tsx`
- Create: `app/dashboard/error.tsx`
- Create: `app/dashboard/loading.tsx`

- [ ] **Step 1: Créer `app/global-error.tsx`**

Cette boundary catch les erreurs dans le root layout. Elle DOIT inclure `<html>` et `<body>`.

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">
              Erreur critique
            </h1>
            <p className="text-slate-500 text-sm">
              Une erreur inattendue s&apos;est produite.
            </p>
            {error.digest && (
              <p className="text-xs text-slate-400 font-mono">
                ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Créer `app/error.tsx`**

Cette boundary catch les erreurs dans le root layout enfants. PAS de `<html>` ni `<body>`.

```tsx
"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <AlertCircle
          className="h-12 w-12 text-red-500 mx-auto"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold text-slate-900">
          Quelque chose s&apos;est mal passé
        </h2>
        <p className="text-slate-500 text-sm">
          {error.message || "Une erreur inattendue s'est produite."}
        </p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer `app/dashboard/error.tsx`**

```tsx
"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <AlertCircle
          className="h-10 w-10 text-red-500 mx-auto"
          aria-hidden="true"
        />
        <p className="text-slate-600 text-sm">
          {error.message || "Erreur lors du chargement."}
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Créer `app/dashboard/loading.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-white rounded-xl border p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-6 space-y-3">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build final**

```bash
npm run build
```

Attendu : `✓ Compiled successfully` sans erreurs TypeScript.

- [ ] **Step 6: Lancer les tests**

```bash
npx jest
```

Attendu : PASS — 4 tests passed (utils.test.ts).

- [ ] **Step 7: Commit final Plan 1**

```bash
git add -A
git commit -m "feat: error boundaries and loading skeletons — Plan 1 complete"
```

---

## Vérification finale Plan 1

Après tous les commits, vérifier :

- [ ] `npm run build` passe sans erreurs
- [ ] `npx jest` — tous les tests passent
- [ ] `npx tsc --noEmit` — aucune erreur TypeScript
- [ ] Flow manuel : register → onboarding 3 étapes → dashboard avec sidebar
- [ ] Middleware : `/dashboard` sans cookie → redirige vers `/login`
- [ ] Middleware : `/login` connecté → redirige vers `/dashboard`

---

## Prochain plan

**Plan 2 — Catalogue** couvrira :
- CRUD Produits (liste, détail, création, modification, soft-delete)
- CRUD Catégories
- CRUD Fournisseurs
- Association Produit ↔ Fournisseurs
- Génération étiquettes barcode (bwip-js)
- API routes RBAC (WAREHOUSE_STAFF ne voit pas costPrice)
