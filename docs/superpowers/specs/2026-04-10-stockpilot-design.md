# StockPilot — Design Spec V1

**Date :** 2026-04-10
**Statut :** Approuvé
**Marché :** Algérie (DZD) + France (EUR) — Interface française uniquement
**Cible :** Entreprises multi-canal (boutique physique + e-commerce + grossiste)
**Positionnement :** Simple à démarrer (< 10 min) + tout en un

---

## 1. Vision

StockPilot est un SaaS de gestion de stock moderne destiné aux PME algériennes et françaises multi-canal. Il remplace OmniGestion en proposant une fondation technique solide (stock_movements immutable, multi-entrepôts natif, RBAC 3 rôles) avec une UX sans friction.

**Différenciateurs :**
- Démarrage en moins de 10 minutes sans formation
- Gestion unifiée boutique physique + e-commerce + grossiste
- Scanner PWA : le smartphone devient une douchette de stock
- Dark mode natif, UI moderne (Shadcn)

---

## 2. Stack Technique

| Couche | Choix | Justification |
|---|---|---|
| Frontend | Next.js 15 App Router + TypeScript strict | Maîtrise équipe, SSR natif |
| UI | Tailwind CSS + Shadcn UI | Dark mode natif, composants accessibles |
| Auth | Supabase Auth natif | JWT avec tenantId, RLS possible |
| Base de données | PostgreSQL via Supabase | RLS, transactions, fiabilité |
| ORM | Prisma | Typage fort, migrations versionnées |
| Cache | Upstash Redis | KPIs dashboard (TTL 5 min) |
| Jobs asynchrones | Upstash QStash | Alertes, rapports, tâches longues |
| Temps réel | Supabase Realtime | Stock live entre utilisateurs |
| Stockage fichiers | Supabase Storage | Photos produits, PDFs |
| PDF | React-PDF | Serverless-safe, PO/SO export |
| Scan barcodes | zxing-js | Camera API browser |
| Génération barcodes | bwip-js | EAN-13, QR code pour étiquettes |
| PWA | Serwist | next-pwa abandonné, Serwist = fork actif |
| Déploiement | Vercel | CI/CD automatique |

**Sécurité multi-tenant :**
- Prisma filtre `tenantId` dans CHAQUE requête (couche applicative)
- RLS Supabase comme filet de sécurité secondaire
- Middleware Next.js vérifie JWT + tenantId à chaque requête API

---

## 3. Modèle de Données

### Règles fondamentales
1. **`stock_movements` est append-only** — jamais de UPDATE ou DELETE. Pour corriger : mouvement inverse.
2. **`inventory_levels`** = état actuel mis à jour par transaction atomique à chaque mouvement.
3. **`unitCost` snapshottée** sur `SalesOrderItem` — la marge historique reste exacte même si le coût change.
4. **Toutes les tables** ont `tenantId` — isolation logique garantie.

### Schéma Prisma complet

