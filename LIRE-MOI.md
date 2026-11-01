# Landing page serres (AGRI-TH-108) : mise en ligne

## Ce que fait la page

1. Le prospect décrit sa serre (culture, type de serre, superficie, chauffage, paroi, distance du compteur) et laisse ses coordonnées. Aucun montant n'est affiché.
2. Netlify enregistre la demande (onglet **Forms** du site Netlify).
3. La fonction `netlify/functions/submission-created.mjs` se lance toute seule et :
   - envoie une **alerte Telegram** avec le téléphone et les réponses (et les points à vérifier : tunnels, couverture non isolée, compteur absent ou à plus de 300 m) ;
   - envoie l'événement **Lead** à Meta par l'API Conversions, seulement si le prospect a accepté les cookies.
4. Dans le navigateur, le **pixel Meta** envoie aussi « Lead » (même identifiant : Meta ne le compte qu'une fois).
5. Le prospect voit un écran de remerciement avec le récapitulatif de sa serre, la suite et les documents à préparer.

## À faire avant la mise en ligne

1. Nom, téléphone et mentions légales sur la page (en attente).
2. Mettre l'identifiant du pixel Meta dans `index.html` : ligne `var META_PIXEL_ID = '';`.
   Sans identifiant, pas de pixel ni de bandeau cookies.
3. Déposer le dossier `landing` sur Netlify (nouveau site, glisser-déposer ou dépôt Git).
4. Dans Netlify, **Site configuration → Environment variables** :

| Variable | Rôle |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Robot Telegram qui envoie l'alerte |
| `TELEGRAM_CHAT_ID` | Conversation qui reçoit l'alerte |
| `META_PIXEL_ID` | Même identifiant que dans `index.html` |
| `META_CONVERSIONS_API_TOKEN` | Jeton de l'API Conversions (Gestionnaire d'événements Meta → Paramètres) |

5. Netlify → **Forms** : activer la détection des formulaires.
6. Tester : envoyer une demande, vérifier l'alerte Telegram, puis l'événement « Lead » dans le Gestionnaire d'événements Meta (outil « Tester les événements »).

## Liens de pub

Toujours mettre des UTM, par exemple :
`https://<domaine>/?utm_source=facebook&utm_medium=paid&utm_campaign=serres-bretagne`
L'origine apparaît dans l'alerte Telegram et dans la demande Netlify.
