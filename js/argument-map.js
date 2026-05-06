// Argument map helpers: data model, layout, and tree mutations

export const ARGUMENT_ROLE_META = {
    THESIS:    { label: 'These',   short: 'T', color: '#4f46e5' },
    SUPPORT:   { label: 'Pour',    short: '+', color: '#16a34a' },
    OBJECTION: { label: 'Contre',  short: '-', color: '#dc2626' }
};

export const ARGUMENT_STRENGTH_META = {
    STRONG:     { label: 'Fort',    weight: 3, dash: '' },
    MODERATE:   { label: 'Moyen',   weight: 2, dash: '' },
    WEAK:       { label: 'Faible',  weight: 1, dash: '4 4' },
    UNASSESSED: { label: 'A evaluer', weight: 2, dash: '' }
};

const NODE_WIDTH = 216;
const H_GAP = 28;
const V_GAP = 148;
const TOP_PAD = 70;
const SIDE_PAD = 44;
const BOTTOM_PAD = 90;

function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeArgumentRole(role) {
    const key = String(role || '').toUpperCase();
    if (ARGUMENT_ROLE_META[key]) return key;

    // Legacy role migration to Kialo-like two-side model.
    if (key === 'COUNTER_OBJECTION') return 'SUPPORT';
    if (key === 'EXAMPLE') return 'SUPPORT';
    if (key === 'NUANCE') return 'SUPPORT';

    return 'SUPPORT';
}

export function normalizeArgumentStrength(strength) {
    const key = String(strength || '').toUpperCase();
    return ARGUMENT_STRENGTH_META[key] ? key : 'UNASSESSED';
}

export function normalizeArgumentViewMode(mode) {
    return 'TREE';
}

export function sanitizeArgumentExternalUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return '';

    try {
        const parsed = new URL(value);
        return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : '';
    } catch (_err) {
        return '';
    }
}

export function createArgumentNode(role, overrides = {}) {
    const normalizedRole = normalizeArgumentRole(role);
    return {
        id: overrides.id || uid('an'),
        role: normalizedRole,
        content: overrides.content || '',
        author: overrides.author || '',
        sourceRef: overrides.sourceRef || '',
        externalUrl: sanitizeArgumentExternalUrl(overrides.externalUrl),
        sourceText: overrides.sourceText || '',
        strength: normalizeArgumentStrength(overrides.strength),
        children: Array.isArray(overrides.children) ? overrides.children : [],
        isCollapsed: !!overrides.isCollapsed,
        isEditable: overrides.isEditable !== false,
        isPlaceholder: !!overrides.isPlaceholder
    };
}

export function createArgumentMap({ thesis = '', hints = [], isExercise = false } = {}) {
    const supportHint = hints[0] || '';
    const objectionHint = hints[1] || '';

    const root = createArgumentNode('THESIS', {
        content: thesis || 'Nouvelle these',
        isEditable: true,
        isPlaceholder: false,
        children: []
    });

    if (isExercise) {
        root.children.push(
            createArgumentNode('SUPPORT', {
                content: supportHint,
                isPlaceholder: true
            })
        );
        root.children.push(
            createArgumentNode('OBJECTION', {
                content: objectionHint,
                isPlaceholder: true
            })
        );
    }

    return {
        id: uid('am'),
        createdBy: '',
        isExercise: !!isExercise,
        showStrength: false,
        viewMode: 'TREE',
        thesis: root
    };
}

function normalizeNode(rawNode, fallbackRole = 'SUPPORT') {
    if (!rawNode || typeof rawNode !== 'object') {
        return createArgumentNode(fallbackRole);
    }

    const node = createArgumentNode(rawNode.role || fallbackRole, {
        id: rawNode.id,
        content: rawNode.content,
        author: rawNode.author,
        sourceRef: rawNode.sourceRef,
        externalUrl: rawNode.externalUrl,
        sourceText: rawNode.sourceText,
        strength: rawNode.strength,
        isCollapsed: rawNode.isCollapsed,
        isEditable: rawNode.isEditable,
        isPlaceholder: rawNode.isPlaceholder,
        children: []
    });

    const children = Array.isArray(rawNode.children) ? rawNode.children : [];
    node.children = children.map(child => normalizeNode(child, 'SUPPORT'));
    return node;
}

export function ensureArgumentMap(block) {
    if (!block || typeof block !== 'object') return createArgumentMap();

    let map = block.argMap || block.map;
    if (!map || typeof map !== 'object') {
        map = createArgumentMap({ thesis: block.thesis || 'Nouvelle these' });
    }

    map.id = map.id || uid('am');
    map.createdBy = map.createdBy || '';
    map.isExercise = !!map.isExercise;
    map.showStrength = false;
    map.viewMode = 'TREE';
    map.thesis = normalizeNode(map.thesis, 'THESIS');

    if (map.thesis.role !== 'THESIS') {
        map.thesis.role = 'THESIS';
    }

    block.argMap = map;
    return map;
}

export function findArgumentNode(root, nodeId, parent = null) {
    if (!root) return null;
    if (String(root.id) === String(nodeId)) return { node: root, parent };

    const children = Array.isArray(root.children) ? root.children : [];
    for (let i = 0; i < children.length; i++) {
        const found = findArgumentNode(children[i], nodeId, root);
        if (found) return found;
    }
    return null;
}

export function addArgumentChild(root, parentId, role, overrides = {}) {
    const target = findArgumentNode(root, parentId);
    if (!target || !target.node) return null;

    const child = createArgumentNode(role, {
        content: overrides.content || '',
        author: overrides.author || '',
        isPlaceholder: overrides.isPlaceholder !== false,
        sourceRef: overrides.sourceRef || '',
        externalUrl: overrides.externalUrl || '',
        sourceText: overrides.sourceText || '',
        strength: overrides.strength || 'UNASSESSED'
    });

    target.node.children.push(child);
    target.node.isCollapsed = false;
    return child;
}

