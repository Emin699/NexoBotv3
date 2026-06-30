---
name: VPS Deployment — NexoShop
description: Comment déployer et gérer le bot sur le VPS Ubuntu avec PM2
---

## Démarrage PM2 (source de vérité = .env)
Node v22.22 est installé sur le VPS (process.loadEnvFile dispo mais peut échouer silencieusement si une ligne du .env n'est pas parsable par Node → catch avale l'erreur → DATABASE_URL vide).

Méthode A (canonique, --env-file passé à NODE via --node-args, PAS à pm2) :
```bash
pm2 delete nexobot
cd /var/www/nexobot/artifacts/api-server
pm2 start dist/index.mjs --name nexobot --node-args="--enable-source-maps --env-file=/var/www/nexobot/.env"
pm2 save
```

Méthode B (fallback fiable — source le .env dans le shell puis capture via --update-env) :
```bash
cd /var/www/nexobot/artifacts/api-server
pm2 delete nexobot
set -a; . /var/www/nexobot/.env; set +a
pm2 start dist/index.mjs --name nexobot --update-env
pm2 save
```
**Why:** `pm2 start ... --env-file` au niveau PM2 → "unknown option --env-file" (la version PM2 du VPS ne connaît pas ce flag). `--env-file` est un flag NODE → le passer via `--node-args`. Ou sourcer le .env dans le shell.

## Workflow de déploiement
```bash
cd /var/www/nexobot
git pull
pnpm install --frozen-lockfile
# SQL manuel si schema change (voir section DB)
cd artifacts/api-server && node build.mjs
pm2 restart nexobot
```

## Schéma DB sur VPS — JAMAIS drizzle-kit push
drizzle-kit push devient interactif sur le VPS (anciens schémas incompatibles → rename vs create). Toujours utiliser du SQL manuel avec IF NOT EXISTS.

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS ma_colonne TEXT;
CREATE TABLE IF NOT EXISTS ma_table (...);
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nexoshop;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nexoshop;
```
**Why:** Le VPS a un ancien schéma (tables paypal_recharges, orders, products) incompatible avec drizzle push.

## Permissions PostgreSQL
Toujours exécuter après CREATE TABLE (tables créées en tant que postgres, bot se connecte en tant que nexoshop) :
```bash
sudo -u postgres psql -d nexoshop -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nexoshop; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nexoshop;"
```

## Pièges connus
- Ne jamais avoir deux process PM2 avec le même script/token → conflit polling Telegram (409/404)
- Le .env ne doit PAS contenir de valeurs placeholder (ex: `# token de @BotFather`) — node --env-file les lirait comme valeurs
- Connexion DB : postgresql://nexoshop:eminozer@localhost:5432/nexoshop (local, PAS Neon)