```prisma
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
  id          String   @id @default(cuid())
  tenantId    String
  supabaseId  String   @unique  // Lien vers auth.users de Supabase
  email       String
  name        String
  role        UserRole @default(WAREHOUSE_STAFF)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

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
// RECEIVE   → from=null,  to=entrepôt  → InventoryLevel[to] += quantity
// SHIP      → from=entrepôt, to=null   → InventoryLevel[from] -= quantity
// TRANSFER  → from=A, to=B             → InventoryLevel[A] -= quantity, InventoryLevel[B] += quantity
// ADJUSTMENT/LOSS → from=entrepôt, to=null → InventoryLevel[from] -= quantity
enum MovementType { RECEIVE  SHIP  TRANSFER  ADJUSTMENT  LOSS }

// ─── ACHATS ──────────────────────────────────────────

model PurchaseOrder {
  id          String   @id @default(cuid())
  tenantId    String
  supplierId  String
  locationId  String   // Entrepôt de destination de la réception
  number      String
  status      POStatus @default(DRAFT)
  expectedAt  DateTime?
  receivedAt  DateTime?
  notes       String?
  subtotal    Decimal  @db.Decimal(10, 2)
  taxAmount   Decimal  @db.Decimal(10, 2)
  total       Decimal  @db.Decimal(10, 2)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

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
  locationId   String
  quantity     Int
  unitPrice    Decimal @db.Decimal(10, 2)
  unitCost     Decimal @db.Decimal(10, 2)
  taxRate      Float
  total        Decimal @db.Decimal(10, 2)

  salesOrder SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  product    Product    @relation(fields: [productId], references: [id])

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

---

## 4. Modules & Fonctionnalités V1

### Auth & Onboarding
- Inscription email/password via Supabase Auth
- Invitation membres d'équipe par email
- Onboarding guidé 3 étapes : devise → premier entrepôt → premier produit
- Page de connexion, oubli de mot de passe

### Catalogue
- CRUD produits (SKU unique, costPrice, sellPrice, barcode, photo, TVA, seuil low stock)
- CRUD catégories avec couleur
- CRUD fournisseurs
- Association produit ↔ fournisseurs (plusieurs fournisseurs par produit, `isPreferred`)
- Génération étiquette barcode (EAN-13 / QR) imprimable

### Entrepôts (Locations)
- CRUD locations (WAREHOUSE / STORE / VIRTUAL)
- Vue stock par location
- Transfert inter-entrepôts

### Stock
- Réception manuelle (sans PO)
- Ajustement inventaire (correction physique)
- Transfert entre locations
- Historique mouvements filtrable par produit / type / date
- Règle : stock ne peut pas passer en négatif

### Purchase Orders (Achats)
- Créer PO → sélectionner fournisseur → ajouter lignes produits
- Statuts : DRAFT → SENT → PARTIAL → RECEIVED → CANCELLED
- Réception partielle (quantityReceived < quantityOrdered)
- Export PDF bon de commande
- Numérotation auto (PO-00001, PO-00002…)

### Sales Orders (Ventes)
- Créer SO → choisir canal (IN_STORE / ONLINE / WHOLESALE)
- Ajouter lignes produits + choisir entrepôt source
- Vérification stock disponible avant confirmation
- Statuts : DRAFT → CONFIRMED → SHIPPED → DELIVERED → CANCELLED
- Export PDF bon de livraison / facture
- Numérotation auto (SO-00001…)

### Dashboard
- KPIs : CA, Profit brut, Valeur stock immobilisée, Taux de rotation
- Charts filtrables : Jour / Semaine / Mois / Année
- Top 5 produits vendus
- Alertes low stock actives
- Mouvements récents

### Scanner PWA
- Installable sur iOS/Android (Serwist)
- Scan barcode via caméra → fiche produit instantanée
- Actions rapides : réception rapide / vente rapide / ajustement
- Fonctionne en réseau bas débit (cache Serwist)

### Paramètres
- Profil organisation (nom, logo, adresse, devise)
- Gestion utilisateurs (inviter, changer rôle, désactiver)
- Préfixes numérotation (PO-, SO-)
- Plan & facturation

---

## 5. RBAC — Matrice des permissions

| Fonctionnalité | ADMIN | MANAGER | WAREHOUSE_STAFF |
|---|---|---|---|
| Dashboard financier (marges, profits) | ✅ | ✅ | ❌ |
| Voir `costPrice` des produits | ✅ | ✅ | ❌ |
| Créer / modifier / supprimer produits | ✅ | ✅ | ❌ |
| Gérer catégories & fournisseurs | ✅ | ✅ | ❌ |
| Créer Purchase Orders | ✅ | ✅ | ❌ |
| Réceptionner marchandises | ✅ | ✅ | ✅ |
| Créer Sales Orders | ✅ | ✅ | ✅ |
| Scanner PWA | ✅ | ✅ | ✅ |
| Ajustement / transfert stock | ✅ | ✅ | ✅ |
| Voir historique mouvements | ✅ | ✅ | ✅ (sans coûts) |
| Gérer utilisateurs | ✅ | ❌ | ❌ |
| Paramètres organisation | ✅ | ❌ | ❌ |
| Voir plan & facturation | ✅ | ❌ | ❌ |

**Règle d'implémentation :** `costPrice`, `unitCost`, marges et profits ne sont jamais envoyés au frontend si `role === WAREHOUSE_STAFF` — filtrage au niveau API, pas dans le JSX.

---

## 6. Flux Critiques

### Flux 1 — Réception de marchandises (via PO)
```
PO en statut SENT
  → Clic "Réceptionner"
  → Saisie quantités reçues par ligne
  → Transaction DB atomique :
      1. StockMovement (RECEIVE, from: null, to: location, qty: +N)
      2. UPSERT InventoryLevel (+N)
      3. PurchaseOrderItem.quantityReceived += N
      4. Si tout reçu → PO.status = RECEIVED
         Sinon → PO.status = PARTIAL
  → QStash : vérifier alertes LOW_STOCK à résoudre
  → Supabase Realtime : notifier dashboard
