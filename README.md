# ManuelO

Éditeur de manuels de cours pédagogiques — gratuit, sans dépendance, sans build tool.

## Stack

- HTML5 / CSS3 / JavaScript ES modules (vanilla)
- PHP backend léger pour la persistance (fichiers JSON)
- SortableJS (CDN) — drag & drop des blocs et exercices de classement
- Mermaid.js v11 (CDN) — rendu de diagrammes

## Structure

```
index.html          Page d'accueil — liste des manuels
editor.html         Éditeur principal
css/
  style.css         Point d'entrée CSS (importe tout)
  variables.css     Variables CSS + thème sombre
  layout.css        Header, toolbar, sidebar, layout général
  blocks.css        Styles de tous les types de blocs
  components.css    Modals, boutons, scrollbar, timer, dark toggle
js/
  app.js            Point d'entrée JS — orchestration, globals, dark mode, timer
  state.js          État global de l'application
  render.js         Rendu DOM de tous les blocs
  modal.js          Définitions des formulaires + logique de soumission
  actions.js        Actions sur les blocs (move, delete, edit…)
  save.js           Sauvegarde / chargement via l'API PHP
api/
  list.php          Liste tous les manuels
  load.php          Charge un manuel par ID
  save.php          Sauvegarde un manuel (JSON)
  delete.php        Supprime un manuel
manuals/            Dossier de stockage des fichiers JSON (créé automatiquement)
```

## Installation

Requiert un serveur PHP local (XAMPP, Laragon, `php -S`, etc.).

```bash
git clone https://github.com/…/ManuelO.git
cd ManuelO
php -S localhost:8000
# Ouvrir http://localhost:8000
```

## Fonctionnalités

### Blocs disponibles

| Catégorie | Blocs |
|---|---|
| Structure | Titre de section, Saut de page |
| Texte & contenu | Texte riche, Citation, Source, Lien, Tableau, Frise chronologique |
| Pédagogie | Objectifs, Résumé, Notion clé, Vocabulaire, Méthode, Avertissement, Exemple, Rappel, Biographie |
| Médias | Vidéo (YouTube / Vimeo embed), Diagramme Mermaid |
| Exercices | QCM, Texte à trous, Vrai/Faux, Association, Classement, Réponse rédigée, Tableau à compléter, Étude de document |
| Activités | Travail de groupe, Activité orale, Consigne |
| Diff | Comparaison avant/après |

### Exercices interactifs

- **QCM** — sélection d'une réponse parmi plusieurs options
- **Texte à trous** — menus déroulants avec distracteurs, bouton « Vérifier » avec feedback coloré
- **Vrai/Faux** — boutons V/F par affirmation
- **Association** — menus déroulants pour relier les paires, bouton « Vérifier »
- **Classement** — drag & drop via SortableJS, bouton « Vérifier l'ordre »
- **Correction masquée** — toutes les réponses sont cachées derrière un flou neutre (couleurs masquées) et révélables via un modal de confirmation

### Autres

- **Mode prof / Mode élève** — bascule l'interface entre édition et vue lecture
- **Mode sombre** — switch dans le header, persisté via `localStorage`
- **Timer** — clic sur le badge de durée d'une activité ouvre un minuteur avec anneau SVG animé, pause/reprise, bips de fin
- **Diagrammes Mermaid** — bascule code ↔ rendu visuel
- **Vidéos embed** — YouTube (`youtu.be`, `youtube.com/watch`) et Vimeo convertis automatiquement en iframes 16:9
- **Biographie** — photo ronde via URL ou emoji de remplacement
- **Sauvegarde auto** — toute modification déclenche une sauvegarde debounced vers le serveur PHP
