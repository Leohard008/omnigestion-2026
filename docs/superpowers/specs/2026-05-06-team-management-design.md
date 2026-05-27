# OmniGestion — Module Gestion d'Équipe (Design)

**Date :** 2026-05-06
**Statut :** Spec validée, en attente de plan d'implémentation
**Cible :** OmniGestion (Next.js 15 + Prisma + Supabase + NextAuth + Redis)

---

## 1. Vue d'ensemble

### Objectif

Permettre aux managers et admins d'OmniGestion de suivre la productivité réelle de leur équipe via trois métriques DORA-style — **temps avant démarrage**, **temps d'exécution**, **débit** — sans tomber dans le flicage individuel.

### Périmètre fonctionnel MVP

- Tâches génériques (titre, description, échéance, priorité, estimation), 100 % standalone (non liées aux entités existantes Client/Facture/Devis/Produit)
- Organisation en équipes — chaque tâche appartient obligatoirement à une équipe
- 4 niveaux d'accès : `OWNER`, `ADMIN`, `MANAGER` (par équipe), `MEMBER` ; `VIEWER` n'a aucun accès au module
- Workflow 5 statuts : `TODO` → `IN_PROGRESS` ⇄ `BLOCKED` → `DONE` (+ `CANCELLED`)
- Timer actif unique par utilisateur, auto-couplé au statut, édition manuelle possible avec garde-fous
- 3 dashboards : collaborateur, manager/admin, détail tâche
- Notifications in-app uniquement
- Cache Redis 5 min sur les métriques agrégées équipe

### Hors scope MVP (explicite)

À ne pas implémenter dans cette première itération :