```

### Flux 2 — Vente comptoir (IN_STORE)
```
Staff ouvre SO ou Scanner PWA
  → Scan/sélection produit
  → Vérification : InventoryLevel.quantity >= quantité demandée
  → Si insuffisant → erreur bloquante (jamais de stock négatif)
  → Transaction DB atomique :
      1. StockMovement (SHIP, from: location, to: null, qty: N)
      2. InventoryLevel -= N
      3. SalesOrderItem créé avec snapshot unitCost
      4. SalesOrder.status = DELIVERED (vente immédiate)
  → QStash : vérifier seuil low_stock_threshold → créer Alert si atteint
  → Supabase Realtime : mise à jour stock live
```

### Flux 3 — Transfert inter-entrepôts
```
Manager sélectionne produit + source + destination + quantité
  → Vérification stock source suffisant
  → Transaction DB atomique :
      1. StockMovement (TRANSFER, from: source, to: dest, qty: N)
      2. InventoryLevel source -= N
      3. InventoryLevel destination += N
  → Supabase Realtime : notifie les deux locations
```

### Flux 4 — Alerte Low Stock (asynchrone)
```
QStash reçoit job "check-low-stock" (déclenché post-vente)
  → Lit InventoryLevel pour le produit
  → Compare avec Product.lowStockThreshold
  → Si quantity <= threshold ET pas d'Alert active :
      Crée Alert (LOW_STOCK)
  → Si quantity == 0 :
      Crée Alert (OUT_OF_STOCK)
  → Dashboard affiche badge rouge
```

---

## 7. KPIs Dashboard

| KPI | Formule | Cache Redis | Visible |
|---|---|---|---|
| Chiffre d'affaires | Σ `SalesOrderItem.total` sur période | 5 min | Admin + Manager |
| Profit brut | CA - Σ(`qty × unitCost`) | 5 min | Admin + Manager |
| Valeur stock immobilisée | Σ(`InventoryLevel.qty × Product.costPrice`) | 5 min | Admin + Manager |
| Taux de rotation | Σ ventes / stock moyen sur période | 5 min | Admin + Manager |
| Produits en rupture | `InventoryLevel.quantity = 0` | Pas de cache | Tous |
| Top 5 produits | Σ quantités vendues sur période | 5 min | Admin + Manager |
| Alertes actives | `Alert.isRead = false` | Pas de cache | Tous |

---

## 8. Structure des Dossiers (Next.js 15)

```
stockpilot/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── onboarding/
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Dashboard KPIs
│   │   ├── produits/
│   │   ├── entrepots/
│   │   ├── stock/
│   │   │   ├── reception/
│   │   │   ├── ajustement/
│   │   │   ├── transfert/
│   │   │   └── historique/
│   │   ├── achats/           ← Purchase Orders
│   │   ├── ventes/           ← Sales Orders
│   │   ├── fournisseurs/
│   │   └── parametres/
│   ├── scanner/              ← PWA Scanner (mobile)
│   └── api/
│       ├── auth/
│       ├── produits/
│       ├── entrepots/
│       ├── stock/
│       │   └── move/
│       ├── achats/
│       ├── ventes/
│       └── dashboard/
├── components/
│   ├── ui/                   ← Shadcn primitives
│   ├── dashboard/
│   ├── stock/
│   ├── scanner/
│   └── forms/
├── lib/
│   ├── db.ts                 ← Prisma client
│   ├── auth.ts               ← Supabase Auth helpers
│   ├── redis.ts              ← Upstash Redis
│   ├── qstash.ts             ← Upstash QStash
│   ├── utils.ts
│   └── validators/           ← Schémas Zod par module
├── middleware.ts              ← Vérifie JWT Supabase + tenantId à chaque requête API
├── prisma/
│   └── schema.prisma
└── public/
    └── manifest.json         ← PWA manifest
```

---

## 9. Ce qui est exclu du V1 (prévu V2+)

| Feature | Version | Raison |
|---|---|---|
| Intégration Shopify | V2 | App Store approval requis |
| Intégration WooCommerce | V2 | Complexité OAuth + webhooks |
| Intégration Youcan (DZ) | V2 | API moins documentée |
| AI Forecasting | V3 | Nécessite 6+ mois de données |
| Réapprovisionnement autonome | V3 | Risque légal (achat sans validation) |
| Multi-devises par transaction | V2 | Complexité comptable |
| Application mobile native | V2 | PWA suffit pour V1 |
| Import/export Shopify CSV | V2 | Demande à valider |
| Import CSV produits | V2 | Validation format + gestion erreurs complexe |
