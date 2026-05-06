// État global de l'application ManuelO

export const REVISION_ALLOWED_BLOCK_TYPES = [
    'summary',
    'warning',
    'recall'
];

export const REVISION_DEFAULT_VISIBLE_TYPES = [
    ...REVISION_ALLOWED_BLOCK_TYPES
];

export const REVISION_DEFAULT_FLASHCARD_SOURCES = [
    ...REVISION_ALLOWED_BLOCK_TYPES
];

const REVISION_ANSWERS = new Set(['AGAIN', 'HARD', 'GOOD', 'EASY']);
const REVISION_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);

function toUniqueStringArray(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
        .map(v => String(v || '').trim())
        .filter(Boolean))];
}

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toTimestamp(value, fallback = null) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
    const d = Date.parse(String(value || ''));
    return Number.isFinite(d) ? d : fallback;
}

function normalizeCardProgress(raw = {}) {
    const history = Array.isArray(raw.history)
        ? raw.history
            .map(entry => {
                const answer = String(entry?.answer || '').toUpperCase();
                if (!REVISION_ANSWERS.has(answer)) return null;
                return {
                    timestamp: toTimestamp(entry.timestamp, Date.now()),
                    answer,
                    responseTime: Math.max(0, Number(entry.responseTime) || 0)
                };
            })
            .filter(Boolean)
        : [];

    return {
        repetitions: Math.max(0, Number(raw.repetitions) || 0),
        easeFactor: Math.max(1.3, Number(raw.easeFactor) || 2.5),
        interval: Math.max(0, Number(raw.interval) || 0),
        lapses: Math.max(0, Number(raw.lapses) || 0),
        nextReviewAt: toTimestamp(raw.nextReviewAt, Date.now()),
        lastReviewedAt: toTimestamp(raw.lastReviewedAt, null),
        history
    };
}

export function createDefaultRevisionConfig() {
    return {
        chaptersIncluded: [],
        visibleBlocTypes: [...REVISION_DEFAULT_VISIBLE_TYPES],
        flashcardSources: [...REVISION_DEFAULT_FLASHCARD_SOURCES],
        shuffleCards: true,
        useSpacedRepetition: true,
        sessionDuration: 15
    };
}

export function createDefaultRevisionState() {
    return {
        config: createDefaultRevisionConfig(),
        flashcards: [],
        progressByUser: {},
        currentUserId: 'eleve-local',
        session: null
    };
}

export function normalizeRevisionState(raw, options = {}) {
    const fallback = createDefaultRevisionState();
    const preserveRuntimeSession = options?.preserveRuntimeSession === true;
    const allowedTypeSet = new Set(REVISION_ALLOWED_BLOCK_TYPES);
    if (!raw || typeof raw !== 'object') return fallback;

    const configRaw = raw.config && typeof raw.config === 'object' ? raw.config : {};
    const normalizedConfig = {
        chaptersIncluded: [...new Set((Array.isArray(configRaw.chaptersIncluded) ? configRaw.chaptersIncluded : [])
            .map(v => toPositiveInt(v, null))
            .filter(v => Number.isFinite(v) && v > 0))],
        visibleBlocTypes: toUniqueStringArray(configRaw.visibleBlocTypes)
            .filter(type => allowedTypeSet.has(type)),
        flashcardSources: toUniqueStringArray(configRaw.flashcardSources)
            .filter(type => allowedTypeSet.has(type)),
        shuffleCards: configRaw.shuffleCards !== false,
        useSpacedRepetition: configRaw.useSpacedRepetition !== false,
        sessionDuration: Math.max(1, Number(configRaw.sessionDuration) || fallback.config.sessionDuration)
    };

    if (!normalizedConfig.visibleBlocTypes.length) {
        normalizedConfig.visibleBlocTypes = [...REVISION_ALLOWED_BLOCK_TYPES];
    }
    if (!normalizedConfig.flashcardSources.length) {
        normalizedConfig.flashcardSources = [...REVISION_ALLOWED_BLOCK_TYPES];
    }

    const flashcards = Array.isArray(raw.flashcards)
        ? raw.flashcards
            .map(card => {
                if (!card || typeof card !== 'object') return null;
                const front = String(card.front || '').trim();
                const back = String(card.back || '').trim();
                if (!front || !back) return null;

                const tags = Array.isArray(card.tags)
                    ? toUniqueStringArray(card.tags)
                    : toUniqueStringArray(String(card.tags || '').split(','));

                const difficulty = String(card.difficulty || '').toUpperCase();
                return {
                    id: String(card.id || '').trim() || `fc-${Math.random().toString(36).slice(2, 10)}`,
                    sourceBlocId: String(card.sourceBlocId || '').trim(),
                    sourceType: String(card.sourceType || '').trim(),
                    front,
                    back,
                    category: String(card.category || '').trim(),
                    difficulty: REVISION_DIFFICULTIES.has(difficulty) ? difficulty : 'MEDIUM',
                    tags,
                    createdAt: toTimestamp(card.createdAt, Date.now()),
                    updatedAt: toTimestamp(card.updatedAt, Date.now())
                };
            })
            .filter(Boolean)
        : [];

    const rawProgress = raw.progressByUser && typeof raw.progressByUser === 'object'
        ? raw.progressByUser
        : {};
    const progressByUser = {};

    Object.keys(rawProgress).forEach(userId => {
        const key = String(userId || '').trim();
        const entries = rawProgress[userId];
        if (!key || !entries || typeof entries !== 'object') return;

        progressByUser[key] = {};
        Object.keys(entries).forEach(cardId => {
            const safeCardId = String(cardId || '').trim();
            if (!safeCardId) return;
            progressByUser[key][safeCardId] = normalizeCardProgress(entries[cardId]);
        });
    });

    return {
        config: normalizedConfig,
        flashcards,
        progressByUser,
        currentUserId: String(raw.currentUserId || '').trim() || fallback.currentUserId,
        session: preserveRuntimeSession && raw.session && typeof raw.session === 'object'
            ? raw.session
            : null
    };
}

