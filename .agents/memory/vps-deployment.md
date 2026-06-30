---
name: VPS Deployment — NexoShop
description: Comment déployer et gérer le bot sur le VPS Ubuntu avec PM2
---

## Démarrage PM2 (source de vérité = .env)
```bash
pm2 delete nexobot
cd /var/www/nexobot/artifacts/api-server
pm2 start dist/index.mjs --name nexobot --node-args="--enable-source-maps --env-file=/var/www/nexobot/.env"
pm2 save
```
**Why:** --env-file évite les variables périmées coincées dans PM2. Ne jamais injecter les vars inline avec pm2 start.

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
