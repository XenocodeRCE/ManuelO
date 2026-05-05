// Parseur markdown inline pour ManuelO
// Syntaxe supportée :
//   **gras**            → <strong>
//   *italique*          → <em>
//   ==surligné==        → <mark class="md-mark">
//   [texte](url)        → <a href="url" target="_blank">
//   {terme|définition}  → terme surligné avec tooltip au clic

/**
 * Parse la syntaxe markdown inline dans une chaîne.
 * Ne touche pas au HTML existant (rétro-compatibilité).
 */
export function parseInline(text) {
    if (!text) return '';
    let s = text;

    // Vocabulaire : {terme|tooltip} → span cliquable avec tooltip
    s = s.replace(
        /\{([^|{}\n]+?)\|([^{}\n]+?)\}/g,
        '<span class="vocab-term" onclick="toggleVocabTooltip(event,this)" data-tooltip="$2">$1</span>'
    );

    // Gras : **texte**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italique : *texte* (astérisque simple, pas **  )
    s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');

    // Surligné : ==texte==
    s = s.replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');

    // Lien : [texte](url) — uniquement http(s)
    s = s.replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return s;
}

/**
 * Comme parseInline + conversion des sauts de ligne en <br>.
 * À utiliser pour les champs de texte libre (paragraphes).
 */
export function parseMd(text) {
    if (!text) return '';
    return parseInline(text).replace(/\n/g, '<br>');
}

/**
 * Bascule la visibilité du tooltip d'un terme de vocabulaire.
 * Appelé en onclick depuis le HTML rendu.
 * Exposé globalement via app.js.
 */
export function toggleVocabTooltip(event, el) {
    event.stopPropagation();
    const isOpen = el.classList.contains('vocab-open');
    // Ferme tous les tooltips ouverts
    document.querySelectorAll('.vocab-term.vocab-open').forEach(t => t.classList.remove('vocab-open'));
    if (!isOpen) el.classList.add('vocab-open');
}
