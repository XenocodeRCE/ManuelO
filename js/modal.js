// Gestion de la modale d'ajout de blocs

import { state } from './state.js';
import { renderBlocks } from './render.js';
import { save } from './save.js';
import { createArgumentMap } from './argument-map.js';

const AUDIO_MAX_SIZE_BYTES = 50 * 1024 * 1024;

function notifyError(message) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(message, 'error');
        return;
    }
    // eslint-disable-next-line no-alert
    alert(message);
}

async function uploadAudioFile(file) {
    if (!(file instanceof File)) {
        throw new Error('Fichier audio invalide.');
    }
    if (file.size > AUDIO_MAX_SIZE_BYTES) {
        throw new Error('Le fichier audio depasse 50 Mo.');
    }

    const formData = new FormData();
    formData.append('audio', file);

    const res = await fetch('api/upload_audio.php', {
        method: 'POST',
        body: formData
    });
    const json = await res.json();
    if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || 'Upload audio impossible.');
    }

    return String(json.url);
}

function setupAudioModalInteractions() {
    const modeEl = document.getElementById('field-sourceMode');
    if (!modeEl) return;

    const urlGroup = document.querySelector('.form-group[data-field-key="url"]');
    const fileGroup = document.querySelector('.form-group[data-field-key="audioFile"]');
    if (!urlGroup || !fileGroup) return;

    const apply = () => {
        const mode = String(modeEl.value || 'link');
        const isUpload = mode === 'upload';

        urlGroup.style.display = isUpload ? 'none' : '';
        fileGroup.style.display = isUpload ? '' : 'none';
    };

    modeEl.addEventListener('change', apply);
    apply();
}