export const state = {
    mode: 'prof', // 'prof' | 'eleve' | 'revision'
    insertIndex: 0,
    currentModalType: null,
    editingIndex: null,   // index du bloc en cours d'édition, null = insertion
    currentPage: 1,
    idCounter: 100,
    meta: {
        id: null,
        title: '',
        subject: 'Philosophie',
        level: 'Terminale',
        page1Title: '',     // Titre indépendant de la 1ère page
        page1Subtitle: '',  // Sous-titre de la 1ère page
        createdAt: null,
        updatedAt: null,
    },
    revision: createDefaultRevisionState(),
    blocks: [
        {
            id: 'b1', type: 'section-title', visible: true,
            number: '1',
            content: 'La technique, un auxiliaire au dénuement naturel de l\'homme'
        },
        {
            id: 'b2', type: 'text-intro', visible: true,
            content: 'Platon donne la parole à Protagoras, sophiste grec, pour raconter le mythe de Prométhée, récit fictif qui confère à l\'homme une place particulière parmi les animaux.'
        },
        {
            id: 'b3', type: 'source-text', visible: true,
            author: 'Platon',
            title: 'Protagoras',
            reference: '320c-321c, trad. F. Ildefonse, GF Flammarion, 1997',
            content: 'Il fut un temps où les dieux existaient déjà, mais où les races mortelles n\'existaient pas. Lorsque fut venu le temps de leur naissance, fixé par le destin, les dieux les façonnent à l\'intérieur de la terre, en réalisant un mélange de terre, de feu et de tout ce qui se mêle au feu et à la terre. Puis, lorsque vint le moment de les produire à la lumière, ils chargèrent <strong>Prométhée et Épiméthée</strong> de répartir les capacités entre chacune d\'entre elles, en bon ordre, comme il convient. Épiméthée demande alors avec insistance à Prométhée de le laisser seul opérer la répartition : « Quand elle sera faite, dit-il, tu viendras la contrôler. »'
        },
        {
            id: 'b4', type: 'questions', visible: true,
            questions: [
                'Quel rôle Épiméthée joue-t-il dans la répartition des capacités ?',
                'Pourquoi l\'homme se retrouve-t-il « nu, sans chaussures, sans couverture et sans armes » ?',
                'En quoi le vol du feu par Prométhée peut-il symboliser la technique ?'
            ]
        },
        {
            id: 'b5', type: 'definition', visible: true,
            term: 'Mythe',
            content: 'Récit fabuleux, souvent d\'origine populaire, qui met en scène des êtres surhumains et fait appel au merveilleux pour expliquer des phénomènes naturels ou humains.'
        },
        {
            id: 'b6', type: 'distinction', visible: true,
            termA: 'Technique', termB: 'Nature',
            explanationA: 'Ce qui est produit par l\'activité humaine, par le savoir-faire et l\'artifice.',
            explanationB: 'Ce qui existe indépendamment de l\'intervention humaine, ce qui est donné d\'emblée.'
        }
    ]
};