export function removeArgumentNode(root, nodeId) {
    const found = findArgumentNode(root, nodeId);
    if (!found || !found.parent) return false; // root cannot be deleted

    const parent = found.parent;
    parent.children = (parent.children || []).filter(child => String(child.id) !== String(nodeId));
    return true;
}

export function toggleArgumentNode(root, nodeId) {
    const found = findArgumentNode(root, nodeId);
    if (!found || !found.node) return false;
    found.node.isCollapsed = !found.node.isCollapsed;
    return true;
}

export function toggleArgumentNodeRole(root, nodeId) {
    const found = findArgumentNode(root, nodeId);
    if (!found || !found.node) return false;
    if (found.node.role === 'THESIS') return false;
    found.node.role = found.node.role === 'OBJECTION' ? 'SUPPORT' : 'OBJECTION';
    return true;
}

function _isNodeInSubtree(root, searchedId) {
    if (!root) return false;
    if (String(root.id) === String(searchedId)) return true;
    const children = Array.isArray(root.children) ? root.children : [];
    return children.some(child => _isNodeInSubtree(child, searchedId));
}

export function moveArgumentNode(root, nodeId, targetParentId) {
    if (!root) return false;
    if (String(nodeId) === String(targetParentId)) return false;

    const movingFound = findArgumentNode(root, nodeId);
    const targetFound = findArgumentNode(root, targetParentId);

    if (!movingFound || !movingFound.node || !movingFound.parent) return false; // thesis not movable
    if (!targetFound || !targetFound.node) return false;
    if (_isNodeInSubtree(movingFound.node, targetParentId)) return false; // avoid cycles

    const oldParent = movingFound.parent;
    const movingNode = movingFound.node;

    oldParent.children = (oldParent.children || []).filter(child => String(child.id) !== String(nodeId));
    targetFound.node.children = targetFound.node.children || [];
    targetFound.node.children.push(movingNode);
    targetFound.node.isCollapsed = false;
    return true;
}

export function updateArgumentNode(root, nodeId, patch = {}) {
    const found = findArgumentNode(root, nodeId);
    if (!found || !found.node) return false;

    const node = found.node;
    if (typeof patch.content === 'string') node.content = patch.content;
    if (typeof patch.author === 'string') node.author = patch.author;
    if (typeof patch.sourceRef === 'string') node.sourceRef = patch.sourceRef;
    if (typeof patch.externalUrl === 'string') node.externalUrl = sanitizeArgumentExternalUrl(patch.externalUrl);
    if (typeof patch.sourceText === 'string') node.sourceText = patch.sourceText;
    if (typeof patch.isPlaceholder === 'boolean') node.isPlaceholder = patch.isPlaceholder;
    if (typeof patch.strength === 'string') node.strength = normalizeArgumentStrength(patch.strength);
    return true;
}

export function computeArgumentStanceMap(root) {
    const stanceById = new Map();

    function walk(node, parentSupportsThesis = true) {
        const role = normalizeArgumentRole(node.role);
        let supportsThesis = parentSupportsThesis;

        if (role === 'THESIS') supportsThesis = true;
        if (role === 'OBJECTION') supportsThesis = !parentSupportsThesis;

        stanceById.set(String(node.id), {
            isThesis: role === 'THESIS',
            supportsThesis
        });

        const children = Array.isArray(node.children) ? node.children : [];
        children.forEach(child => walk(child, supportsThesis));
    }

    if (root) walk(root, true);
    return stanceById;
}

export function computeArgumentTreeLayout(root, viewMode = 'TREE') {
    if (typeof d3 === 'undefined' || !d3.tree || !d3.hierarchy) {
        console.warn('d3 not available, returning fallback layout');
        return { nodes: [], edges: [], width: 800, height: 600, mode: 'TREE' };
    }

    const mode = 'TREE';
    const nodes = [];
    const edges = [];
    const visibleChildren = node => (node.isCollapsed ? [] : (Array.isArray(node.children) ? node.children : []));

    // Flatten the tree for d3 processing
    const flattenedRoot = {
        id: root.id,
        node: root,
        children: visibleChildren(root).map(child => flattenNode(child))
    };

    function flattenNode(node) {
        return {
            id: node.id,
            node: node,
            children: visibleChildren(node).map(child => flattenNode(child))
        };
    }

    // Create a d3 hierarchy
    const hierarchy = d3.hierarchy(flattenedRoot);
    const treeLayout = d3.tree().nodeSize([250, 150]);
    const treeNodes = treeLayout(hierarchy);

    // Traverse and collect positioned nodes
    let minX = Infinity, maxX = -Infinity, maxY = 0;
    treeNodes.each((d, i) => {
        const x = d.x + 400; // Shift for padding
        const y = d.y + 80;
        const depth = d.depth;
        const parentId = d.parent ? d.parent.data.id : null;

        nodes.push({
            id: d.data.id,
            node: d.data.node,
            parentId: parentId,
            x: x,
            y: y,
            depth: depth,
            d3Node: d
        });

        if (d.parent) {
            edges.push({
                from: d.parent.data.id,
                to: d.data.id,
                parent: d.parent,
                child: d
            });
        }

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });

    // Add padding and ensure minimum dimensions
    const padding = 60;
    const width = Math.max(800, maxX - minX + padding * 2);
    const height = Math.max(600, maxY + padding + 100);

    // Normalize coordinates to start from padding
    nodes.forEach(n => {
        n.x = n.x - minX + padding;
    });

    return { nodes, edges, width, height, mode, hierarchy: treeNodes };
}