export const modalForms = {
    'source-text': { title: 'Texte source', fields: [
        { key: 'author', label: 'Auteur', type: 'input', placeholder: 'Ex: Platon' },
        { key: 'title', label: "Titre de l'œuvre", type: 'input', placeholder: 'Ex: Protagoras' },
        { key: 'reference', label: 'Référence', type: 'input', placeholder: 'Ex: 320c-321c, trad. F. Ildefonse, GF, 1997' },
        { key: 'content', label: 'Texte source', type: 'textarea', placeholder: 'Collez le texte ici… (HTML accepté : <strong>mot</strong>)', rows: 6 }
    ]},
    'image': { title: 'Image', fields: [
        { key: 'url', label: "URL de l'image", type: 'input', placeholder: 'https://...' },
        { key: 'caption', label: 'Légende', type: 'input', placeholder: "Description de l'image" },
        { key: 'source', label: 'Source', type: 'input', placeholder: 'Ex: Wikimedia Commons' }
    ]},
    'questions': { title: 'Questions', fields: [
        { key: 'questions', label: 'Questions (une par ligne)', type: 'textarea', placeholder: 'Quel est le rôle de Prométhée ?\nEn quoi la technique…', rows: 5 }
    ]},
    'section-title': { title: 'Titre de section', fields: [
        { key: 'number', label: 'Numéro', type: 'input', placeholder: 'Ex: 2' },
        { key: 'content', label: 'Titre', type: 'input', placeholder: 'Ex: La condition humaine et la technique' }
    ]},
    'exercise-qcm': { title: 'Exercice — QCM', fields: [
        { key: 'question', label: 'Question', type: 'input', placeholder: "Ex: Qui est l'auteur du Protagoras ?" },
        { key: 'options', label: 'Options (une par ligne)', type: 'textarea', placeholder: 'Aristote\nPlaton\nSocrate\nProtagoras', rows: 4 },
        { key: 'correctIndex', label: 'Index réponse correcte (0 = 1ère)', type: 'input', placeholder: '1' }
    ]},
    'exercise-fill': { title: 'Exercice — Texte à trous', fields: [
        { key: 'text', label: 'Texte (utilisez ___ pour les trous)', type: 'textarea', placeholder: "La ___ permet à l'homme de pallier son ___ naturel.", rows: 3 },
        { key: 'blanks', label: 'Réponses par trou (correcte|distracteur1|distracteur2)', type: 'textarea', placeholder: 'technique|instinct|passion\ndénuement|pouvoir|bonheur', rows: 3, hint: 'Une ligne par trou, séparé par |' }
    ]},
    'exercise-written': { title: 'Exercice — Réponse rédigée', fields: [
        { key: 'prompt', label: 'Consigne', type: 'textarea', placeholder: 'Expliquez en quoi le mythe de Prométhée…', rows: 3 },
        { key: 'lines', label: 'Nombre de lignes', type: 'input', placeholder: '5' }
    ]},
    'definition': { title: 'Définition', fields: [
        { key: 'term', label: 'Terme', type: 'input', placeholder: 'Ex: Technique' },
        { key: 'content', label: 'Définition', type: 'textarea', placeholder: 'Ensemble des procédés et savoir-faire…', rows: 3 }
    ]},
    'distinction': { title: 'Distinction conceptuelle', fields: [
        { key: 'termA', label: 'Concept A', type: 'input', placeholder: 'Ex: Technique' },
        { key: 'termB', label: 'Concept B', type: 'input', placeholder: 'Ex: Nature' },
        { key: 'explanationA', label: 'Explication A', type: 'textarea', placeholder: 'Ce qui est produit par…', rows: 2 },
        { key: 'explanationB', label: 'Explication B', type: 'textarea', placeholder: 'Ce qui existe indépendamment…', rows: 2 }
    ]},
    'text-intro': { title: "Texte d'introduction", fields: [
        { key: 'content', label: 'Texte', type: 'textarea', placeholder: 'Texte introductif…', rows: 4 }
    ]},
    'citation': { title: 'Citation', fields: [
        { key: 'quote', label: 'Citation', type: 'textarea', placeholder: '« La technique est la puissance de l\'homme sur la nature »', rows: 3 },
        { key: 'author', label: 'Auteur', type: 'input', placeholder: 'Ex: Karl Marx' },
        { key: 'source', label: 'Source / Œuvre', type: 'input', placeholder: 'Ex: Le Capital, 1867' }
    ]},
    'table': { title: 'Tableau', fields: [
        { key: 'headers', label: 'En-têtes (séparés par |)', type: 'input', placeholder: 'Concept|Définition|Exemple' },
        { key: 'rows', label: 'Lignes (une par ligne, cellules séparées par |)', type: 'textarea', placeholder: 'Technique|Savoir-faire|Le marteau\nNature|Ensemble des choses|Le bois', rows: 4 },
        { key: 'caption', label: 'Légende (optionnel)', type: 'input', placeholder: 'Comparaison des concepts' }
    ]},
    'link': { title: 'Lien / QR Code', fields: [
        { key: 'label', label: 'Texte du lien', type: 'input', placeholder: 'Vidéo explicative — Canal Académie' },
        { key: 'url', label: 'URL', type: 'input', placeholder: 'https://...' },
        { key: 'description', label: 'Description (optionnel)', type: 'input', placeholder: 'Une introduction à la philosophie de la technique' }
    ]},
    'media': { title: 'Vidéo / Audio', fields: [
        { key: 'title', label: 'Titre', type: 'input', placeholder: 'La technique selon Heidegger' },
        { key: 'url', label: 'URL', type: 'input', placeholder: 'https://www.youtube.com/...' },
        { key: 'mediaType', label: 'Type', type: 'input', placeholder: 'vidéo / audio / podcast' },
        { key: 'description', label: 'Description', type: 'input', placeholder: 'Durée, source, contexte…' }
    ]},
    'audio': { title: 'Audio', fields: [
        { key: 'title', label: 'Titre', type: 'input', placeholder: 'Lecture du texte de Platon' },
        {
            key: 'sourceMode',
            label: 'Source audio',
            type: 'select',
            options: [
                { value: 'link', label: 'Lien (URL)' },
                { value: 'upload', label: 'Upload de fichier (max 50 Mo)' }
            ]
        },
        { key: 'url', label: 'URL audio', type: 'input', placeholder: 'https://.../cours.mp3' },
        { key: 'audioFile', label: 'Fichier audio', type: 'file', accept: 'audio/*', hint: 'Formats acceptes: mp3, wav, ogg, m4a, webm, aac, flac (max 50 Mo).' },
        { key: 'description', label: 'Description', type: 'input', placeholder: 'Contexte, duree, objectifs...' }
    ]},
    'diagram': { title: 'Schéma / Diagramme', fields: [
        { key: 'title', label: 'Titre', type: 'input', placeholder: 'Les conditions de la connaissance' },
        { key: 'code', label: 'Code Mermaid (optionnel)', type: 'textarea', placeholder: 'graph TD\n  A[Expérience] --> B[Concept]\n  B --> C[Jugement]', rows: 5, hint: 'Laissez vide pour un simple placeholder légende' },
        { key: 'caption', label: 'Légende', type: 'input', placeholder: 'Source : cours de terminale' }
    ]},
    'timeline': { title: 'Frise chronologique', fields: [
        { key: 'title', label: 'Titre', type: 'input', placeholder: 'Chronologie de la philosophie antique' },
        { key: 'events', label: 'Événements (date|événement, un par ligne)', type: 'textarea', placeholder: '-427|Naissance de Platon\n-384|Naissance d\'Aristote\n-322|Mort d\'Aristote', rows: 5 }
    ]},
    'objectives': { title: 'Objectifs', fields: [
        { key: 'items', label: 'Objectifs (un par ligne)', type: 'textarea', placeholder: 'Comprendre la distinction technique / nature\nAnalyser un texte de Platon\nArgumenter à l\'écrit', rows: 4 }
    ]},
    'summary': { title: 'À retenir', fields: [
        { key: 'items', label: 'Points clés (un par ligne)', type: 'textarea', placeholder: 'La technique est définie comme…\nOn distingue technique et nature par…', rows: 4 },
        { key: 'flashcard', label: 'Flashcard (question)', type: 'input', placeholder: 'Ex: Quelle distinction faut-il retenir ici ?' }
    ]},
    'method': { title: 'Méthode', fields: [
        { key: 'title', label: 'Titre de la méthode', type: 'input', placeholder: 'Comment rédiger une introduction de dissertation' },
        { key: 'steps', label: 'Étapes (une par ligne)', type: 'textarea', placeholder: '1. Accrocher le lecteur\n2. Présenter le sujet\n3. Problématiser', rows: 5 }
    ]},
    'warning': { title: 'Attention / Piège', fields: [
        { key: 'content', label: 'Description du piège ou de l\'erreur', type: 'textarea', placeholder: 'Ne pas confondre la technique avec la technologie…', rows: 3 },
        { key: 'flashcard', label: 'Flashcard (question)', type: 'input', placeholder: 'Ex: Quelle confusion faut-il éviter ?' }
    ]},
    'recall': { title: 'Rappel / Prérequis', fields: [
        { key: 'content', label: 'Ce qu\'il faut déjà savoir', type: 'textarea', placeholder: 'Dans ce chapitre, nous avons vu que…', rows: 3 },
        { key: 'flashcard', label: 'Flashcard (question)', type: 'input', placeholder: 'Ex: Quel prérequis devez-vous connaître ?' }
    ]},
    'biography': { title: 'Biographie', fields: [
        { key: 'name', label: 'Nom', type: 'input', placeholder: 'Aristote' },
        { key: 'dates', label: 'Dates', type: 'input', placeholder: '-384 / -322' },
        { key: 'role', label: 'Rôle / Qualité', type: 'input', placeholder: 'Philosophe grec, élève de Platon' },
        { key: 'avatarUrl', label: "URL de l'image (optionnel)", type: 'input', placeholder: 'https://upload.wikimedia.org/...' },
        { key: 'content', label: 'Présentation', type: 'textarea', placeholder: 'Aristote est…', rows: 3 }
    ]},
    'example': { title: 'Exemple', fields: [
        { key: 'title', label: 'Notion illustrée', type: 'input', placeholder: 'La technique comme extension de l\'homme' },
        { key: 'content', label: 'Description de l\'exemple', type: 'textarea', placeholder: 'Le marteau prolonge le geste de la main…', rows: 3 }
    ]},
    'exercise-truefalse': { title: 'Vrai / Faux', fields: [
        { key: 'statements', label: 'Affirmations (une par ligne)', type: 'textarea', placeholder: 'La technique est propre à l\'homme\nLa nature précède la technique', rows: 4 },
        { key: 'answers', label: 'Réponses (V ou F, une par ligne, même ordre)', type: 'textarea', placeholder: 'V\nF', rows: 3 }
    ]},
    'exercise-match': { title: 'Association / Relier', fields: [
        { key: 'leftItems', label: 'Colonne gauche (une par ligne)', type: 'textarea', placeholder: 'Platon\nAristote\nKant', rows: 4 },
        { key: 'rightItems', label: 'Colonne droite (dans le bon ordre de correspondance)', type: 'textarea', placeholder: 'Protagoras\nÉthique à Nicomaque\nCritique de la raison pure', rows: 4 }
    ]},
    'exercise-table': { title: 'Tableau à compléter', fields: [
        { key: 'headers', label: 'En-têtes (séparés par |)', type: 'input', placeholder: 'Philosophe|Époque|Œuvre|Thèse' },
        { key: 'rows', label: 'Lignes (cellules vides = ???, séparées par |)', type: 'textarea', placeholder: 'Platon|???|Protagoras|???\nAristote|Antiquité|???|La forme précède la matière', rows: 4, hint: 'Les cellules ??? seront des cases à compléter' },
        { key: 'caption', label: 'Légende (optionnel)', type: 'input', placeholder: 'Comparaison des philosophes' }
    ]},
    'exercise-document': { title: 'Étude de document', fields: [
        { key: 'docTitle', label: 'Titre du document', type: 'input', placeholder: 'Document 1 — Texte de Platon' },
        { key: 'content', label: 'Contenu du document', type: 'textarea', placeholder: '« Le texte »…', rows: 4 },
        { key: 'source', label: 'Source', type: 'input', placeholder: 'Platon, Protagoras, 320c' },
        { key: 'questions', label: 'Questions guidées (une par ligne)', type: 'textarea', placeholder: 'Identifiez le thème principal.\nRelevez les arguments de l\'auteur.', rows: 3 }
    ]},
    'exercise-sort': { title: 'Classement / Ordonnancement', fields: [
        { key: 'instruction', label: 'Consigne', type: 'input', placeholder: 'Remettez les étapes de la dissertation dans l\'ordre' },
        { key: 'items', label: 'Éléments dans le bon ordre (un par ligne)', type: 'textarea', placeholder: 'Introduction\nDéveloppement — Partie 1\nDéveloppement — Partie 2\nConclusion', rows: 4 }
    ]},
    'argument-map': { title: 'Carte d\'argument interactive', fields: [
        { key: 'title', label: 'Titre du bloc (optionnel)', type: 'input', placeholder: 'Ex: La liberté est-elle une illusion ?' },
        { key: 'thesis', label: 'Thèse centrale', type: 'textarea', placeholder: 'Ex: La liberté est une illusion', rows: 3 },
        { key: 'hints', label: 'Arguments de départ (ligne 1 = POUR, ligne 2 = CONTRE)', type: 'textarea', placeholder: 'Argument pour\nArgument contre', rows: 3 },
        { key: 'isExercise', label: 'Mode exercice (oui/non)', type: 'input', placeholder: 'oui ou non' }
    ]},
    'activity-group': { title: 'Travail de groupe', fields: [
        { key: 'title', label: 'Titre de l\'activité', type: 'input', placeholder: 'Débat : technique et progrès' },
        { key: 'duration', label: 'Durée', type: 'input', placeholder: '20 minutes' },
        { key: 'groups', label: 'Nombre de groupes / composition', type: 'input', placeholder: '4 groupes de 4 élèves' },
        { key: 'instructions', label: 'Consigne', type: 'textarea', placeholder: 'Chaque groupe devra…', rows: 3 }
    ]},
    'activity-oral': { title: 'Activité orale', fields: [
        { key: 'activityType', label: 'Type d\'activité', type: 'input', placeholder: 'Débat / Exposé / Jeu de rôle' },
        { key: 'title', label: 'Sujet', type: 'input', placeholder: 'La technique est-elle une libération ?' },
        { key: 'instructions', label: 'Consigne', type: 'textarea', placeholder: 'Préparez un exposé de 5 minutes…', rows: 3 },
        { key: 'duration', label: 'Durée', type: 'input', placeholder: '15 minutes' }
    ]},
    'activity-instruction': { title: 'Consigne d\'activité', fields: [
        { key: 'title', label: 'Titre', type: 'input', placeholder: 'Activité 1 — Analyse de texte' },
        { key: 'instructions', label: 'Consigne', type: 'textarea', placeholder: 'Lisez attentivement le texte puis répondez…', rows: 4 }
    ]},
    'differentiation': { title: 'Différenciation pédagogique', fields: [
        { key: 'standard', label: 'Version standard', type: 'textarea', placeholder: 'Expliquez la thèse de Platon…', rows: 3 },
        { key: 'advanced', label: 'Version avancée (approfondissement)', type: 'textarea', placeholder: 'En quoi cette thèse s\'oppose-t-elle à Aristote ?', rows: 3 },
        { key: 'supported', label: 'Version accompagnée (aide)', type: 'textarea', placeholder: 'Complétez la phrase suivante…', rows: 3 }
    ]}
};

