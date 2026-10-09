# Démarrage rapide (français)

Recevez les rappels d'Outlook web en notifications système, en 5 minutes environ.

*English version: [QUICKSTART.en.md](QUICKSTART.en.md)*

## Prérequis

- Google Chrome 111 ou plus récent.
- Une copie de ce dépôt sur votre ordinateur (`git clone`, ou téléchargez le ZIP et extrayez-le).
  Placez le dossier à un endroit définitif : Chrome charge l'extension depuis ce dossier à chaque démarrage.
- Les notifications autorisées pour Google Chrome dans les paramètres de votre système d'exploitation.

## 1. Installer Outlook web comme application (PWA)

Facultatif mais recommandé : Outlook a sa propre fenêtre, séparée de vos onglets de navigation,
et risque moins d'être fermé par erreur. L'extension fonctionne de la même façon dans un onglet classique.

1. Dans Chrome, ouvrez <https://outlook.cloud.microsoft/calendar> et connectez-vous.
2. Installez-le comme application, au choix :
   - cliquez sur l'**icône d'installation** à droite de la barre d'adresse (un écran avec une flèche
     vers le bas), puis **Installer** ;
   - ou ouvrez le menu **⋮** → **Caster, enregistrer et partager** → **Installer la page en tant
     qu'application…**, puis **Installer**. (Selon la version de Chrome : ⋮ → **Installer Outlook…**.)
3. Outlook s'ouvre dans sa propre fenêtre. Relancez-le ensuite depuis le menu des applications de
   votre système, la barre des tâches / le dock, ou `chrome://apps`.

Pour désinstaller l'application : dans la fenêtre Outlook, menu ⋮ → **Désinstaller Outlook…**.

## 2. Installer l'extension

1. Ouvrez `chrome://extensions`.
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier du dépôt (celui qui
   contient `manifest.json`).
4. La carte **Rappels Outlook → notifications système** apparaît. Vérifiez qu'elle est activée.
5. **Rechargez Outlook** (onglet ou fenêtre de l'application : `F5` ou `Ctrl+R` / `Cmd+R`).
   L'extension ne s'attache qu'aux pages chargées après son installation.

Options (activer/désactiver, garder à l'écran les rappels imminents, mode debug) :
`chrome://extensions` → **Détails** de l'extension → **Options de l'extension**.

## 3. Réglages recommandés

- **Garder Outlook actif** : `chrome://settings/performance` → **Toujours laisser ces sites
  actifs** → **Ajouter** → `outlook.cloud.microsoft`. Sinon l'économiseur de mémoire de Chrome peut
  mettre en veille un Outlook inactif, et aucun rappel ne s'affiche.
- Laissez Outlook ouvert (onglet ou fenêtre d'application) dans la journée : l'extension ne voit que
  les rappels qu'Outlook affiche.

## 4. Vérifier que tout fonctionne

1. Dans Outlook, créez un événement intitulé `Test`, tapez une heure de début **maintenant + 7 minutes**
   et choisissez le rappel **5 minutes avant**. Enregistrez.
2. Environ 2 minutes plus tard, le panneau de rappel d'Outlook apparaît, ainsi qu'une **notification système**.
3. Cliquez sur la notification : la fenêtre Outlook passe au premier plan.

Rien ne se passe ? Voir « Known limitations » et « When Outlook changes its DOM » dans le
[README](../README.md).

## Mettre à jour / supprimer

- **Mettre à jour** : remplacez le contenu du dossier (ou `git pull`), cliquez sur l'icône de
  rechargement de la carte de l'extension dans `chrome://extensions`, puis rechargez Outlook.
- **Supprimer** : `chrome://extensions` → **Supprimer** sur la carte de l'extension.

Chrome peut parfois afficher un avertissement concernant les extensions en mode développeur. C'est
normal pour une extension chargée de cette façon.
