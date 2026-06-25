# maze-infra

Infraestructura de Maze Funnels. Fuente de verdad del **estándar de deploy** (GitOps) y, más adelante, de la configuración del VPS.

## Qué hay acá

- `.github/workflows/deploy.yml` — **robot de deploy reutilizable**. La lógica de deploy se escribe UNA sola vez acá; todas las apps la invocan.

## El estándar GitOps (cómo se monta una app)

Cada app de código sigue este molde:

### 1. Ramas = entornos
| Rama | Entorno | URL ejemplo |
|------|---------|-------------|
| `develop` | Pruebas | `<app>-test.mazefunnels.io` |
| `main` | Producción | `<app>.mazefunnels.io` |

### 2. Dos carpetas en el VPS
- `/docker/<app>` → rama `main` (producción)
- `/docker/<app>-dev` → rama `develop` (pruebas)

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

`.github/workflows/deploy-prod.yml`:
```yaml
name: Deploy a PRODUCCION
on:
  push:
    branches: [main]
jobs:
  deploy:
    uses: mazeos/maze-infra/.github/workflows/deploy.yml@main
    with:
      app_dir: /docker/<app>
      branch: main
      compose_file: docker-compose.yml
    secrets: inherit
```

### 4. Secrets por repo
Cada repo necesita 3 secrets (se cargan con `scripts/enchufar-app.sh`):
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

### 5. Candado en `main`
Branch protection: requiere PR, prohíbe push directo y force-push.

## Flujo del día a día
```
cambio en develop → deploy automático a PRUEBAS → se revisa en vivo
→ PR develop→main → aprobación → deploy automático a PRODUCCION
```
Lo no aprobado nunca llega a producción.
