// État global de l'application ManuelO

export const state = {
    mode: 'prof', // 'prof' | 'eleve'
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
