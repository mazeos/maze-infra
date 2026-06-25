# maze-infra

Infraestructura de Maze Funnels. Fuente de verdad del **estándar de deploy** (GitOps) y, más adelante, de la configuración del VPS.

## Arquitectura (Camino B — recepcionista)

Hostinger bloquea las IPs de GitHub en SSH entrante. Por eso el deploy **no entra** por SSH: GitHub le **avisa al recepcionista** del VPS por HTTPS y el VPS hace el deploy desde adentro.

```
push a GitHub → robot (GitHub Actions) → curl HTTPS → deploy.mazefunnels.io (recepcionista)
                                                          → git fetch + reset + docker compose up
```

## Qué hay acá

- `.github/workflows/deploy.yml` — **robot reutilizable**. Avisa al recepcionista. Se escribe UNA vez; todas las apps lo invocan.
- `deployer/` — **recepcionista** (`maze-deployer`): servicio en el VPS (`deploy.mazefunnels.io`) que recibe el aviso, valida el token y ejecuta el deploy.

## El estándar GitOps (cómo se monta una app)

### 1. Ramas = entornos
| Rama | Entorno | URL ejemplo |
|------|---------|-------------|
| `develop` | Pruebas | `<app>-test.mazefunnels.io` |
| `main` | Producción | `<app>.mazefunnels.io` |

### 2. Dos carpetas en el VPS (remote en **HTTPS**)
- `/docker/<app>` → rama `main` (producción)
- `/docker/<app>-dev` → rama `develop` (pruebas)
- Remote del repo en HTTPS: `git remote set-url origin https://github.com/mazeos/<repo>.git`
  (repos públicos no necesitan auth; privados → pendiente: PAT en el recepcionista)

### 3. Dos "callers" en el repo de la app
`.github/workflows/deploy-dev.yml`:
```yaml
name: Deploy a PRUEBAS
on:
  push:
    branches: [develop]
jobs:
  deploy:
    uses: mazeos/maze-infra/.github/workflows/deploy.yml@main
    with:
      app_dir: /docker/<app>-dev
      branch: develop
      compose_file: docker-compose.dev.yml
    secrets: inherit
```
`.github/workflows/deploy-prod.yml`: igual pero `branches: [main]`, `app_dir: /docker/<app>`, `branch: main`, `compose_file: docker-compose.yml`.

### 4. Un secret por repo
- `DEPLOY_TOKEN` — la clave que el recepcionista valida. Igual para todas las apps.

### 5. Candado en `main`
Branch protection: requiere PR, prohíbe push directo y force-push.

## Flujo del día a día
```
cambio en develop → deploy automático a PRUEBAS → se revisa en vivo
→ PR develop→main → merge (aprobación) → deploy automático a PRODUCCION
```
Lo no aprobado nunca llega a producción.

## Pendientes de endurecimiento
- Repos privados: agregar un PAT (contents:read) al recepcionista para `git fetch` por HTTPS.
- Restringir el montaje `/root/.ssh` del recepcionista a una llave dedicada.
- Healthcheck post-deploy + notificación de fallo.
