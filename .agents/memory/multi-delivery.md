---
name: Multi-delivery Boutique
description: Architecture et SQL migration pour livraisons multi-éléments boutique Telegram.
---

## Architecture

Les livraisons sont stockées dans la table `boutique_item_deliveries` (une ligne par élément).
Les anciens champs `delivery_type`, `delivery_file_id`, `delivery_caption` sur `boutique_items` sont conservés en rétrocompat.

## SQL VPS (à exécuter une seule fois)

```sql
CREATE TABLE IF NOT EXISTS boutique_item_deliveries (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES boutique_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  file_id TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
GRANT ALL PRIVILEGES ON TABLE boutique_item_deliveries TO nexoshop;
GRANT USAGE, SELECT ON SEQUENCE boutique_item_deliveries_id_seq TO nexoshop;
```

## Flow admin création
1. Admin crée nom/desc/prix/photo
2. Étape 5/5 : choisit type (texte/photo/vidéo/doc/audio/GIF) → envoie contenu → accumulé en mémoire
3. Bouton "➕ Ajouter un autre" ou "✅ Terminer (N éléments)"
4. Terminer → createItem() + createDelivery() pour chaque élément

## Flow achat
- getDeliveriesByItemId(item.id) → sendDeliveries() si DB non vide
- Sinon fallback : deliveryType + deliveryFileId + deliveryCaption (anciens articles)

## Flow édition admin
- Bouton "📦 Contenu livraison" → vue liste avec ➕ Ajouter / 🗑️ Supprimer par élément
- callback: bqa_edit_delivery_${itemId}, bqa_dlvadd_${itemId}, bqa_dlvdel_${id}_${itemId}, bqa_dlvdelall_${itemId}

## Important
- Ne PAS utiliser `delivery_data TEXT` sur boutique_items (décision abandonnée en faveur de la table séparée)
- Build: esbuild (pas de type checking) → toujours vérifier les replace() silencieux
