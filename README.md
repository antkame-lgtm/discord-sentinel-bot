# Discord Sentinel & Utility Bot

Bot Discord professionnel conçu pour fonctionner **24h/24 gratuitement sur Render**.

## 🚀 Fonctionnalités intégrées :
- **Serveur HTTP Keep-Alive** : Répond aux pings et aux healthchecks pour rester actif sur le plan gratuit de Render.
- **Auto-Voice** : Salons vocaux éphémères automatiques (création à l'entrée, suppression à la sortie).
- **Anti-Phishing & Sécurité** : Détection et suppression immédiate des faux liens Discord Nitro et Steam.
- **Commandes** : `!ping` (latence bot/API).

## 🛠️ Déploiement en 3 étapes sur Render :
1. Créez un dépôt sur votre GitHub et poussez ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/VOTRE_USER/VOTRE_REPO.git
   git push -u origin main
   ```
2. Allez sur [render.com](https://render.com) ➔ **New Web Service** ➔ Sélectionnez votre dépôt GitHub.
3. Dans **Environment Variables**, ajoutez :
   - `DISCORD_TOKEN` = Votre token de bot Discord.
   - `PORT` = `10000`

Le bot se lancera automatiquement et tournera 24h/24 dans le cloud !
