#!/bin/bash
set -e

REPO_DIR="/var/www/nexobot"
PM2_APP="nexoshop"

echo "🚀 Déploiement NexoShop..."

cd "$REPO_DIR"

echo "📥 Pull du code..."
git checkout -- node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json 2>/dev/null || true
git pull origin main

echo "📦 Installation des dépendances..."
pnpm install --frozen-lockfile

echo "🔨 Build lib/db..."
cd lib/db && npx tsc -p tsconfig.json && cd "$REPO_DIR"

echo "🔨 Build api-server..."
cd artifacts/api-server && pnpm build && cd "$REPO_DIR"

echo "♻️  Redémarrage PM2..."
pm2 restart "$PM2_APP"

echo "✅ Déploiement terminé !"
pm2 status "$PM2_APP"