- Email / push notifications
- Sous-tâches, dépendances entre tâches
- Commentaires, pièces jointes, tags personnalisés
- Liens vers Client / Facture / Devis / Produit (entités OmniGestion existantes)
- Tâches récurrentes, templates de tâche
- Vues kanban / calendrier / Gantt
- Export PDF / CSV
- Plage de dates personnalisée (sélecteur prédéfini uniquement)
- Time tracking automatisé via mouse/keyboard activity (volontairement écarté — incompatible avec l'anti-flicage)
- Intégration calendrier externe (Google/Outlook)

---

## 2. Modèle de données

Sept nouveaux modèles Prisma à ajouter dans `prisma/schema.prisma`.

### Schéma Prisma complet

```prisma
// ─── TEAMS ────────────────────────────────────────────────────

enum TeamRole {
  MANAGER
  MEMBER
}

model Team {
  id              String       @id @default(cuid())
  organizationId  String
  name            String
  description     String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members         TeamMember[]
  tasks           Task[]

  @@unique([organizationId, name])
  @@index([organizationId])
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole @default(MEMBER)
  joinedAt  DateTime @default(now())

  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([userId])
}

// ─── TASKS ────────────────────────────────────────────────────

enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Task {
  id              String       @id @default(cuid())
  organizationId  String       // dénormalisé pour le filtre tenant
  teamId          String       // immutable après création
  title           String
  description     String?
  assigneeId      String       // obligatoire à la création
  createdById     String
  dueDate         DateTime?
  priority        TaskPriority @default(MEDIUM)
  estimatedHours  Decimal?     @db.Decimal(6, 2)
  status          TaskStatus   @default(TODO)   // matérialisé
  startedAt       DateTime?    // 1er passage IN_PROGRESS
  completedAt     DateTime?    // passage DONE
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  team            Team         @relation(fields: [teamId], references: [id], onDelete: Restrict)
  assignee        User         @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: Restrict)
  createdBy       User         @relation("TaskCreator", fields: [createdById], references: [id], onDelete: Restrict)
  events          TaskEvent[]
  sessions        TimerSession[]
  notifications   TaskNotification[]

  @@index([organizationId, status])
  @@index([teamId, status])
  @@index([assigneeId, status])
  @@index([dueDate])
}

// ─── EVENTS (append-only) ─────────────────────────────────────

enum TaskEventType {
  STATUS_CHANGE
  REASSIGNMENT
  FIELD_EDIT
}

model TaskEvent {
  id              String        @id @default(cuid())
  taskId          String
  eventType       TaskEventType

  // Pour STATUS_CHANGE
  fromStatus      TaskStatus?
  toStatus        TaskStatus?

  // Pour REASSIGNMENT
  fromAssigneeId  String?
  toAssigneeId    String?

  // Pour FIELD_EDIT (json simplifié)
  fieldName       String?       // 'dueDate' | 'priority' | 'estimatedHours' | 'title' | 'description'
  oldValue        String?       // sérialisé en string
  newValue        String?

  byUserId        String        // qui a déclenché
  at              DateTime      @default(now())
  reason          String?       // raison du blocage / commentaire édition

  task            Task          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  byUser          User          @relation(fields: [byUserId], references: [id])

  @@index([taskId, at])
}

// ─── TIMER SESSIONS ───────────────────────────────────────────

model TimerSession {
  id              String    @id @default(cuid())
  taskId          String
  userId          String    // = utilisateur qui a effectué le travail (frozen, ne suit PAS les réassignations)
  startedAt       DateTime
  endedAt         DateTime? // null = en cours
  durationSeconds Int?      // figé à la clôture
  isEdited        Boolean   @default(false)
  editLockedAt    DateTime? // = endedAt + 24h, calculé à la clôture
  createdAt       DateTime  @default(now())

  task            Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  edits           TimerSessionEdit[]

  @@index([userId, startedAt])
  @@index([taskId, startedAt])
}

model TimerSessionEdit {
  id              String       @id @default(cuid())
  sessionId       String
  editedById      String
  oldStartedAt    DateTime
  newStartedAt    DateTime
  oldEndedAt      DateTime?
  newEndedAt      DateTime?
  oldDurationSec  Int?
  newDurationSec  Int?
  reason          String?
  editedAt        DateTime     @default(now())

  session         TimerSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  editedBy        User         @relation(fields: [editedById], references: [id])

  @@index([sessionId, editedAt])
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

enum NotificationType {
  TASK_ASSIGNED
  TASK_OVERDUE
  TASK_BLOCKED_LONG
  TASK_ANOMALY
}

model TaskNotification {
  id              String           @id @default(cuid())
  organizationId  String           // dénormalisé pour filtrage tenant
  recipientId     String
  taskId          String
  type            NotificationType
  message         String
  readAt          DateTime?
  createdAt       DateTime         @default(now())

  organization    Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  recipient       User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  task            Task             @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([recipientId, readAt])
  @@index([organizationId])
}
```

### Décisions clés du modèle

1. **`TaskEvent` est append-only** — comme `stock_movements` dans StockPilot. Source de vérité pour la timeline. Trois types d'événements : `STATUS_CHANGE`, `REASSIGNMENT`, `FIELD_EDIT`.
2. **Timestamps matérialisés sur `Task`** (`status`, `startedAt`, `completedAt`) — évite de scanner `TaskEvent` à chaque listing. Mis à jour dans la même transaction que la création de l'event.
3. **`TimerSession.editLockedAt`** = `endedAt + 24h`, calculé à la clôture, vérifié côté API avant tout edit par un MEMBER.
4. **`TimerSession.userId` est frozen** — il représente la personne qui a réellement effectué le travail. Une réassignation de tâche ne change PAS le `userId` des sessions historiques. Garantit que les métriques individuelles restent cohérentes après une réassignation.
5. **`organizationId` dénormalisé** sur `Task` ET `TaskNotification` — toutes les requêtes filtrent par tenant en O(1).
6. **`Task.teamId` immutable** — pour transférer une tâche entre équipes, on annule (`CANCELLED`) et recrée. Préserve l'intégrité de la timeline.
7. **`Task.assigneeId` obligatoire** — pas de tâches orphelines en backlog. La réassignation est traçable via `TaskEvent` type `REASSIGNMENT`.
8. **Pas de modification du modèle `OrganizationMember` existant** — le rôle `MANAGER` est porté par `TeamMember.role`, pas par un nouveau rôle d'org.

---

## 3. Architecture & flux techniques

### Arborescence dans OmniGestion

```
app/(dashboard)/equipe/
├── page.tsx                       # Vue collaborateur (mes tâches)
├── manager/page.tsx               # Vue manager/admin (tableau d'équipe)
├── taches/[id]/page.tsx           # Vue détail tâche (timeline)
└── equipes/                       # Setup teams (admin/owner uniquement)
    ├── page.tsx
    └── [id]/page.tsx

app/api/
├── tasks/
│   ├── route.ts                   # GET (liste), POST (créer)
│   └── [id]/
│       ├── route.ts               # GET, PATCH (champs), DELETE
│       ├── status/route.ts        # POST (changer statut → TaskEvent + transitions timer)
│       ├── assign/route.ts        # POST (réassigner → TaskEvent type REASSIGNMENT)
│       └── timer/
│           ├── start/route.ts     # POST
│           ├── stop/route.ts      # POST
│           └── sessions/[sessionId]/route.ts  # PATCH (édition avec audit)
├── teams/
│   ├── route.ts
│   └── [id]/members/route.ts
├── metrics/
│   ├── member/[userId]/route.ts   # métriques individuelles
│   └── team/[teamId]/route.ts     # métriques équipe (cache Redis 5 min)
├── notifications/
│   ├── route.ts                   # GET liste
│   └── [id]/read/route.ts         # POST marquer lu
└── cron/
    └── team-anomalies/route.ts    # Vercel Cron 1×/h

lib/
├── tasks/
│   ├── permissions.ts             # canViewTask, canEditTask, canAssignTask...
│   ├── transitions.ts             # statusTransition() → TaskEvent + maj Task atomique
│   ├── timer.ts                   # startTimer, stopTimer, editSession (avec audit)
│   ├── metrics.ts                 # computeCycleTime, computeLeadTime, computeThroughput
│   └── anomalies.ts               # détection des 5 règles d'anomalie
└── redis.ts                       # déjà existant — on ajoute getMetricsCache/setMetricsCache

components/tasks/
├── TaskCard.tsx
├── TimerWidget.tsx                # bouton flottant en bas à droite
├── TaskDetailTimeline.tsx
├── MetricsBoard.tsx               # dashboard manager
└── HeatmapMatrix.tsx              # matrice 2x2 manager
```

### Flux critique 1 — Changement de statut + timer auto-couplé

```
User clique "Démarrer"
  ↓
POST /api/tasks/{id}/status { toStatus: IN_PROGRESS }
  ↓ Transaction Prisma
  1. Vérifier permission (canTransition)
  2. Créer TaskEvent { eventType: STATUS_CHANGE, fromStatus, toStatus, byUserId, at: now() }
  3. Update Task.status, Task.startedAt (si null)
  4. Si toStatus = IN_PROGRESS :
     - Vérifier qu'aucun TimerSession actif pour ce user (1 seul autorisé)
     - Si autre timer actif sur AUTRE tâche → l'arrêter automatiquement
     - Créer TimerSession { userId, taskId, startedAt: now() }
  5. Si toStatus = BLOCKED ou DONE :
     - Clore TimerSession actif (endedAt, durationSeconds, editLockedAt = endedAt + 24h)
  ↓
Invalider cache Redis : DEL metrics:org:{orgId}:*
  ↓
Retour 200 + nouvel état
```

### Flux critique 2 — Édition d'une session timer

```
Manager/User édite session (durée corrigée)
  ↓
PATCH /api/tasks/{id}/timer/sessions/{sessionId}
  body: { newStartedAt, newEndedAt, reason }
  ↓
1. Permission : assignee (≤ 24h après endedAt) OU manager/admin (toujours)
2. Si TimerSession.editLockedAt < now() ET role = MEMBER → 403
3. Transaction :
   - Créer TimerSessionEdit avec old/new values
   - Update TimerSession (newStartedAt, newEndedAt, durationSeconds, isEdited=true)
4. Invalider cache Redis métriques
```

### Flux critique 3 — Lecture métriques équipe (avec cache)

```
GET /api/metrics/team/{teamId}?period=30d
  ↓
1. Vérifier requireManagerOrAdmin(teamId)
2. Lire Redis : metrics:team:{teamId}:30d
3. Si HIT → retour direct (~5ms)
4. Si MISS :
   - Requête Prisma agrégée sur Task + TaskEvent + TimerSession (période 30j)
   - Calculer pour chaque membre : cycleTimeMedian, leadTimeMedianToStart,
     throughput, wipCount, flowEfficiency, anomalies
   - SET Redis avec EX 300 (5 min)
   - Retour
```

### Pattern de filtrage tenant

Toutes les requêtes Prisma sur `Task`/`TaskEvent`/`TimerSession`/`TaskNotification` filtrent **systématiquement** par `organizationId` extrait de la session NextAuth. Helper centralisé `getTenantContext()` :

```ts
const ctx = await getTenantContext()
// ctx = { userId, orgId, orgRole, teamRoles: Map<teamId, TeamRole> }

const tasks = await db.task.findMany({
  where: { organizationId: ctx.orgId, /* ... */ }
})
```

### Composants côté client

- `<TimerWidget />` — bouton flottant bas-droite, affiche la tâche active si timer en cours, polling 30s pour synchro
- `<TaskCard />` — utilisé dans liste (MVP : pas de kanban drag & drop)
- `<TaskDetailTimeline />` — timeline verticale TaskEvent (3 types) + TimerSession + TimerSessionEdit
- `<MetricsBoard />` — dashboard manager, cartes par métrique
- `<HeatmapMatrix />` — matrice 2x2 (axes : lead time × cycle time)

### Note de performance polling

`TimerWidget` poll toutes les 30s. À 1 000 utilisateurs actifs simultanés = 33 req/s sur OmniGestion. Acceptable pour cible PME (< 50 utilisateurs concurrents). Si problème futur, basculer vers Server-Sent Events.

---

## 4. Matrice RBAC complète

Convention : ✅ autorisé · ❌ refusé · 🟡 conditionnel.
**`VIEWER` n'a aucun accès au module gestion-équipe** — non listé dans les tableaux.

### Gestion des équipes

| Action                      | OWNER | ADMIN | MANAGER (de l'équipe) | MANAGER (autre équipe) | MEMBER |
|-----------------------------|:-----:|:-----:|:---------------------:|:----------------------:|:------:|
| Créer une équipe            | ✅    | ✅    | ❌                    | ❌                     | ❌     |
| Renommer / supprimer équipe | ✅    | ✅    | ❌                    | ❌                     | ❌     |
| Ajouter / retirer un membre | ✅    | ✅    | ✅ (dans son équipe)  | ❌                     | ❌     |
| Désigner un manager         | ✅    | ✅    | ❌                    | ❌                     | ❌     |
| Voir liste des équipes      | ✅    | ✅    | ✅ (les siennes)      | ✅ (les siennes)       | ✅ (celles où il est) |

### Tâches — création et édition

| Action                                  | OWNER | ADMIN | MANAGER (équipe) | MANAGER (autre) | MEMBER |
|-----------------------------------------|:-----:|:-----:|:----------------:|:---------------:|:------:|
| Créer une tâche dans l'équipe           | ✅    | ✅    | ✅               | ❌              | ❌     |
| Assigner à un membre de l'équipe        | ✅    | ✅    | ✅               | ❌              | ❌     |
| Éditer titre / description              | ✅    | ✅    | ✅               | ❌              | ❌     |
| Éditer dueDate / priority / estimate    | ✅    | ✅    | ✅               | ❌              | ❌     |
| Réassigner (membre de **la même équipe**) | ✅  | ✅    | ✅               | ❌              | ❌     |
| Changer `teamId` après création         | ❌    | ❌    | ❌               | ❌              | ❌     |
| Supprimer la tâche                      | ✅    | ✅    | ❌               | ❌              | ❌     |
| Annuler la tâche (`CANCELLED`)          | ✅    | ✅    | ✅               | ❌              | ❌     |

### Tâches — exécution (statuts)

| Action                                       | OWNER | ADMIN | MANAGER (équipe) | MEMBER (assignee) | MEMBER (autre) |
|----------------------------------------------|:-----:|:-----:|:----------------:|:-----------------:|:--------------:|
| Voir la tâche                                | ✅    | ✅    | ✅               | ✅                | ❌             |
| Voir la timeline complète                    | ✅    | ✅    | ✅               | ✅                | ❌             |
| `TODO` → `IN_PROGRESS`                       | ✅    | ✅    | ✅               | ✅                | ❌             |
| `IN_PROGRESS` → `BLOCKED` (raison)           | ✅    | ✅    | ✅               | ✅                | ❌             |
| `BLOCKED` → `IN_PROGRESS`                    | ✅    | ✅    | ✅               | ✅                | ❌             |
| `IN_PROGRESS` → `DONE`                       | ✅    | ✅    | ✅               | ✅                | ❌             |

> Le manager peut forcer un changement de statut à la place du collaborateur (utile si l'assignee est en congé).

### Transitions de statut autorisées

Graphe complet des transitions valides (rejetées au niveau API si non listées) :

| Depuis        | Transitions autorisées                          |
|---------------|-------------------------------------------------|
| `TODO`        | `IN_PROGRESS`, `CANCELLED`                      |
| `IN_PROGRESS` | `BLOCKED`, `DONE`, `CANCELLED`                  |
| `BLOCKED`     | `IN_PROGRESS`, `CANCELLED`                      |
| `DONE`        | terminal — aucune transition (réouverture hors MVP) |
| `CANCELLED`   | terminal — aucune transition                    |

L'annulation (`→ CANCELLED`) est restreinte à OWNER/ADMIN/MANAGER (cf. tableau "Création et édition" ci-dessus). Toutes les autres transitions sont accessibles à l'assignee.

### Timer

L'axe principal pour le timer est **assignee vs non-assignee**, peu importe le rôle d'org.

| Action                                       | Soi-même (assignee) | Manager équipe | Admin/Owner | Autre membre |
|----------------------------------------------|:-------------------:|:--------------:|:-----------:|:------------:|
| Démarrer son timer (sa propre tâche)         | ✅                  | n/a            | n/a         | ❌           |
| Arrêter son timer                            | ✅                  | n/a            | n/a         | ❌           |
| Éditer une session ≤ 24h après endedAt       | ✅                  | ✅             | ✅          | ❌           |
| Éditer une session > 24h après endedAt       | ❌ (verrouillée)    | ✅ (avec audit) | ✅ (avec audit) | ❌      |
| Voir le détail des sessions                  | ✅ (les siennes)    | ✅             | ✅          | ❌           |
| Voir l'historique d'édition                  | ✅ (les siennes)    | ✅             | ✅          | ❌           |

> OWNER/ADMIN sont aussi assignees s'ils ont des tâches assignées à eux-mêmes — ils utilisent alors la colonne "Soi-même".

### Métriques & dashboards

| Action                                       | OWNER | ADMIN | MANAGER (de l'équipe) | MEMBER |
|----------------------------------------------|:-----:|:-----:|:---------------------:|:------:|
| Voir ses propres métriques                   | ✅    | ✅    | ✅                    | ✅     |
| Voir métriques d'un membre de son équipe     | ✅    | ✅    | ✅                    | ❌     |
| Voir métriques de toute l'organisation       | ✅    | ✅    | ❌                    | ❌     |
| Voir le tableau de bord équipe               | ✅    | ✅    | ✅ (ses équipes)      | ❌     |
| Voir les anomalies détectées                 | ✅    | ✅    | ✅ (ses équipes)      | ❌     |

### Notifications

| Action                                       | OWNER | ADMIN | MANAGER | MEMBER |
|----------------------------------------------|:-----:|:-----:|:-------:|:------:|
| Recevoir notif d'assignation                 | ✅    | ✅    | ✅      | ✅     |
| Recevoir `TASK_OVERDUE` (sa propre tâche)    | ✅    | ✅    | ✅      | ✅     |
| Recevoir `TASK_OVERDUE` (équipe)             | ✅    | ✅    | ✅      | ❌     |
| Recevoir `TASK_BLOCKED_LONG` (sa tâche)      | ✅    | ✅    | ✅      | ✅     |
| Recevoir `TASK_BLOCKED_LONG` (équipe)        | ✅    | ✅    | ✅      | ❌     |
| Recevoir `TASK_ANOMALY` (équipe)             | ✅    | ✅    | ✅      | ❌     |
| Marquer comme lu                             | ✅    | ✅    | ✅      | ✅     |

### Notes RBAC

- **Co-managers** : si Manager A et Manager B sont tous deux managers d'une même équipe, ils ont des droits **identiques**. Ils peuvent éditer les tâches l'un de l'autre.
- **RBAC dynamique** : si un Manager M crée une tâche puis est rétrogradé en MEMBER, il perd immédiatement les droits d'édition sur cette tâche, même s'il en est le créateur. Le rôle courant est la source de vérité.
- **Centralisation** : toutes les règles sont implémentées dans `lib/tasks/permissions.ts` sous forme de fonctions pures testables. Aucune logique RBAC dans les composants UI (qui se contentent de cacher les boutons).

```ts
canCreateTask(ctx, teamId): boolean
canEditTask(ctx, task): boolean
canTransitionStatus(ctx, task, fromStatus, toStatus): boolean
canEditTimerSession(ctx, session): boolean
canViewMemberMetrics(ctx, targetUserId): boolean
canManageTeamMembers(ctx, teamId): boolean
```

---

## 5. Formules de métriques

Toutes les métriques se calculent à partir de trois sources : `Task`, `TaskEvent`, `TimerSession`.

### Lead Time to Start

Durée entre la création de la tâche et son passage effectif en `IN_PROGRESS`.

```
leadTimeToStartSeconds = task.startedAt - task.createdAt
```

- Inclus seulement si `startedAt IS NOT NULL`
- Tâches `CANCELLED` jamais démarrées : exclues
- Agrégation membre : médiane (P50). P75 affiché à côté.

### Cycle Time

Durée entre démarrage effectif et complétion.

```
cycleTimeSeconds = task.completedAt - task.startedAt
```

- Inclus seulement si `task.status = DONE`
- Agrégation : P50 + P75

### Throughput

Nombre de tâches `DONE` par membre dans la période.

```sql
SELECT assigneeId, COUNT(*)
FROM Task
WHERE status = 'DONE'
  AND completedAt >= periodStart
  AND organizationId = :orgId
GROUP BY assigneeId
```

### Flow Efficiency

Ratio temps actif (sessions timer) / temps total entre démarrage et complétion.

```
flowEfficiency = sum(timerSession.durationSeconds entre startedAt et completedAt)
                 / (completedAt - startedAt)
```

- < 30 % : la personne est **bloquée**, pas lente. Manager doit débloquer.
- > 80 % : flow très efficace.

### WIP (Work In Progress)

Nombre de tâches actuellement `IN_PROGRESS` ou `BLOCKED` par membre. Calculé live.

```sql
SELECT assigneeId, COUNT(*)
FROM Task
WHERE status IN ('IN_PROGRESS', 'BLOCKED')
  AND organizationId = :orgId
GROUP BY assigneeId
```

- **Cible saine** : 3 tâches max par membre
- **Alerte automatique** : `wipCount > 5` → notif manager (gap volontaire pour ne pas spammer)

### Time spent on task

Somme des `durationSeconds` de toutes les `TimerSession` clôturées d'une tâche.

```sql
SELECT taskId, SUM(durationSeconds)
FROM TimerSession
WHERE taskId = :id AND endedAt IS NOT NULL
```

Permet le ratio `realTime / estimatedHours` pour calibrer les estimations.

### Détection d'anomalies

Cron léger Vercel Cron, 1×/heure :

| Anomalie | Règle | Action |
|----------|-------|--------|
| `TASK_OVERDUE` | `dueDate < now()` ET `status NOT IN (DONE, CANCELLED)` | Notif assignee + manager |
| `TASK_BLOCKED_LONG` | `status = BLOCKED` depuis > 48h | Notif manager + assignee |
| `WIP_EXCESS` | `wipCount(member) > 5` | Notif manager |
| `INCONSISTENT_TIMER` | `(completedAt - startedAt) > 8h` ET `sum(timerSessions) < 2h` | Flag visuel manager (pas de notif) |
| `EXCESSIVE_BLOCKED_RATIO` | tâche DONE avec `temps en BLOCKED / cycle_time > 0.5` | Flag visuel manager |

> Les flags visuels ne génèrent pas de notification. Ils s'affichent en orange neutre dans le dashboard manager pour ouvrir une conversation, jamais comme accusation.

### Heatmap 2x2

Croisement lead time × cycle time pour positionner chaque membre :

```
                lent à démarrer  │  rapide à démarrer
─────────────────┼───────────────┼─────────────────────
lent à exécuter  │  À débloquer   │  Surchargé ?
─────────────────┼───────────────┼─────────────────────
rapide à exécuter│  Inégal        │  Top performer
```

Codes couleur sobres, labels neutres.

> **Tradeoff conscient** : la heatmap est une forme de classement implicite. Elle est volontairement scopée — visible uniquement par OWNER/ADMIN/MANAGER, jamais par les autres MEMBER. Un membre ne voit donc jamais sa position relative à ses collègues.

### Tendance temporelle

Pour le graphique "évolution sur 4 semaines", agrégation hebdomadaire de la médiane cycle time des tâches `DONE` cette semaine-là.

### Note technique

Médiane PostgreSQL : `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ...)`. OK pour < 200 membres × 30 jours. Si problème de perf futur, basculer vers une approche de snapshots quotidiens pré-agrégés.

---

## 6. Les 3 vues UI

### Vue 1 — Collaborateur (`/equipe`)

**Audience** : tous les membres connectés. Page d'accueil du module.
**Période métriques affichées** : fixe **30 jours glissants** (pas de sélecteur sur cette vue).

```
┌──────────────────────────────────────────────────────────────┐
│  Mes tâches                          [+ Nouvelle tâche]*     │
├──────────────────────────────────────────────────────────────┤
│  ┌─ Mes 3 métriques (30 derniers jours) ─────────────────┐  │
│  │  ⏱ Temps avant démarrage médian : 4h                  │  │
│  │  ⚙ Temps d'exécution médian : 6h30                    │  │
│  │  ✓ Tâches terminées : 12                              │  │
│  │  📊 Tendance 4 semaines (mini-graphique)              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Timer actif ─────────────────────────────────────────┐  │
│  │  ▶ Préparer rapport mensuel                           │  │
│  │  Démarré il y a 1h23 · [⏸ Bloquer] [✓ Terminer]      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Mes tâches ──────────────────────────────────────────┐  │
│  │  Filtres : [TODO] [IN_PROGRESS] [BLOCKED] [DONE]      │  │
│  │  Tri : Priorité ▼ | Échéance | Date création          │  │
│  │  ─────────────────────────────────────────────────────│  │
│  │  🟠 [HIGH] Préparer rapport mensuel       Échéance: J+2│  │
│  │  ⚪ [MED]  Relancer fournisseur X         Échéance: J+5│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

\* Bouton "Nouvelle tâche" visible **uniquement** pour OWNER/ADMIN/MANAGER.

**Comportements** :
- Click sur une carte tâche → `/equipe/taches/[id]`
- Bouton "Démarrer" sur une carte TODO → status passe IN_PROGRESS, timer démarre, redirige vers détail
- Bouton **"Bloquer"** (renommé depuis "Pause" pour éviter l'usage abusif type pause café) sur le widget timer → status BLOCKED + popup pour saisir raison
- Le widget timer flotte aussi en bas à droite pendant la navigation sur d'autres pages OmniGestion

### Vue 2 — Manager / Admin (`/equipe/manager`)

**Audience** : OWNER, ADMIN, et MANAGER (limité à leurs équipes).
**Période métriques** : sélecteur 7j / 30j / 90j / 12 mois.

```
┌──────────────────────────────────────────────────────────────┐
│  Tableau d'équipe          Période: [7j] [30j] [90j] [12m]  │
│  Équipe : ▼ Toutes les équipes / Commercial / Atelier        │
├──────────────────────────────────────────────────────────────┤
│  ┌─ Synthèse ───────────────────────────────────────────────┐│
│  │  👥 12 membres actifs                                    ││
│  │  📋 47 tâches actives | ✓ 89 terminées | ⚠ 3 en retard  ││
│  │  ⏱ Cycle time médian équipe : 6h | Lead time : 3h       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Anomalies (3) ──────────────────────────────────────────┐│
│  │  🔵 Pierre — 7 tâches WIP (alerte: 5)                    ││
│  │  🔵 Sarah — tâche "X" bloquée depuis 4 jours             ││
│  │  🔵 Mehdi — tâche "Y" : timer 1h pour 9h en IN_PROGRESS  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Tableau membres ────────────────────────────────────────┐│
│  │ Membre   │ WIP │ Throughput │ Cycle P50 │ Lead P50│ Flow ││
│  │ Pierre   │  7  │     8      │   4h      │  2h     │ 65%  ││
│  │ Sarah    │  2  │    11      │   5h      │  1h     │ 82%  ││
│  │ Mehdi    │  3  │     6      │   9h      │  6h     │ 38%  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Heatmap 2x2 ───────────────────────────────────────────┐ │
│  │ (positionnement visuel des membres sur les 2 axes)      │ │
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Tendance équipe (4 sem.) ──────────────────────────────┐ │
│  │ (graphique ligne : cycle time + throughput)             │ │
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Click ligne membre → drilldown sur ses tâches + ses métriques détaillées
- Click anomalie → ouvre la tâche concernée
- Sélecteur d'équipe : MANAGER multi-équipe choisit ; OWNER/ADMIN voit en plus "Toutes les équipes"
- Couleurs sobres : pas de rouge alarmant. Bleu pour anomalies, gris pour normal, vert clair pour bons indicateurs.

### Vue 3 — Détail tâche (`/equipe/taches/[id]`)

**Audience** : assignee + manager équipe + OWNER/ADMIN.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Retour          [✏ Éditer]* [🗑 Supprimer]**              │
├──────────────────────────────────────────────────────────────┤
│  Préparer rapport mensuel              [HIGH]    [TODO]     │
│  Équipe: Commercial · Assigné: Pierre · Créée par: Marie     │
│  Échéance: 12 mai 2026 · Estimation: 4h                     │
│                                                              │
│  Description : ...                                           │
│                                                              │
│  ┌─ Actions ────────────────────────────────────────────────┐│
│  │  [▶ Démarrer]  [⏸ Bloquer]  [✓ Terminer]  [✕ Annuler]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Métriques tâche ───────────────────────────────────────┐ │
│  │  ⏱ Temps total tracké : 2h45                            │ │
│  │  ⚙ Sessions : 3 (2 honorées, 1 éditée 🔵)               │ │
│  │  📊 vs estimation : 2h45 / 4h (68%)                     │ │
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Timeline ──────────────────────────────────────────────┐ │
│  │ 06 mai 09:30 — Tâche créée par Marie                    │ │
│  │ 06 mai 14:12 — Démarrée par Pierre (TODO → IN_PROGRESS) │ │
│  │    ⏱ Session 1 : 14:12 → 16:30 (2h18)                   │ │
│  │ 06 mai 16:30 — Bloquée par Pierre (raison: "attente X") │ │
│  │ 07 mai 08:00 — 🔄 Réassignée: Pierre → Sarah par Marie  │ │
│  │ 07 mai 09:00 — Reprise par Sarah (BLOCKED → IN_PROGRESS)│ │
│  │    ⏱ Session 2 : 09:00 → 09:27 (27 min, ✏ éditée)       │ │
│  │      ↳ Modifiée par Sarah le 07/05 — 1h00 → 27 min      │ │
│  │ 08 mai 10:00 — ✏ Échéance modifiée par Marie : 10/05 → 12/05│
│  │ ...                                                     │ │
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

\* Bouton "Éditer" : visible pour MANAGER/ADMIN/OWNER
\** Bouton "Supprimer" : OWNER/ADMIN uniquement

**Comportements clés** :
- La timeline est la **source de vérité visuelle** : tous les TaskEvent (STATUS_CHANGE, REASSIGNMENT, FIELD_EDIT) y figurent en ordre chronologique, ainsi que les TimerSession et TimerSessionEdit.
- Sessions éditées : badge 🔵, expandable pour voir l'historique d'édition.
- Anomalie détectée : panneau supérieur neutre du genre "Cette tâche affiche un ratio temps actif/total inhabituel — peut-être une session non clôturée ?"

---

## 7. Garde-fous anti-triche

### Mécanique 1 — Audit log immuable des éditions de timer

Toute modification d'une `TimerSession` génère une ligne `TimerSessionEdit` avec : `oldStartedAt`, `newStartedAt`, `oldEndedAt`, `newEndedAt`, `oldDurationSec`, `newDurationSec`, `editedById`, `editedAt`, `reason`.

**Implémentation** : transaction Prisma — pas d'`UPDATE` sur `TimerSession` sans `INSERT` simultané dans `TimerSessionEdit`. Centralisé dans `lib/tasks/timer.ts:editSession()`.

**Visibilité** :
- Sur la vue détail tâche, chaque session éditée porte un badge 🔵 avec expand pour voir toutes les éditions
- Le manager voit qui a édité, quand, le delta exact
- **Aucune édition ne peut être supprimée** — pas même par OWNER/ADMIN. Append-only.

**Limitation connue** : la suppression d'une `Task` cascade sur `TimerSessionEdit` via `onDelete: Cascade`. Un OWNER/ADMIN peut donc, en pratique, effacer l'audit log timer en supprimant la tâche entière. Tradeoff acceptable pour MVP : la suppression elle-même est rare et tracée par les logs applicatifs Vercel/Supabase.

### Mécanique 2 — Fenêtre d'édition de 24h pour les MEMBER

Calcul à la clôture de la session : `editLockedAt = endedAt + 24h`.

À chaque tentative d'édition par un MEMBER assignee :

```ts
if (now() > session.editLockedAt && ctx.role === 'MEMBER') {
  throw new ForbiddenError('SESSION_EDIT_WINDOW_EXPIRED')
}
```

**Exceptions** :
- MANAGER, ADMIN, OWNER ne sont jamais bloqués par cette fenêtre — mais leur édition est tracée dans le même audit log
- Une session **en cours** (`endedAt IS NULL`) n'est pas figée — éditable tant qu'elle n'est pas clôturée

**UX MEMBER** : sur la vue détail, sessions verrouillées → champ disabled + tooltip "Verrouillée depuis le 07/05 à 14h12 — contactez votre manager pour une correction".

### Mécanique 3 — Détection automatique d'anomalies

Cron Vercel 1×/heure parcourt les tâches actives et `DONE` récentes, applique les 5 règles définies en Section 5.

**Important** : ce sont des **flags neutres**, pas des accusations. Phrase exacte sur le dashboard manager :

> "Cette tâche affiche un ratio temps actif/total inhabituel — peut-être une session non clôturée ?"

Pas de "X triche" ou "X est lent". Juste un signal pour ouvrir une conversation.

### Principe 1 — Pas de classement public

Aucune vue ne montre un Top/Flop des membres. La heatmap 2x2 affiche des positions sans note ni rang, et reste **scopée** : visible uniquement par OWNER/ADMIN/MANAGER.

### Principe 2 — Visibilité scopée des métriques individuelles

Une métrique individuelle d'un membre est visible **seulement** par :
- Le membre lui-même (sa propre métrique)
- Le manager de son équipe
- OWNER / ADMIN de l'org

Un autre MEMBER ne voit jamais les chiffres d'un collègue. Un MANAGER d'une autre équipe non plus.

### Principe 3 — Le dashboard manager met l'accent sur le déblocage

Ordre des sections sur la vue manager :
1. **Synthèse globale équipe** (chiffres bruts neutres)
2. **Anomalies** — ce qui demande une action immédiate (déblocage)
3. **Tableau membres** — données brutes, pas commentées
4. **Heatmap** — positionnement, pas note
5. **Tendance** — courbe de l'équipe entière, pas individuelle

L'anomalie n°1 d'un manager devrait toujours être "qui ai-je à aider", pas "qui dois-je sanctionner".

### Communication transparente

Une **page dédiée** (`/equipe/comment-ca-marche`) documente exactement :
- Liste des champs collectés (statuts, sessions timer, edits)
- Qui voit quoi (matrice RBAC simplifiée pour utilisateurs)
- Durée de rétention (MVP : illimitée tant que le compte existe — à raffiner pour conformité RGPD V2)

Lien "ℹ Comment fonctionne ce module" en footer de chaque vue du module.

---

## 8. Récap, dépendances, risques

### Dépendances OmniGestion existantes

| Dépendance | Existant ? | Usage |
|------------|------------|-------|
| `Organization` + `OrganizationMember` (Prisma) | ✅ | Tenant root, rôles d'org |
| `User` (NextAuth) | ✅ | Identité, lien sur tâches/sessions |
| `db.ts` (Prisma client) | ✅ | Toutes les requêtes |
| `redis.ts` (ioredis) | ✅ | Cache métriques équipe (TTL 5 min) |
| Layout `(dashboard)` + sidebar | ✅ | Ajouter une entrée "Équipe" |
| `lib/auth.ts` (NextAuth session) | ✅ | `getTenantContext()` + RBAC |
| Vercel Cron | ⚠ à activer | 1 cron 1×/h pour anomalies |

### Stratégie de migration

- Une seule migration Prisma ajoutant les 7 tables et 5 enums (`TeamRole`, `TaskStatus`, `TaskPriority`, `TaskEventType`, `NotificationType`)
- Pas de seed forcé — chaque org démarre vide
- Pas de backfill — pas d'historique préexistant

### Risques identifiés

| Risque | Mitigation |
|--------|------------|
| **Adoption par les MEMBER** | Page "Comment ça marche" + visibilité scopée + audit log accessible aux assignees pour transparence totale |
| **Bugs sur transitions de statut** corrompent les sessions | Tous les changements via `lib/tasks/transitions.ts` en transaction, suite de tests dédiée |
| **Performance des métriques sur grandes équipes** | Cache Redis 5 min déjà prévu, fallback approche snapshots si > 200 membres |
| **Gaming des statuts** (rester en TODO ou abuser BLOCKED) | Détection d'anomalies + heatmap qui croise les 2 axes |
| **Multi-équipes : visibilité incohérente** | Helper centralisé `getVisibleTeams(ctx)`, scoping systématique |

### Effort estimé

| Phase | Jours-homme | Contenu |
|-------|-------------|---------|
| Setup data model | 1 | Migration Prisma, types TS générés |
| RBAC + permissions | 1 | `permissions.ts` + tests |
| API tâches CRUD + status + reassign | 2 | Routes + transitions + TaskEvent (3 types) |
| Timer + audit | 1.5 | start/stop/edit + TimerSessionEdit |
| Vue collaborateur | 2 | Page liste + TimerWidget + filtres |
| Vue manager + métriques | 3 | Cache Redis + heatmap + tableau |
| Vue détail tâche | 2 | Timeline + édition sessions |
| Setup équipes (UI admin) | 2.5 | CRUD équipes + membres + désignation managers |
| Cron anomalies + notifications | 1 | Job + génération notifs |
| Tests E2E + polish | 2 | Cypress/Playwright sur flux clés |
| **Total** | **~18 j-h** | |

### Questions ouvertes (hors MVP)

- Combien de jours conserver les `TimerSession` après la fin d'un compte ? (RGPD)
- Comportement si un user est désactivé/supprimé alors qu'il a un timer actif ?
- Endpoint d'export RGPD individuel ?
- Migration vers SSE pour le polling timer si > 50 utilisateurs concurrents ?

---

## Récapitulatif — décisions clés validées

| # | Décision |
|---|----------|
| Périmètre | MVP productivité + timer actif, 100% standalone |
| Rôles | OWNER, ADMIN, MANAGER (par équipe), MEMBER. VIEWER hors module. |
| Équipes | 1 user = N équipes possibles. Manager = rôle par équipe. Manager flexible (peut composer son équipe). |
| Tâches | Toujours liées à 1 équipe. assigneeId obligatoire. teamId immutable. |
| Statuts | 5 : TODO / IN_PROGRESS / BLOCKED / DONE / CANCELLED |
| Timer | 1 actif max par user, auto-couplé au statut, édition possible avec audit log + fenêtre 24h pour MEMBER |
| Notifications | In-app uniquement |
| Métriques | Lead time / cycle time / throughput / flow efficiency / WIP, médiane (P50) + P75 |
| Cache | Redis TTL 5 min sur métriques agrégées équipe |
| Dashboards | 3 vues (collaborateur 30j fixe / manager sélecteur 7j-30j-90j-12m / détail tâche) |
| WIP | Cible saine 3, alerte automatique > 5 |
| Bouton timer | "Bloquer" (renommé depuis "Pause" pour éviter l'usage abusif) |
| TaskEvent | 3 types : STATUS_CHANGE, REASSIGNMENT, FIELD_EDIT (timeline complète) |