export function openModal(type, existingValues = null) {
    state.currentModalType = type;

    const config = modalForms[type];
    const isEdit = existingValues !== null;
    document.getElementById('modal-title').textContent = (isEdit ? '✏️ Modifier — ' : '➕ ') + config.title;
    document.getElementById('modal-submit-btn').textContent = isEdit ? 'Enregistrer les modifications' : 'Ajouter le bloc';

    let html = '';
    config.fields.forEach(f => {
        const val = existingValues ? (existingValues[f.key] ?? '') : '';
        html += `<div class="form-group" data-field-key="${f.key}">`;
        html += `<label>${f.label}</label>`;
        if (f.type === 'input') {
            html += `<input id="field-${f.key}" placeholder="${f.placeholder || ''}" value="${String(val).replace(/"/g, '&quot;')}">`;
        } else if (f.type === 'select') {
            const options = Array.isArray(f.options) ? f.options : [];
            const selectedValue = String(val || options[0]?.value || '');
            html += `<select id="field-${f.key}">`;
            html += options.map(opt => {
                const optValue = String(opt?.value || '');
                const optLabel = String(opt?.label || optValue);
                const selected = optValue === selectedValue ? ' selected' : '';
                return `<option value="${optValue}"${selected}>${optLabel}</option>`;
            }).join('');
            html += `</select>`;
        } else if (f.type === 'file') {
            const accept = String(f.accept || '');
            html += `<input id="field-${f.key}" type="file"${accept ? ` accept="${accept}"` : ''}>`;
            if (existingValues && existingValues.url) {
                html += `<div class="hint">Fichier actuel: ${existingValues.url}</div>`;
            }
        } else {
            html += `<div class="md-editor-wrap">
                <div class="md-toolbar" role="toolbar" aria-label="Mise en forme">
                    <button type="button" class="md-tb-btn" onclick="mdWrap('bold','field-${f.key}')" title="Gras — **mot**"><strong>B</strong></button>
                    <button type="button" class="md-tb-btn md-tb-italic" onclick="mdWrap('italic','field-${f.key}')" title="Italique — *mot*"><em>I</em></button>
                    <button type="button" class="md-tb-btn md-tb-mark" onclick="mdWrap('mark','field-${f.key}')" title="Surligné — ==mot==">S</button>
                    <span class="md-tb-sep"></span>
                    <button type="button" class="md-tb-btn" onclick="mdWrap('link','field-${f.key}')" title="Hyperlien — [texte](url)">🔗</button>
                    <button type="button" class="md-tb-btn" onclick="mdWrap('vocab','field-${f.key}')" title="Terme de vocabulaire — {terme|définition}">📖</button>
                </div>
                <textarea id="field-${f.key}" rows="${f.rows || 3}" placeholder="${f.placeholder || ''}">${val}</textarea>
            </div>`;
        }
        if (f.hint) html += `<div class="hint">${f.hint}</div>`;
        html += `</div>`;
    });

    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('show');

    if (type === 'audio') {
        setupAudioModalInteractions();
    }
}

export function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    state.currentModalType = null;
    state.editingIndex = null;
}

export async function submitBlock() {
    try {
        const config = modalForms[state.currentModalType];
        const data = {};
        config.fields.forEach(f => {
            const el = document.getElementById('field-' + f.key);
            if (!el) {
                data[f.key] = '';
                return;
            }
            if (f.type === 'file') {
                data[f.key] = el.files && el.files.length ? el.files[0] : null;
                return;
            }
            data[f.key] = el.value;
        });

        const parseYesNo = value => /^(1|true|vrai|oui|yes|y)$/i.test(String(value || '').trim());

        const newBlock = { id: 'b' + (++state.idCounter), type: state.currentModalType, visible: true };

        switch (state.currentModalType) {
        case 'source-text':
            newBlock.author = data.author;
            newBlock.title = data.title;
            newBlock.reference = data.reference;
            newBlock.content = data.content;
            break;
        case 'image':
            newBlock.url = data.url;
            newBlock.caption = data.caption;
            newBlock.source = data.source;
            break;
        case 'questions':
            newBlock.questions = data.questions.split('\n').filter(q => q.trim());
            break;
        case 'section-title':
            newBlock.number = data.number;
            newBlock.content = data.content;
            break;
        case 'exercise-qcm':
            newBlock.question = data.question;
            newBlock.options = data.options.split('\n').filter(o => o.trim());
            newBlock.correctIndex = parseInt(data.correctIndex) || 0;
            break;
        case 'exercise-fill':
            newBlock.text = data.text;
            newBlock.blanks = data.blanks.split('\n').filter(l => l.trim()).map(line => {
                const parts = line.split('|');
                return { correct: parts[0].trim(), distractors: parts.slice(1).map(d => d.trim()) };
            });
            break;
        case 'exercise-written':
            newBlock.prompt = data.prompt;
            newBlock.lines = parseInt(data.lines) || 5;
            break;
        case 'definition':
            newBlock.term = data.term;
            newBlock.content = data.content;
            break;
        case 'distinction':
            newBlock.termA = data.termA;
            newBlock.termB = data.termB;
            newBlock.explanationA = data.explanationA;
            newBlock.explanationB = data.explanationB;
            break;
        case 'text-intro':
            newBlock.content = data.content;
            break;
        case 'citation':
            newBlock.quote = data.quote;
            newBlock.author = data.author;
            newBlock.source = data.source;
            break;
        case 'table':
            newBlock.headers = data.headers;
            newBlock.rows = data.rows;
            newBlock.caption = data.caption;
            break;
        case 'link':
            newBlock.label = data.label;
            newBlock.url = data.url;
            newBlock.description = data.description;
            break;
        case 'media':
            newBlock.title = data.title;
            newBlock.url = data.url;
            newBlock.mediaType = data.mediaType;
            newBlock.description = data.description;
            break;
        case 'audio': {
            newBlock.title = data.title;
            newBlock.description = data.description;
            newBlock.sourceMode = String(data.sourceMode || 'link');

            const typedUrl = String(data.url || '').trim();
            if (newBlock.sourceMode === 'upload') {
                if (data.audioFile) {
                    newBlock.url = await uploadAudioFile(data.audioFile);
                    newBlock.uploaded = true;
                } else if (typedUrl) {
                    newBlock.url = typedUrl;
                    newBlock.uploaded = false;
                } else {
                    throw new Error('Choisissez un fichier audio ou renseignez une URL.');
                }
            } else {
                if (!typedUrl) throw new Error('Renseignez une URL audio valide.');
                newBlock.url = typedUrl;
                newBlock.uploaded = false;
            }
            break;
        }
        case 'diagram':
            newBlock.title = data.title;
            newBlock.code = data.code;
            newBlock.caption = data.caption;
            break;
        case 'timeline':
            newBlock.title = data.title;
            newBlock.events = data.events;
            break;
        case 'objectives':
            newBlock.items = data.items;
            break;
        case 'summary':
            newBlock.items = data.items;
            newBlock.flashcard = data.flashcard;
            break;
        case 'method':
            newBlock.title = data.title;
            newBlock.steps = data.steps;
            break;
        case 'warning':
            newBlock.content = data.content;
            newBlock.flashcard = data.flashcard;
            break;
        case 'recall':
            newBlock.content = data.content;
            newBlock.flashcard = data.flashcard;
            break;
        case 'biography':
            newBlock.name = data.name;
            newBlock.dates = data.dates;
            newBlock.role = data.role;
            newBlock.avatarUrl = data.avatarUrl;
            newBlock.content = data.content;
            break;
        case 'example':
            newBlock.title = data.title;
            newBlock.content = data.content;
            break;
        case 'exercise-truefalse':
            newBlock.statements = data.statements;
            newBlock.answers = data.answers;
            break;
        case 'exercise-match':
            newBlock.leftItems = data.leftItems;
            newBlock.rightItems = data.rightItems;
            break;
        case 'exercise-table':
            newBlock.headers = data.headers;
            newBlock.rows = data.rows;
            newBlock.caption = data.caption;
            break;
        case 'exercise-document':
            newBlock.docTitle = data.docTitle;
            newBlock.content = data.content;
            newBlock.source = data.source;
            newBlock.questions = data.questions;
            break;
        case 'exercise-sort':
            newBlock.instruction = data.instruction;
            newBlock.items = data.items;
            break;
        case 'argument-map': {
            const thesis = (data.thesis || '').trim() || 'Nouvelle these';
            const hints = (data.hints || '').split('\n').map(h => h.trim()).filter(Boolean);
            const isExercise = parseYesNo(data.isExercise);

            newBlock.title = (data.title || '').trim();

            const existing = state.editingIndex !== null ? state.blocks[state.editingIndex] : null;
            if (existing?.type === 'argument-map' && existing.argMap) {
                newBlock.argMap = existing.argMap;
                newBlock.argMap.isExercise = isExercise;
                newBlock.argMap.showStrength = false;
                newBlock.argMap.viewMode = 'TREE';
                if (thesis) newBlock.argMap.thesis.content = thesis;
            } else {
                newBlock.argMap = createArgumentMap({ thesis, hints, isExercise });
            }
            break;
        }
        case 'activity-group':
            newBlock.title = data.title;
            newBlock.duration = data.duration;
            newBlock.groups = data.groups;
            newBlock.instructions = data.instructions;
            break;
        case 'activity-oral':
            newBlock.activityType = data.activityType;
            newBlock.title = data.title;
            newBlock.instructions = data.instructions;
            newBlock.duration = data.duration;
            break;
        case 'activity-instruction':
            newBlock.title = data.title;
            newBlock.instructions = data.instructions;
            break;
        case 'differentiation':
            newBlock.standard = data.standard;
            newBlock.advanced = data.advanced;
            newBlock.supported = data.supported;
            break;
        }

        // En mode édition, mettre à jour le bloc existant ; sinon insérer
        if (state.editingIndex !== null) {
            const existing = state.blocks[state.editingIndex];
            Object.assign(existing, newBlock, { id: existing.id, visible: existing.visible });
        } else {
            state.blocks.splice(state.insertIndex + 1, 0, newBlock);
        }
        closeModal();
        renderBlocks();
        save();
    } catch (err) {
        notifyError(err?.message || 'Impossible de sauvegarder ce bloc.');
        console.error('[audio-block]', err);
    }
}
