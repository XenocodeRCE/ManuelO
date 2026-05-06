# ManuelO — Features à implémenter

---

## 1. 🖨️ Impression PDF

### Description

L'utilisateur (prof ou élève) peut exporter tout ou partie du manuel en PDF propre, paginé, avec une mise en page "livre" professionnelle. Il choisit les chapitres, les blocs, le format (A4, A5, livret), et ManuelO génère un PDF fidèle au contenu visible selon les permissions de l'utilisateur.

Le PDF n'est pas un simple "print screen". C'est un **rendu dédié** : typographie soignée, marges correctes, numéros de page, table des matières générée, en-têtes de chapitre, et chaque type de bloc a son propre template d'impression (un bloc frise devient une image statique, un bloc audio devient un QR code vers l'audio, etc.).

Le PDF intègre aussi un **filigrane** configurable par le prof (nom de l'élève, nom de la classe) pour éviter la redistribution sauvage.

### Pseudo-code

```
MODULE PDFExport

// ── Structures ──────────────────────────────────

STRUCTURE ExportConfig
    manuelId          : String
    selectedChapters  : List<ChapterId>       // vide = tout
    selectedBlocs     : List<BlocId>           // vide = tous les blocs des chapitres sélectionnés
    format            : Enum(A4, A5, LIVRET)
    orientation       : Enum(PORTRAIT, PAYSAGE)
    fontSize          : Enum(NORMAL, GRAND, TRES_GRAND)
    includeTableOfContents : Boolean
    includeIndex      : Boolean
    watermark         : String | null          // ex: "Terminale A — Mme Dupont"
    headerLeft        : String                 // ex: nom du manuel
    headerRight       : String                 // ex: nom du chapitre courant
    footerCenter      : String                 // ex: numéro de page
    colorMode         : Enum(COULEUR, NIVEAUX_DE_GRIS, NOIR_ET_BLANC)
END STRUCTURE

STRUCTURE PDFPage
    pageNumber  : Integer
    content     : RenderedContent
    header      : HeaderContent
    footer      : FooterContent
    watermark   : WatermarkOverlay | null
END STRUCTURE

STRUCTURE PDFDocument
    metadata    : { title, author, createdAt, pageCount }
    pages       : List<PDFPage>
    toc         : TableOfContents | null
    fileSize    : Integer  // en bytes
END STRUCTURE

// ── Fonction principale ─────────────────────────

FUNCTION generatePDF(config: ExportConfig, user: User) -> PDFDocument

    // 1. Charger le contenu
    manuel = loadManuel(config.manuelId)
    chapters = filterChapters(manuel, config.selectedChapters)
    blocs = filterBlocs(chapters, config.selectedBlocs)

    // 2. Vérifier les permissions
    FOR EACH bloc IN blocs
        IF NOT userCanExport(user, bloc)
            REMOVE bloc FROM blocs
            ADD warning("Bloc '{bloc.title}' exclu : droits insuffisants")
        END IF
    END FOR

    // 3. Convertir chaque bloc en rendu imprimable
    renderedBlocs = []
    FOR EACH bloc IN blocs
        rendered = renderBlocForPrint(bloc, config)
        APPEND rendered TO renderedBlocs
    END FOR

    // 4. Paginer
    pages = paginate(renderedBlocs, config.format, config.fontSize)

    // 5. Ajouter en-têtes, pieds de page, filigrane
    FOR EACH page IN pages
        page.header = buildHeader(config, page)
        page.footer = buildFooter(config, page)
        IF config.watermark IS NOT null
            page.watermark = buildWatermark(config.watermark, opacity: 0.08)
        END IF
    END FOR

    // 6. Table des matières
    toc = null
    IF config.includeTableOfContents
        toc = generateTOC(pages, chapters)
        PREPEND tocPages(toc) TO pages
        recalculatePageNumbers(pages)
    END IF

    // 7. Assembler le document
    pdf = assemblePDF(pages, toc, metadata: {
        title: manuel.title,
        author: user.name,
        createdAt: NOW(),
        pageCount: LENGTH(pages)
    })

    RETURN pdf
END FUNCTION

// ── Rendu par type de bloc ──────────────────────

FUNCTION renderBlocForPrint(bloc: Bloc, config: ExportConfig) -> RenderedContent

    SWITCH bloc.type

        CASE TEXT:
            // Rendu Markdown/Rich text → HTML paginable
            RETURN renderRichText(bloc.content, config.fontSize)

        CASE IMAGE:
            // Redimensionner selon format page, convertir en CMYK si besoin
            image = resizeForPage(bloc.image, config.format)
            IF config.colorMode == NOIR_ET_BLANC
                image = convertToGrayscale(image)
            END IF
            RETURN renderImage(image, caption: bloc.caption)

        CASE AUDIO:
            // Pas de son dans un PDF → QR code vers l'audio en ligne
            qrCode = generateQRCode(bloc.audioUrl)
            RETURN renderAudioPlaceholder(qrCode, label: bloc.title, duration: bloc.duration)

        CASE FRISE_CHRONOLOGIQUE:
            // Rendu statique de la frise
            friseImage = renderFriseAsImage(bloc.events, width: pageWidth(config.format))
            RETURN renderImage(friseImage)

        CASE SONDAGE:
            // Afficher les résultats figés à l'instant T
            results = getCurrentResults(bloc.sondageId)
            chart = renderBarChart(results)
            RETURN renderImage(chart, caption: "Résultats au " + formatDate(NOW()))

        CASE DEBAT:
            // Rendu textuel des meilleurs arguments
            RETURN renderDebatSummary(bloc.arguments, maxPerSide: 3)

        CASE COMPARAISON:
            // Tableau deux colonnes
            RETURN renderTwoColumnTable(bloc.left, bloc.right, bloc.links)

        CASE KNOWLEDGE_GRAPH:
            // Rendu statique du graphe
            graphImage = renderGraphAsImage(bloc.nodes, bloc.edges, maxWidth: pageWidth(config.format))
            RETURN renderImage(graphImage)

        CASE ARGUMENT_MAP:
            // Arbre d'argumentation en image
            treeImage = renderArgumentTree(bloc.thesis, bloc.arguments)
            RETURN renderImage(treeImage)

        CASE FLASHCARD:
            // Tableau recto/verso
            RETURN renderFlashcardsTable(bloc.cards)

        DEFAULT:
            RETURN renderGenericBloc(bloc)

    END SWITCH
END FUNCTION

// ── Pagination ──────────────────────────────────

FUNCTION paginate(renderedBlocs: List<RenderedContent>, format, fontSize) -> List<PDFPage>

    pages = []
    currentPage = createEmptyPage(format)
    remainingHeight = usableHeight(format, fontSize)

    FOR EACH rendered IN renderedBlocs
        blocHeight = calculateHeight(rendered, format)

        IF blocHeight > remainingHeight
            // Le bloc ne tient pas sur la page courante
            IF blocHeight > usableHeight(format, fontSize)
                // Le bloc est plus grand qu'une page entière → le découper
                chunks = splitContent(rendered, usableHeight(format, fontSize))
                FOR EACH chunk IN chunks
                    IF remainingHeight < calculateHeight(chunk)
                        APPEND currentPage TO pages
                        currentPage = createEmptyPage(format)
                        remainingHeight = usableHeight(format, fontSize)
                    END IF
                    addToPage(currentPage, chunk)
                    remainingHeight -= calculateHeight(chunk)
                END FOR
            ELSE
                // Nouvelle page
                APPEND currentPage TO pages
                currentPage = createEmptyPage(format)
                remainingHeight = usableHeight(format, fontSize)
                addToPage(currentPage, rendered)
                remainingHeight -= blocHeight
            END IF
        ELSE
            addToPage(currentPage, rendered)
            remainingHeight -= blocHeight
        END IF
    END FOR

    // Dernière page
    IF currentPage IS NOT empty
        APPEND currentPage TO pages
    END IF

    // Numéroter
    FOR i FROM 0 TO LENGTH(pages) - 1
        pages[i].pageNumber = i + 1
    END FOR

    RETURN pages
END FUNCTION
```

---

## 2. 📖 Vue Livre

### Description

La vue livre transforme l'interface web en une **simulation de livre physique** : deux pages côte à côte, animation de tournage de page, navigation par clic sur les coins ou swipe. L'élève ou le prof retrouve le confort du livre papier dans le navigateur.

La vue livre n'est pas juste cosmétique — elle recalcule la **pagination en temps réel** selon la taille de l'écran, la taille de police choisie, et le contenu des blocs. Les blocs interactifs (sondage, débat) restent fonctionnels à l'intérieur des pages.

Un mode double page (desktop) et un mode page unique (mobile/tablette portrait) sont automatiquement sélectionnés. La navigation peut aussi se faire via les flèches du clavier ou via une barre de miniatures en bas de l'écran.

### Pseudo-code

```
MODULE BookView

// ── Structures ──────────────────────────────────

STRUCTURE BookConfig
    manuelId       : String
    viewMode       : Enum(DOUBLE_PAGE, SINGLE_PAGE, AUTO)
    fontSize       : Integer          // en px, défaut 16
    theme          : Enum(LIGHT, SEPIA, DARK)
    pageTransition : Enum(FLIP, SLIDE, FADE)
    showThumbnails : Boolean
END STRUCTURE

STRUCTURE BookPage
    pageIndex      : Integer
    blocs          : List<BlocSlice>   // un bloc peut être découpé sur plusieurs pages
    isLeftPage     : Boolean           // recto ou verso
END STRUCTURE

STRUCTURE BlocSlice
    blocId         : String
    fullBloc       : Boolean           // true si le bloc tient en entier sur cette page
    sliceIndex     : Integer           // 0 = début du bloc, 1 = suite, etc.
    content        : RenderedContent
END STRUCTURE

STRUCTURE BookState
    pages          : List<BookPage>
    currentSpread  : Integer           // index de la double page affichée (0, 2, 4...)
    totalPages     : Integer
    config         : BookConfig
    isAnimating    : Boolean
END STRUCTURE

// ── Initialisation ──────────────────────────────

FUNCTION initBookView(manuelId: String, screenWidth: Integer, screenHeight: Integer) -> BookState

    config = loadUserBookConfig(manuelId) OR defaultBookConfig()

    // Déterminer le mode d'affichage
    IF config.viewMode == AUTO
        IF screenWidth >= 1024
            config.viewMode = DOUBLE_PAGE
        ELSE
            config.viewMode = SINGLE_PAGE
        END IF
    END IF

    // Calculer les dimensions d'une page
    pageDimensions = calculatePageDimensions(screenWidth, screenHeight, config.viewMode)

    // Charger tous les blocs du manuel dans l'ordre
    blocs = loadAllBlocsOrdered(manuelId)

    // Paginer les blocs dans des pages virtuelles
    pages = paginateForBookView(blocs, pageDimensions, config.fontSize)

    RETURN BookState {
        pages: pages,
        currentSpread: 0,
        totalPages: LENGTH(pages),
        config: config,
        isAnimating: false
    }
END FUNCTION

// ── Pagination pour vue livre ───────────────────

FUNCTION paginateForBookView(blocs, pageDimensions, fontSize) -> List<BookPage>

    pages = []
    currentPage = createBookPage(index: 0)
    availableHeight = pageDimensions.contentHeight

    FOR EACH bloc IN blocs

        blocRendered = renderBlocForBook(bloc, pageDimensions.contentWidth, fontSize)
        blocHeight = measureHeight(blocRendered)

        IF blocHeight <= availableHeight
            // Le bloc tient sur la page courante
            APPEND BlocSlice {
                blocId: bloc.id,
                fullBloc: true,
                sliceIndex: 0,
                content: blocRendered
            } TO currentPage.blocs
            availableHeight -= blocHeight

        ELSE IF blocHeight <= pageDimensions.contentHeight
            // Le bloc tient sur une page mais pas la courante → page suivante
            FINALIZE currentPage INTO pages
            currentPage = createBookPage(index: LENGTH(pages))
            availableHeight = pageDimensions.contentHeight

            APPEND fullBlocSlice(bloc, blocRendered) TO currentPage.blocs
            availableHeight -= blocHeight

        ELSE
            // Le bloc est trop grand → découper en slices
            slices = sliceBloc(blocRendered, pageDimensions.contentHeight, availableHeight)

            FOR EACH slice IN slices
                IF slice == slices[0] AND availableHeight >= measureHeight(slice)
                    // Première slice sur la page courante
                    APPEND slice TO currentPage.blocs
                    availableHeight -= measureHeight(slice)
                ELSE
                    FINALIZE currentPage INTO pages
                    currentPage = createBookPage(index: LENGTH(pages))
                    availableHeight = pageDimensions.contentHeight
                    APPEND slice TO currentPage.blocs
                    availableHeight -= measureHeight(slice)
                END IF
            END FOR
        END IF
    END FOR

    FINALIZE currentPage INTO pages

    // Marquer recto/verso
    FOR i FROM 0 TO LENGTH(pages) - 1
        pages[i].isLeftPage = (i MOD 2 == 0)
    END FOR

    RETURN pages
END FUNCTION

// ── Navigation ──────────────────────────────────

FUNCTION goToNextSpread(state: BookState) -> BookState
    IF state.isAnimating THEN RETURN state
    IF state.config.viewMode == DOUBLE_PAGE
        nextSpread = state.currentSpread + 2
    ELSE
        nextSpread = state.currentSpread + 1
    END IF

    IF nextSpread >= state.totalPages THEN RETURN state

    state.isAnimating = true
    playTransition(state.config.pageTransition, direction: FORWARD, THEN: () ->
        state.currentSpread = nextSpread
        state.isAnimating = false
    )
    RETURN state
END FUNCTION

FUNCTION goToPrevSpread(state: BookState) -> BookState
    IF state.isAnimating THEN RETURN state
    IF state.config.viewMode == DOUBLE_PAGE
        prevSpread = state.currentSpread - 2
    ELSE
        prevSpread = state.currentSpread - 1
    END IF

    IF prevSpread < 0 THEN RETURN state

    state.isAnimating = true
    playTransition(state.config.pageTransition, direction: BACKWARD, THEN: () ->
        state.currentSpread = prevSpread
        state.isAnimating = false
    )
    RETURN state
END FUNCTION

FUNCTION goToPage(state: BookState, pageIndex: Integer) -> BookState
    IF state.config.viewMode == DOUBLE_PAGE
        // S'aligner sur une double page paire
        targetSpread = pageIndex - (pageIndex MOD 2)
    ELSE
        targetSpread = pageIndex
    END IF
    targetSpread = CLAMP(targetSpread, 0, state.totalPages - 1)

    state.isAnimating = true
    playTransition(FADE, THEN: () ->
        state.currentSpread = targetSpread
        state.isAnimating = false
    )
    RETURN state
END FUNCTION

// ── Rendu de la double page ─────────────────────

FUNCTION renderSpread(state: BookState) -> UIElement

    IF state.config.viewMode == DOUBLE_PAGE
        leftPage  = state.pages[state.currentSpread]
        rightPage = state.pages[state.currentSpread + 1] OR emptyPage()

        RETURN HorizontalLayout {
            children: [
                renderPage(leftPage, state.config, side: LEFT),
                pageDividerShadow(),
                renderPage(rightPage, state.config, side: RIGHT)
            ],
            className: "book-spread"
        }
    ELSE
        page = state.pages[state.currentSpread]
        RETURN renderPage(page, state.config, side: CENTER)
    END IF
END FUNCTION

FUNCTION renderPage(page: BookPage, config: BookConfig, side: Enum) -> UIElement

    RETURN PageContainer {
        theme: config.theme,
        side: side,
        children: [
            pageHeader(page.pageIndex, side),
            FOR EACH slice IN page.blocs
                renderBlocSlice(slice),
            pageFooter(page.pageIndex)
        ],
        onClick: (clickPosition) ->
            IF clickPosition.x < 0.3  // clic à gauche
                goToPrevSpread()
            ELSE IF clickPosition.x > 0.7  // clic à droite
                goToNextSpread()
            END IF,
        onSwipeLeft: goToNextSpread,
        onSwipeRight: goToPrevSpread
    }
END FUNCTION

// ── Barre de miniatures ─────────────────────────

FUNCTION renderThumbnailBar(state: BookState) -> UIElement

    IF NOT state.config.showThumbnails THEN RETURN null

    thumbnails = []
    FOR EACH page IN state.pages
        thumb = generateThumbnail(page, width: 60, height: 80)
        isActive = (page.pageIndex == state.currentSpread
                    OR page.pageIndex == state.currentSpread + 1)
        APPEND ThumbnailItem {
            image: thumb,
            isActive: isActive,
            onClick: () -> goToPage(state, page.pageIndex)
        } TO thumbnails
    END FOR

    RETURN ScrollableBar {
        children: thumbnails,
        position: BOTTOM,
        className: "thumbnail-bar"
    }
END FUNCTION

// ── Gestion clavier ─────────────────────────────

FUNCTION handleKeyboard(state: BookState, key: KeyEvent) -> BookState
    SWITCH key
        CASE ARROW_RIGHT, PAGE_DOWN, SPACE:
            RETURN goToNextSpread(state)
        CASE ARROW_LEFT, PAGE_UP:
            RETURN goToPrevSpread(state)
        CASE HOME:
            RETURN goToPage(state, 0)
        CASE END:
            RETURN goToPage(state, state.totalPages - 1)
    END SWITCH
    RETURN state
END FUNCTION

// ── Redimensionnement ───────────────────────────

FUNCTION onWindowResize(state: BookState, newWidth, newHeight) -> BookState
    // Recalculer le mode et repaginer
    IF state.config.viewMode == AUTO
        IF newWidth >= 1024
            state.config.viewMode = DOUBLE_PAGE
        ELSE
            state.config.viewMode = SINGLE_PAGE
        END IF
    END IF

    // Sauvegarder la position actuelle (en % du contenu)
    scrollPercent = state.currentSpread / state.totalPages

    // Repaginer
    pageDimensions = calculatePageDimensions(newWidth, newHeight, state.config.viewMode)
    blocs = loadAllBlocsOrdered(state.manuelId)
    state.pages = paginateForBookView(blocs, pageDimensions, state.config.fontSize)
    state.totalPages = LENGTH(state.pages)

    // Restaurer la position approximative
    state.currentSpread = ROUND(scrollPercent * state.totalPages)
    IF state.config.viewMode == DOUBLE_PAGE
        state.currentSpread -= (state.currentSpread MOD 2)
    END IF

    RETURN state
END FUNCTION
```

---

## 3. 🕸️ Knowledge Graph

### Description

Le Knowledge Graph est une **visualisation interactive du réseau conceptuel** du manuel. Chaque nœud est un concept, un auteur, une œuvre, ou un repère philosophique. Les arêtes représentent des relations typées (influence, opposition, illustre, appartient à...).

L'élève ou le prof explore le manuel de manière **non-linéaire**. En cliquant sur un nœud, il voit tous les blocs du manuel qui y sont rattachés. En zoomant, les clusters de notions liées apparaissent (ex: "courant empiriste" regroupe Locke, Hume, Berkeley). Le graphe est généré **automatiquement** à partir des tags et métadonnées des blocs, mais le prof peut aussi créer des liens manuels.

Le graphe supporte le zoom, le pan, le filtrage par type de nœud, la recherche, et le surlignage de chemins entre deux concepts.

### Pseudo-code

```
MODULE KnowledgeGraph

// ── Structures ──────────────────────────────────

ENUM NodeType
    CONCEPT           // ex: "Liberté", "Justice"
    AUTHOR            // ex: "Kant", "Sartre"
    WORK              // ex: "Critique de la raison pure"
    REPERE            // ex: "Absolu/Relatif"
    CHAPTER           // ex: "Chapitre 3 : La liberté"
    BLOC              // ex: un bloc texte spécifique
END ENUM

ENUM EdgeType
    INFLUENCE         // Platon → Aristote
    OPPOSITION        // Empirisme ↔ Rationalisme
    ILLUSTRE          // "Allégorie de la caverne" → Vérité
    BELONGS_TO        // Kant → Idéalisme allemand
    REFERENCES        // Bloc 5 → Kant
    DEFINES           // Bloc 3 → "Liberté"
    PREREQUISITE      // Logique → Métaphysique (il faut comprendre X avant Y)
END ENUM

STRUCTURE GraphNode
    id              : String
    type            : NodeType
    label           : String
    description     : String           // tooltip au survol
    linkedBlocIds   : List<BlocId>     // blocs du manuel liés à ce nœud
    position        : { x: Float, y: Float }  // calculé par le layout
    size            : Float            // proportionnel au nombre de connexions
    color           : String           // par type
    cluster         : String | null    // ex: "Empirisme", "Antiquité"
    metadata        : Map<String, Any> // dates, courant, nationalité...
END STRUCTURE

STRUCTURE GraphEdge
    id              : String
    source          : NodeId
    target          : NodeId
    type            : EdgeType
    label           : String | null    // ex: "s'oppose à"
    weight          : Float            // force du lien, affecte le layout
    bidirectional   : Boolean
END STRUCTURE

STRUCTURE KnowledgeGraphData
    nodes           : List<GraphNode>
    edges           : List<GraphEdge>
    clusters        : List<Cluster>
END STRUCTURE

STRUCTURE Cluster
    id              : String
    label           : String           // ex: "Philosophie antique"
    nodeIds         : List<NodeId>
    color           : String
    hullPoints      : List<Point>      // enveloppe convexe pour le fond visuel
END STRUCTURE

STRUCTURE GraphViewState
    graph           : KnowledgeGraphData
    zoom            : Float            // 1.0 = 100%
    pan             : { x: Float, y: Float }
    selectedNode    : NodeId | null
    hoveredNode     : NodeId | null
    highlightedPath : List<NodeId> | null
    filters         : {
        nodeTypes   : Set<NodeType>     // types visibles
        searchQuery : String
    }
    layout          : Enum(FORCE, HIERARCHICAL, RADIAL, CLUSTER)
END STRUCTURE

// ── Construction du graphe ──────────────────────

FUNCTION buildKnowledgeGraph(manuelId: String) -> KnowledgeGraphData

    manuel = loadManuel(manuelId)
    nodes = []
    edges = []
    nodeIndex = {}   // label -> nodeId pour dédupliquer

    // 1. Extraire les nœuds depuis les blocs et leurs tags
    FOR EACH bloc IN manuel.allBlocs

        // Créer un nœud pour le bloc lui-même (optionnel, caché par défaut)
        blocNode = createNode(type: BLOC, label: bloc.title, linkedBlocs: [bloc.id])
        APPEND blocNode TO nodes
        nodeIndex[bloc.id] = blocNode.id

        // Extraire concepts/auteurs/œuvres depuis les tags du bloc
        FOR EACH tag IN bloc.tags
            IF tag.key == "concept"
                node = getOrCreateNode(nodeIndex, nodes, type: CONCEPT, label: tag.value)
                APPEND Edge(source: blocNode.id, target: node.id, type: REFERENCES) TO edges

            ELSE IF tag.key == "author"
                node = getOrCreateNode(nodeIndex, nodes, type: AUTHOR, label: tag.value)
                APPEND Edge(source: blocNode.id, target: node.id, type: REFERENCES) TO edges

            ELSE IF tag.key == "work"
                node = getOrCreateNode(nodeIndex, nodes, type: WORK, label: tag.value)
                APPEND Edge(source: blocNode.id, target: node.id, type: REFERENCES) TO edges

            ELSE IF tag.key == "repere"
                node = getOrCreateNode(nodeIndex, nodes, type: REPERE, label: tag.value)
                APPEND Edge(source: blocNode.id, target: node.id, type: DEFINES) TO edges
            END IF
        END FOR
    END FOR

    // 2. Ajouter les relations sémantiques (définies par le prof ou pré-configurées)
    semanticRelations = loadSemanticRelations(manuelId)
    FOR EACH relation IN semanticRelations
        sourceNode = nodeIndex[relation.source]
        targetNode = nodeIndex[relation.target]
        IF sourceNode AND targetNode
            APPEND Edge(
                source: sourceNode,
                target: targetNode,
                type: relation.type,
                label: relation.label,
                bidirectional: relation.type == OPPOSITION
            ) TO edges
        END IF
    END FOR

    // 3. Calculer la taille des nœuds (proportionnelle aux connexions)
    FOR EACH node IN nodes
        connectionCount = COUNT(edges WHERE source == node.id OR target == node.id)
        node.size = BASE_SIZE + (connectionCount * SIZE_FACTOR)
    END FOR

    // 4. Détecter les clusters automatiquement
    clusters = detectClusters(nodes, edges)  // algorithme de Louvain ou similaire

    // 5. Calculer le layout initial
    positions = computeForceDirectedLayout(nodes, edges, clusters)
    FOR EACH node IN nodes
        node.position = positions[node.id]
    END FOR

    RETURN KnowledgeGraphData { nodes, edges, clusters }
END FUNCTION

// ── Layout force-directed ───────────────────────

FUNCTION computeForceDirectedLayout(nodes, edges, clusters) -> Map<NodeId, Position>

    positions = initializeRandomPositions(nodes)
    velocities = initializeZeroVelocities(nodes)

    FOR iteration FROM 1 TO MAX_ITERATIONS

        forces = initializeZeroForces(nodes)

        // Force de répulsion entre tous les nœuds (Coulomb)
        FOR EACH pair (nodeA, nodeB) IN allPairs(nodes)
            distance = euclideanDistance(positions[nodeA.id], positions[nodeB.id])
            IF distance < MIN_DISTANCE THEN distance = MIN_DISTANCE
            repulsion = REPULSION_CONSTANT / (distance * distance)
            direction = normalize(positions[nodeA.id] - positions[nodeB.id])
            forces[nodeA.id] += direction * repulsion
            forces[nodeB.id] -= direction * repulsion
        END FOR

        // Force d'attraction le long des arêtes (ressort)
        FOR EACH edge IN edges
            distance = euclideanDistance(positions[edge.source], positions[edge.target])
            attraction = ATTRACTION_CONSTANT * (distance - IDEAL_EDGE_LENGTH) * edge.weight
            direction = normalize(positions[edge.target] - positions[edge.source])
            forces[edge.source] += direction * attraction
            forces[edge.target] -= direction * attraction
        END FOR

        // Force de gravité vers le centre du cluster
        FOR EACH cluster IN clusters
            clusterCenter = centroid(positions, cluster.nodeIds)
            FOR EACH nodeId IN cluster.nodeIds
                direction = normalize(clusterCenter - positions[nodeId])
                distance = euclideanDistance(positions[nodeId], clusterCenter)
                forces[nodeId] += direction * CLUSTER_GRAVITY * distance
            END FOR
        END FOR

        // Appliquer les forces avec amortissement
        FOR EACH node IN nodes
            velocities[node.id] = (velocities[node.id] + forces[node.id]) * DAMPING
            positions[node.id] += velocities[node.id]
        END FOR

        // Vérifier la convergence
        totalMovement = SUM(magnitude(velocities[n.id]) FOR n IN nodes)
        IF totalMovement < CONVERGENCE_THRESHOLD THEN BREAK

    END FOR

    RETURN positions
END FUNCTION

// ── Interactions ────────────────────────────────

FUNCTION onNodeClick(state: GraphViewState, nodeId: NodeId) -> GraphViewState

    node = findNode(state.graph, nodeId)
    state.selectedNode = nodeId

    // Mettre en surbrillance les nœuds connectés
    connectedIds = getConnectedNodeIds(state.graph.edges, nodeId)
    FOR EACH n IN state.graph.nodes
        IF n.id == nodeId
            n.highlighted = true
            n.opacity = 1.0
        ELSE IF n.id IN connectedIds
            n.highlighted = true
            n.opacity = 0.9
        ELSE
            n.highlighted = false
            n.opacity = 0.15   // estomper les nœuds non liés
        END IF
    END FOR

    RETURN state
END FUNCTION

FUNCTION onNodeHover(state: GraphViewState, nodeId: NodeId) -> Tooltip

    node = findNode(state.graph, nodeId)

    RETURN Tooltip {
        title: node.label,
        subtitle: node.type,
        description: node.description,
        linkedBlocs: LENGTH(node.linkedBlocIds) + " blocs liés",
        connections: COUNT(edgesFor(nodeId)) + " connexions"
    }
END FUNCTION

FUNCTION findPath(state: GraphViewState, fromId: NodeId, toId: NodeId) -> GraphViewState

    // Dijkstra pour trouver le plus court chemin
    path = dijkstra(state.graph.nodes, state.graph.edges, fromId, toId)

    IF path IS EMPTY
        NOTIFY("Aucun chemin trouvé entre ces deux concepts")
        RETURN state
    END IF

    state.highlightedPath = path

    // Animer le chemin
    FOR EACH nodeId IN path
        highlightNodeAnimated(nodeId, delay: INDEX * 300ms)
    END FOR

    RETURN state
END FUNCTION

FUNCTION filterGraph(state: GraphViewState, filters) -> GraphViewState

    state.filters = filters

    FOR EACH node IN state.graph.nodes
        visible = true
        IF node.type NOT IN filters.nodeTypes
            visible = false
        END IF
        IF filters.searchQuery IS NOT EMPTY
            IF NOT matches(node.label, filters.searchQuery)
                visible = false
            END IF
        END IF
        node.visible = visible
    END FOR

    // Masquer les edges dont les deux extrémités sont cachées
    FOR EACH edge IN state.graph.edges
        sourceVisible = findNode(state.graph, edge.source).visible
        targetVisible = findNode(state.graph, edge.target).visible
        edge.visible = sourceVisible AND targetVisible
    END FOR

    RETURN state
END FUNCTION

// ── Navigation vers le contenu ──────────────────

FUNCTION openNodeContent(nodeId: NodeId, graph: KnowledgeGraphData)

    node = findNode(graph, nodeId)

    IF LENGTH(node.linkedBlocIds) == 1
        // Un seul bloc lié → naviguer directement
        navigateToBloc(node.linkedBlocIds[0])

    ELSE IF LENGTH(node.linkedBlocIds) > 1
        // Plusieurs blocs → afficher un panneau latéral avec la liste
        showSidePanel({
            title: node.label,
            items: FOR EACH blocId IN node.linkedBlocIds
                bloc = loadBloc(blocId)
                RETURN { title: bloc.title, chapter: bloc.chapterTitle, preview: truncate(bloc.content, 100) }
        })
    END IF
END FUNCTION
```

---

## 4. 🗺️ Carte d'Argument Interactive

### Description

La carte d'argument est un **arbre visuel de raisonnement**. Au sommet se trouve une thèse (ex : "La liberté est une illusion"). En dessous, les arguments pour et contre se ramifient, avec pour chacun des sous-arguments, des exemples, des objections, et des réponses aux objections.

L'élève peut **déplier/replier** chaque branche, ajouter ses propres arguments (dans sa copie personnelle), et le prof peut proposer un arbre pré-rempli ou un arbre vide à compléter comme exercice.

Chaque nœud de l'arbre peut pointer vers un bloc du manuel (un texte de Descartes qui soutient l'argument, par exemple). Les couleurs codent la position : vert pour "soutient", rouge pour "réfute", bleu pour "nuance".

### Pseudo-code

```
MODULE ArgumentMap

// ── Structures ──────────────────────────────────

ENUM ArgumentRole
    THESIS              // la thèse centrale
    SUPPORT             // argument en faveur
    OBJECTION           // argument contre
    COUNTER_OBJECTION   // réponse à une objection
    EXAMPLE             // illustration concrète
    NUANCE              // ni pour ni contre, complexifie
END ENUM

ENUM ArgumentStrength
    STRONG
    MODERATE
    WEAK
    UNASSESSED
END ENUM

STRUCTURE ArgumentNode
    id              : String
    role            : ArgumentRole
    content         : String             // le texte de l'argument
    author          : String | null       // "Kant", "élève", "prof"
    sourceRef       : BlocId | null       // lien vers le bloc du manuel
    strength        : ArgumentStrength
    children        : List<ArgumentNode>  // sous-arguments
    isCollapsed     : Boolean             // déplié/replié
    isEditable      : Boolean             // l'élève peut-il modifier ?
    isPlaceholder   : Boolean             // nœud vide à remplir (exercice)
    position        : { x: Float, y: Float }
    color           : String              // déduit du role
END STRUCTURE

STRUCTURE ArgumentMap
    id              : String
    blocId          : String             // le bloc qui contient cette carte
    thesis          : ArgumentNode       // racine de l'arbre
    createdBy       : UserId
    isExercise      : Boolean            // true = carte à compléter par l'élève
    showStrength    : Boolean            // afficher les jauges de force
END STRUCTURE

STRUCTURE ArgumentMapState
    map             : ArgumentMap
    selectedNode    : NodeId | null
    editingNode     : NodeId | null
    zoom            : Float
    pan             : { x: Float, y: Float }
    viewMode        : Enum(TREE, HORIZONTAL, RADIAL)
END STRUCTURE

// ── Layout de l'arbre ───────────────────────────

FUNCTION computeTreeLayout(thesis: ArgumentNode, viewMode) -> void

    IF viewMode == TREE

        // Layout vertical top-down
        FUNCTION layoutSubtree(node, x, y, depth)
            node.position = { x, y }
            IF node.isCollapsed OR LENGTH(node.children) == 0
                RETURN subtreeWidth: NODE_WIDTH
            END IF

            visibleChildren = FILTER(node.children, child -> NOT child.isCollapsed)
            childWidths = []
            FOR EACH child IN visibleChildren
                width = layoutSubtree(child, 0, y + VERTICAL_SPACING, depth + 1)
                APPEND width TO childWidths
            END FOR

            totalWidth = SUM(childWidths) + (LENGTH(visibleChildren) - 1) * HORIZONTAL_GAP
            startX = x - totalWidth / 2
            cursor = startX

            FOR i FROM 0 TO LENGTH(visibleChildren) - 1
                childCenterX = cursor + childWidths[i] / 2
                visibleChildren[i].position.x = childCenterX
                cursor += childWidths[i] + HORIZONTAL_GAP
            END FOR

            RETURN subtreeWidth: totalWidth
        END FUNCTION

        layoutSubtree(thesis, x: 0, y: 0, depth: 0)

    ELSE IF viewMode == HORIZONTAL
        // Layout gauche → droite (la thèse à gauche, arguments à droite)
        // ... similaire mais axes inversés
    END IF
END FUNCTION

// ── Rendu ───────────────────────────────────────

FUNCTION renderArgumentNode(node: ArgumentNode, state: ArgumentMapState) -> UIElement

    // Couleur selon le rôle
    color = SWITCH node.role
        CASE THESIS:            -> "#6366F1"   // indigo
        CASE SUPPORT:           -> "#22C55E"   // vert
        CASE OBJECTION:         -> "#EF4444"   // rouge
        CASE COUNTER_OBJECTION: -> "#F59E0B"   // orange
        CASE EXAMPLE:           -> "#8B5CF6"   // violet
        CASE NUANCE:            -> "#3B82F6"   // bleu
    END SWITCH

    isSelected = (state.selectedNode == node.id)
    isEditing = (state.editingNode == node.id)

    RETURN Group {
        // Lignes vers les enfants
        FOR EACH child IN node.children WHERE NOT child.isCollapsed
            Line(
                from: node.position,
                to: child.position,
                color: child.color,
                strokeWidth: IF child.strength == STRONG THEN 3 ELSE 1,
                dashed: child.strength == WEAK,
                animated: isSelected
            ),

        // Le nœud lui-même
        NodeCard(
            position: node.position,
            width: NODE_WIDTH,
            backgroundColor: color,
            border: IF isSelected THEN "3px solid black" ELSE "1px solid gray",
            borderRadius: IF node.role == THESIS THEN 16 ELSE 8,
            shadow: IF isSelected THEN LARGE ELSE SMALL,

            children: [
                // Badge du rôle
                Badge(text: labelForRole(node.role), color: darken(color)),

                // Contenu
                IF isEditing
                    TextArea(
                        value: node.content,
                        onChange: (text) -> updateNodeContent(node.id, text),
                        autoFocus: true,
                        onBlur: () -> state.editingNode = null
                    )
                ELSE IF node.isPlaceholder
                    PlaceholderText(
                        text: "Cliquez pour ajouter un argument...",
                        icon: "✏️"
                    )
                ELSE
                    Text(node.content, maxLines: 4),

                // Auteur / source
                IF node.author
                    SmallText("— " + node.author, italic: true),
                IF node.sourceRef
                    LinkButton(
                        text: "📖 Voir le texte",
                        onClick: () -> navigateToBloc(node.sourceRef)
                    ),

                // Jauge de force
                IF state.map.showStrength AND node.role != THESIS
                    StrengthIndicator(node.strength),

                // Bouton déplier/replier
                IF LENGTH(node.children) > 0
                    CollapseButton(
                        isCollapsed: node.isCollapsed,
                        childCount: LENGTH(node.children),
                        onClick: () -> toggleCollapse(node)
                    ),

                // Boutons d'action (au survol)
                IF isSelected
                    ActionBar([
                        Button("+ Soutien",   icon: "👍", onClick: () -> addChild(node, SUPPORT)),
                        Button("+ Objection",  icon: "👎", onClick: () -> addChild(node, OBJECTION)),
                        Button("+ Exemple",    icon: "💡", onClick: () -> addChild(node, EXAMPLE)),
                        Button("+ Nuance",     icon: "⚖️",  onClick: () -> addChild(node, NUANCE)),
                        Button("Modifier",     icon: "✏️", onClick: () -> state.editingNode = node.id),
                        Button("Supprimer",    icon: "🗑️", onClick: () -> removeNode(node), visible: node.isEditable)
                    ])
            ]
        ),

        // Rendu récursif des enfants
        IF NOT node.isCollapsed
            FOR EACH child IN node.children
                renderArgumentNode(child, state)
    }
END FUNCTION

// ── Actions ─────────────────────────────────────

FUNCTION addChild(parentNode: ArgumentNode, role: ArgumentRole)

    newNode = ArgumentNode {
        id: generateId(),
        role: role,
        content: "",
        author: currentUser().name,
        sourceRef: null,
        strength: UNASSESSED,
        children: [],
        isCollapsed: false,
        isEditable: true,
        isPlaceholder: true
    }

    APPEND newNode TO parentNode.children
    recomputeLayout()
    state.editingNode = newNode.id
    state.selectedNode = newNode.id
END FUNCTION

FUNCTION toggleCollapse(node: ArgumentNode)
    node.isCollapsed = NOT node.isCollapsed
    recomputeLayout()
    animateLayoutTransition()
END FUNCTION

// ── Mode exercice ───────────────────────────────

FUNCTION createExerciseMap(thesis: String, hints: List<String>) -> ArgumentMap

    // Le prof crée une carte avec des emplacements vides
    thesisNode = ArgumentNode {
        id: generateId(),
        role: THESIS,
        content: thesis,
        isEditable: false,
        isPlaceholder: false,
        children: [
            // Emplacements vides pour les élèves
            ArgumentNode {
                role: SUPPORT,
                content: hints[0] OR "",
                isPlaceholder: true,
                isEditable: true,
                children: [
                    ArgumentNode { role: EXAMPLE, isPlaceholder: true, isEditable: true }
                ]
            },
            ArgumentNode {
                role: OBJECTION,
                content: hints[1] OR "",
                isPlaceholder: true,
                isEditable: true,
                children: [
                    ArgumentNode { role: COUNTER_OBJECTION, isPlaceholder: true, isEditable: true }
                ]
            }
        ]
    }

    RETURN ArgumentMap {
        thesis: thesisNode,
        isExercise: true,
        showStrength: false
    }
END FUNCTION

// ── Évaluation de la carte d'un élève ───────────

FUNCTION evaluateStudentMap(studentMap: ArgumentMap, referenceMap: ArgumentMap) -> Evaluation

    RETURN Evaluation {
        totalNodes: countNodes(studentMap.thesis),
        filledNodes: countNonPlaceholder(studentMap.thesis),
        hasSupport: hasChildOfRole(studentMap.thesis, SUPPORT),
        hasObjection: hasChildOfRole(studentMap.thesis, OBJECTION),
        hasCounterObjection: hasDescendantOfRole(studentMap.thesis, COUNTER_OBJECTION),
        hasExamples: hasDescendantOfRole(studentMap.thesis, EXAMPLE),
        depth: maxDepth(studentMap.thesis),
        sourcesLinked: countNodesWithSourceRef(studentMap.thesis),
        feedback: generateFeedback(studentMap, referenceMap)
    }
END FUNCTION
```

---

## 5. 📝 Mode Révision (Flashcards auto-générées)

### Description

Le mode révision transforme le manuel en **outil de révision** en un clic. Il masque tout le contenu développé et ne garde que l'essentiel : définitions, repères, thèses clés, noms d'auteurs avec leurs concepts. Pour chaque bloc pertinent, une **flashcard** est automatiquement générée (recto = question, verso = réponse).

Le prof peut configurer quels types de blocs sont visibles en mode révision et quels champs génèrent des flashcards. L'algorithme de répétition espacée (inspiré d'Anki) priorise les cartes que l'élève maîtrise le moins.

### Pseudo-code

```
MODULE RevisionMode

// ── Structures ──────────────────────────────────

STRUCTURE RevisionConfig
    manuelId              : String
    chaptersIncluded      : List<ChapterId>      // vide = tout
    visibleBlocTypes      : Set<BlocType>         // ex: {DEFINITION, REPERE, THESE, RESUME}
    flashcardSources      : Set<BlocType>         // blocs qui génèrent des flashcards
    shuffleCards          : Boolean
    useSpacedRepetition   : Boolean
    sessionDuration       : Integer | null         // en minutes, null = illimité
END STRUCTURE

STRUCTURE Flashcard
    id                : String
    sourceBlocId      : BlocId
    front             : String              // question / prompt
    back              : String              // réponse
    category          : String              // ex: "Définition", "Auteur", "Repère"
    difficulty         : Enum(EASY, MEDIUM, HARD)
    tags              : List<String>
END STRUCTURE

STRUCTURE CardProgress
    cardId            : String
    userId            : String
    easeFactor        : Float               // facteur SM-2 (défaut: 2.5)
    interval          : Integer             // jours avant prochaine révision
    repetitions       : Integer             // nombre de révisions réussies
    nextReviewDate    : Date
    lastAnswer        : Enum(AGAIN, HARD, GOOD, EASY) | null
    history           : List<ReviewEntry>
END STRUCTURE

STRUCTURE ReviewEntry
    date              : DateTime
    answer            : Enum(AGAIN, HARD, GOOD, EASY)
    responseTime      : Integer             // en millisecondes
END STRUCTURE

STRUCTURE RevisionSession
    cards             : List<Flashcard>
    currentIndex      : Integer
    isFlipped         : Boolean
    score             : { correct: Integer, incorrect: Integer, remaining: Integer }
    startedAt         : DateTime
    config            : RevisionConfig
END STRUCTURE

// ── Génération automatique de flashcards ────────

FUNCTION generateFlashcards(manuelId: String, config: RevisionConfig) -> List<Flashcard>

    cards = []
    blocs = loadBlocs(manuelId, chapters: config.chaptersIncluded)

    FOR EACH bloc IN blocs
        IF bloc.type NOT IN config.flashcardSources THEN CONTINUE

        SWITCH bloc.type

            CASE DEFINITION:
                // Recto : "Qu'est-ce que [terme] ?"
                // Verso : la définition
                APPEND Flashcard {
                    front: "Définissez : " + bloc.term,
                    back: bloc.definition,
                    category: "Définition",
                    difficulty: assessDifficulty(bloc.definition)
                } TO cards

            CASE REPERE:
                // Recto : "Distinguez [terme A] et [terme B]"
                // Verso : la distinction
                APPEND Flashcard {
                    front: "Distinguez : " + bloc.termA + " / " + bloc.termB,
                    back: bloc.distinction,
                    category: "Repère",
                    difficulty: MEDIUM
                } TO cards

                // Carte inversée : "À quel repère correspond cette distinction ?"
                APPEND Flashcard {
                    front: bloc.distinction,
                    back: bloc.termA + " / " + bloc.termB,
                    category: "Repère inversé",
                    difficulty: HARD
                } TO cards

            CASE THESE:
                // Recto : "Quelle est la thèse de [auteur] sur [notion] ?"
                // Verso : la thèse
                APPEND Flashcard {
                    front: "Thèse de " + bloc.author + " sur " + bloc.notion + " ?",
                    back: bloc.thesis,
                    category: "Thèse",
                    difficulty: MEDIUM
                } TO cards

                // Carte inversée : "Qui soutient cette thèse ?"
                APPEND Flashcard {
                    front: "Qui soutient : « " + truncate(bloc.thesis, 80) + " » ?",
                    back: bloc.author + " (" + bloc.work + ")",
                    category: "Auteur",
                    difficulty: HARD
                } TO cards

            CASE TEXT:
                // Extraire les éléments clés du texte
                IF bloc.keyQuote
                    APPEND Flashcard {
                        front: "De qui est cette citation et dans quelle œuvre ?\n« " + bloc.keyQuote + " »",
                        back: bloc.author + ", " + bloc.work,
                        category: "Citation",
                        difficulty: HARD
                    } TO cards
                END IF

            CASE RESUME:
                // Convertir chaque point clé en question
                FOR EACH point IN bloc.keyPoints
                    APPEND Flashcard {
                        front: point.question OR generateQuestion(point.content),
                        back: point.content,
                        category: "Résumé",
                        difficulty: EASY
                    } TO cards
                END FOR

            CASE ARGUMENT_MAP:
                // "Quels arguments soutiennent la thèse X ?"
                APPEND Flashcard {
                    front: "Donnez les arguments pour : « " + bloc.thesis + " »",
                    back: JOIN(getChildrenOfRole(bloc, SUPPORT).content, "\n• "),
                    category: "Argumentation",
                    difficulty: HARD
                } TO cards

        END SWITCH
    END FOR

    // Dédupliquer les cartes trop similaires
    cards = deduplicateBySemanticSimilarity(cards, threshold: 0.85)

    RETURN cards
END FUNCTION

// ── Algorithme de répétition espacée (SM-2) ─────

FUNCTION processAnswer(progress: CardProgress, answer: Enum) -> CardProgress

    // Qualité de réponse : AGAIN=0, HARD=1, GOOD=2, EASY=3
    quality = SWITCH answer
        CASE AGAIN -> 0
        CASE HARD  -> 1
        CASE GOOD  -> 2
        CASE EASY  -> 3
    END SWITCH

    // Mettre à jour l'historique
    APPEND ReviewEntry { date: NOW(), answer: answer } TO progress.history

    IF quality < 1
        // Réponse incorrecte → remettre à zéro
        progress.repetitions = 0
        progress.interval = 1   // revoir demain
    ELSE
        IF progress.repetitions == 0
            progress.interval = 1
        ELSE IF progress.repetitions == 1
            progress.interval = 3
        ELSE
            progress.interval = ROUND(progress.interval * progress.easeFactor)
        END IF
        progress.repetitions += 1
    END IF

    // Ajuster le facteur de facilité
    progress.easeFactor = progress.easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
    IF progress.easeFactor < 1.3 THEN progress.easeFactor = 1.3

    progress.nextReviewDate = TODAY() + progress.interval DAYS
    progress.lastAnswer = answer

    RETURN progress
END FUNCTION

// ── Session de révision ─────────────────────────

FUNCTION startRevisionSession(userId: String, config: RevisionConfig) -> RevisionSession

    allCards = generateFlashcards(config.manuelId, config)

    IF config.useSpacedRepetition
        // Charger la progression de l'élève
        allProgress = loadCardProgress(userId, config.manuelId)

        // Prioriser : cartes dues aujourd'hui > nouvelles cartes > cartes futures
        dueCards = FILTER(allCards, card ->
            progress = allProgress[card.id]
            progress IS null OR progress.nextReviewDate <= TODAY()
        )

        // Trier : les plus en retard d'abord
        SORT dueCards BY (allProgress[card.id]?.nextReviewDate OR MIN_DATE) ASC

    ELSE
        dueCards = allCards
    END IF

    IF config.shuffleCards
        SHUFFLE(dueCards)
    END IF

    RETURN RevisionSession {
        cards: dueCards,
        currentIndex: 0,
        isFlipped: false,
        score: { correct: 0, incorrect: 0, remaining: LENGTH(dueCards) },
        startedAt: NOW(),
        config: config
    }
END FUNCTION

FUNCTION flipCard(session: RevisionSession) -> RevisionSession
    session.isFlipped = true
    RETURN session
END FUNCTION

FUNCTION answerCard(session: RevisionSession, answer: Enum, userId: String) -> RevisionSession

    currentCard = session.cards[session.currentIndex]

    // Mettre à jour la progression
    progress = loadCardProgress(userId, currentCard.id) OR newCardProgress(currentCard.id, userId)
    progress = processAnswer(progress, answer)
    saveCardProgress(progress)

    // Mettre à jour le score
    IF answer IN [GOOD, EASY]
        session.score.correct += 1
    ELSE
        session.score.incorrect += 1
        IF answer == AGAIN
            // Remettre la carte plus loin dans la pile
            reinsertCard = currentCard
            insertPosition = MIN(session.currentIndex + randomBetween(3, 8), LENGTH(session.cards))
            INSERT reinsertCard AT insertPosition IN session.cards
        END IF
    END IF

    session.score.remaining -= 1
    session.currentIndex += 1
    session.isFlipped = false

    // Vérifier fin de session
    IF session.currentIndex >= LENGTH(session.cards)
        session.isFinished = true
    END IF

    // Vérifier durée
    IF session.config.sessionDuration IS NOT null
        elapsed = (NOW() - session.startedAt) IN MINUTES
        IF elapsed >= session.config.sessionDuration
            session.isFinished = true
        END IF
    END IF

    RETURN session
END FUNCTION

// ── Masquage du manuel en mode révision ─────────

FUNCTION applyRevisionMask(manuel: Manuel, config: RevisionConfig) -> MaskedManuel

    maskedManuel = deepCopy(manuel)

    FOR EACH chapter IN maskedManuel.chapters
        IF chapter.id NOT IN config.chaptersIncluded AND config.chaptersIncluded IS NOT EMPTY
            chapter.visible = false
            CONTINUE
        END IF

        FOR EACH bloc IN chapter.blocs
            IF bloc.type IN config.visibleBlocTypes
                bloc.visible = true
                bloc.displayMode = COMPACT  // version condensée
            ELSE
                bloc.visible = false
            END IF
        END FOR
    END FOR

    RETURN maskedManuel
END FUNCTION
```

---

## 6. 🎭 Bloc Choose-Your-Own-Adventure

### Description

Un bloc interactif qui propose un **scénario philosophique** sous forme de récit à embranchements. L'élève lit une situation (un dilemme moral, une expérience de pensée) et fait des choix qui le mènent à différentes conclusions philosophiques. Chaque embranchement est lié à un courant de pensée ou à un argument.

À la fin du parcours, l'élève voit quel "chemin philosophique" il a emprunté, quels auteurs auraient fait les mêmes choix, et peut comparer son parcours avec celui des autres élèves de la classe.

Le prof construit le scénario via un éditeur visuel de nœuds (type organigramme).

### Pseudo-code

```
MODULE ChooseYourOwnAdventure

// ── Structures ──────────────────────────────────

ENUM SceneType
    NARRATIVE           // texte narratif, pas de choix
    CHOICE              // l'élève doit choisir
    CONCLUSION          // fin d'un parcours
    REFLECTION          // question ouverte (l'élève écrit)
    REVEAL              // révèle le courant philosophique correspondant
END ENUM

STRUCTURE Scene
    id              : String
    type            : SceneType
    title           : String
    content         : String              // le texte narratif / la situation
    imageUrl        : String | null        // illustration optionnelle
    choices         : List<Choice>         // vide si NARRATIVE ou CONCLUSION
    linkedPhilosopher : String | null      // "Kant", "Mill", etc.
    linkedConcept    : String | null       // "Utilitarisme", "Déontologie", etc.
    linkedBlocId     : BlocId | null       // lien vers le bloc du manuel
    nextSceneId      : SceneId | null      // pour les scènes NARRATIVE (auto-avance)
    reflectionPrompt : String | null       // question pour REFLECTION
END STRUCTURE

STRUCTURE Choice
    id              : String
    label           : String              // texte du bouton de choix
    description     : String | null        // sous-texte explicatif (affiché après le choix)
    targetSceneId   : SceneId             // vers quelle scène ce choix mène
    philosophicalTag : String | null       // ex: "utilitariste", "déontologique"
    isRecommended   : Boolean             // le prof peut marquer un choix comme "intéressant"
END STRUCTURE

STRUCTURE AdventureBloc
    id              : String
    title           : String              // ex: "Le dilemme du tramway"
    description     : String
    scenes          : Map<SceneId, Scene>
    startSceneId    : SceneId
    conclusions     : List<Conclusion>
END STRUCTURE

STRUCTURE Conclusion
    id              : String
    sceneId         : SceneId
    title           : String              // ex: "Vous êtes utilitariste !"
    description     : String
    philosopher     : String              // l'auteur associé
    concept         : String              // le courant associé
    linkedBlocIds   : List<BlocId>        // blocs à lire pour approfondir
END STRUCTURE

STRUCTURE PlayerState
    adventureId     : String
    userId          : String
    currentSceneId  : SceneId
    choiceHistory   : List<{ sceneId: SceneId, choiceId: ChoiceId, timestamp: DateTime }>
    reflections     : Map<SceneId, String>  // réponses aux questions ouvertes
    isCompleted     : Boolean
    conclusion      : Conclusion | null
    philosophicalProfile : Map<String, Integer>  // tag -> count
END STRUCTURE

// ── Moteur de jeu ───────────────────────────────

FUNCTION startAdventure(adventure: AdventureBloc, userId: String) -> PlayerState

    RETURN PlayerState {
        adventureId: adventure.id,
        userId: userId,
        currentSceneId: adventure.startSceneId,
        choiceHistory: [],
        reflections: {},
        isCompleted: false,
        conclusion: null,
        philosophicalProfile: {}
    }
END FUNCTION

FUNCTION getCurrentScene(adventure: AdventureBloc, state: PlayerState) -> Scene
    RETURN adventure.scenes[state.currentSceneId]
END FUNCTION

FUNCTION makeChoice(adventure: AdventureBloc, state: PlayerState, choiceId: ChoiceId) -> PlayerState

    currentScene = adventure.scenes[state.currentSceneId]
    choice = FIND(currentScene.choices, c -> c.id == choiceId)

    IF choice IS null
        THROW Error("Choix invalide")
    END IF

    // Enregistrer le choix
    APPEND {
        sceneId: state.currentSceneId,
        choiceId: choice.id,
        timestamp: NOW()
    } TO state.choiceHistory

    // Mettre à jour le profil philosophique
    IF choice.philosophicalTag IS NOT null
        state.philosophicalProfile[choice.philosophicalTag] =
            (state.philosophicalProfile[choice.philosophicalTag] OR 0) + 1
    END IF

    // Avancer vers la scène suivante
    state.currentSceneId = choice.targetSceneId

    // Vérifier si c'est une conclusion
    nextScene = adventure.scenes[state.currentSceneId]
    IF nextScene.type == CONCLUSION
        state.isCompleted = true
        state.conclusion = findConclusion(adventure, state.currentSceneId)
    END IF

    RETURN state
END FUNCTION

FUNCTION submitReflection(state: PlayerState, sceneId: SceneId, text: String) -> PlayerState

    state.reflections[sceneId] = text

    // Avancer vers la scène suivante
    scene = adventure.scenes[sceneId]
    state.currentSceneId = scene.nextSceneId

    RETURN state
END FUNCTION

// ── Rendu ───────────────────────────────────────

FUNCTION renderScene(adventure: AdventureBloc, state: PlayerState) -> UIElement

    scene = getCurrentScene(adventure, state)

    RETURN Container {
        className: "adventure-scene",
        children: [
            // Barre de progression
            ProgressBar(
                current: LENGTH(state.choiceHistory),
                estimatedTotal: estimateRemainingScenes(adventure, state),
                className: "mb-4"
            ),

            // Image d'illustration
            IF scene.imageUrl
                Image(src: scene.imageUrl, alt: scene.title, className: "rounded-lg mb-4"),

            // Titre de la scène
            Heading(scene.title, level: 3),

            // Contenu narratif (avec animation de typewriter)
            AnimatedText(
                text: scene.content,
                speed: 30,   // ms par caractère
                className: "text-lg leading-relaxed my-6"
            ),

            // Actions selon le type de scène
            SWITCH scene.type

                CASE CHOICE:
                    ChoicePanel {
                        children: FOR EACH choice IN scene.choices
                            ChoiceButton {
                                label: choice.label,
                                onClick: () -> makeChoice(adventure, state, choice.id),
                                className: "choice-btn",
                                animateIn: true,
                                delay: INDEX * 200   // apparition séquentielle
                            }
                    }

                CASE NARRATIVE:
                    ContinueButton {
                        label: "Continuer →",
                        onClick: () -> state.currentSceneId = scene.nextSceneId
                    }

                CASE REFLECTION:
                    ReflectionArea {
                        prompt: scene.reflectionPrompt,
                        onSubmit: (text) -> submitReflection(state, scene.id, text),
                        minLength: 50,
                        placeholder: "Rédigez votre réflexion..."
                    }

                CASE CONCLUSION:
                    renderConclusion(state, adventure)

                CASE REVEAL:
                    RevealCard {
                        philosopher: scene.linkedPhilosopher,
                        concept: scene.linkedConcept,
                        message: "Ce choix correspond à la position de " + scene.linkedPhilosopher,
                        linkedBloc: scene.linkedBlocId,
                        onContinue: () -> state.currentSceneId = scene.nextSceneId
                    }

            END SWITCH,

            // Lien vers le bloc du manuel (discret)
            IF scene.linkedBlocId
                DiscreetLink(
                    text: "📖 Approfondir dans le manuel",
                    onClick: () -> navigateToBloc(scene.linkedBlocId)
                )
        ]
    }
END FUNCTION

// ── Conclusion et bilan ─────────────────────────

FUNCTION renderConclusion(state: PlayerState, adventure: AdventureBloc) -> UIElement

    conclusion = state.conclusion
    profile = state.philosophicalProfile

    // Déterminer le courant dominant
    dominantTag = keyWithMaxValue(profile)

    RETURN ConclusionPanel {
        children: [
            Heading("🎭 " + conclusion.title, level: 2),
            Text(conclusion.description),

            // Profil philosophique
            ProfileChart {
                data: profile,
                type: RADAR,
                labels: {
                    "utilitariste": "Utilitarisme",
                    "deontologique": "Déontologie",
                    "vertu": "Éthique de la vertu",
                    "existentialiste": "Existentialisme"
                }
            },

            // Parcours de l'élève
            PathSummary {
                title: "Votre parcours :",
                steps: FOR EACH entry IN state.choiceHistory
                    scene = adventure.scenes[entry.sceneId]
                    choice = FIND(scene.choices, c -> c.id == entry.choiceId)
                    RETURN { scene: scene.title, choice: choice.label }
            },

            // Comparaison avec la classe
            ClassComparison {
                title: "Et vos camarades ?",
                data: loadClassResults(adventure.id, state.userId),
                myConclusion: conclusion.id
            },

            // Lectures recommandées
            ReadingList {
                title: "Pour approfondir :",
                blocs: FOR EACH blocId IN conclusion.linkedBlocIds
                    loadBlocPreview(blocId)
            },

            // Bouton recommencer
            Button(
                label: "🔄 Recommencer avec d'autres choix",
                onClick: () -> resetAdventure(adventure, state.userId)
            )
        ]
    }
END FUNCTION

// ── Statistiques classe (pour le prof) ──────────

FUNCTION getClassStatistics(adventureId: String, classId: String) -> ClassStats

    allStates = loadAllPlayerStates(adventureId, classId)

    conclusionDistribution = {}
    FOR EACH state IN allStates
        IF state.isCompleted
            conclusionDistribution[state.conclusion.id] =
                (conclusionDistribution[state.conclusion.id] OR 0) + 1
        END IF
    END FOR

    // Choix les plus controversés (50/50)
    controversialChoices = []
    allSceneChoices = aggregateChoicesByScene(allStates)
    FOR EACH (sceneId, choices) IN allSceneChoices
        distribution = calculateDistribution(choices)
        entropy = shannonEntropy(distribution)
        IF entropy > 0.9  // très équilibré
            APPEND { sceneId, distribution, entropy } TO controversialChoices
        END IF
    END FOR

    SORT controversialChoices BY entropy DESC

    RETURN ClassStats {
        totalStudents: LENGTH(allStates),
        completedStudents: COUNT(allStates WHERE isCompleted),
        conclusionDistribution: conclusionDistribution,
        controversialChoices: controversialChoices,
        averageCompletionTime: AVG(completionTime FOR state IN allStates WHERE isCompleted)
    }
END FUNCTION
```

---

## 7. 🍴 Fork de Manuel (Copie + Personnalisation)

### Description

Un prof peut **copier le manuel public** d'un autre prof (ou d'un éditeur) et obtenir sa propre version indépendante. Contrairement à un fork Git classique, ici la copie est **totalement indépendante** dès la création — pas de lien persistant avec l'original (plus simple, moins de conflits).

La copie inclut tous les blocs, chapitres, métadonnées et configurations. Le prof peut ensuite librement modifier, supprimer, réordonner ou ajouter des blocs. Le manuel source reste intact et son auteur n'est pas notifié.

Un système d'attribution indique "Basé sur le manuel de Mme Dupont" pour le crédit.

### Pseudo-code

```
MODULE ManuelFork

// ── Structures ──────────────────────────────────

STRUCTURE Manuel
    id              : String
    title           : String
    description     : String
    authorId        : UserId
    authorName      : String
    visibility      : Enum(PUBLIC, PRIVATE, UNLISTED)
    chapters        : List<Chapter>
    metadata        : ManuelMetadata
    forkedFrom      : ForkOrigin | null
    createdAt       : DateTime
    updatedAt       : DateTime
END STRUCTURE

STRUCTURE ForkOrigin
    originalManuelId    : String
    originalAuthorId    : UserId
    originalAuthorName  : String
    originalTitle       : String
    forkedAt            : DateTime
    originalSnapshot    : String       // hash ou version pour traçabilité
END STRUCTURE

STRUCTURE Chapter
    id              : String
    title           : String
    description     : String
    order           : Integer
    blocs           : List<Bloc>
END STRUCTURE

STRUCTURE Bloc
    id              : String
    type            : BlocType
    content         : BlocContent        // variable selon le type
    order           : Integer
    metadata        : BlocMetadata
    tags            : List<Tag>
END STRUCTURE

STRUCTURE ManuelMetadata
    subject         : String             // "Philosophie"
    level           : String             // "Terminale"
    program         : String             // "Programme 2024"
    language        : String             // "fr"
    license         : Enum(CC_BY, CC_BY_SA, CC_BY_NC, ALL_RIGHTS_RESERVED)
    forkCount       : Integer            // combien de fois ce manuel a été forké
    tags            : List<String>
END STRUCTURE

// ── Fork : copie profonde indépendante ──────────

FUNCTION forkManuel(originalManuelId: String, newOwner: User) -> Manuel

    // 1. Charger l'original
    original = loadManuel(originalManuelId)

    // 2. Vérifier les permissions
    IF original.visibility == PRIVATE
        THROW PermissionError("Ce manuel n'est pas public")
    END IF

    IF original.metadata.license == ALL_RIGHTS_RESERVED
        THROW LicenseError("Ce manuel ne peut pas être copié (tous droits réservés)")
    END IF

    // 3. Copie profonde avec nouveaux IDs
    forkedManuel = deepCopyWithNewIds(original)

    // 4. Mettre à jour les métadonnées du fork
    forkedManuel.id = generateId()
    forkedManuel.authorId = newOwner.id
    forkedManuel.authorName = newOwner.name
    forkedManuel.title = original.title + " (copie)"
    forkedManuel.visibility = PRIVATE       // privé par défaut
    forkedManuel.createdAt = NOW()
    forkedManuel.updatedAt = NOW()
    forkedManuel.metadata.forkCount = 0

    // 5. Enregistrer l'origine
    forkedManuel.forkedFrom = ForkOrigin {
        originalManuelId: original.id,
        originalAuthorId: original.authorId,
        originalAuthorName: original.authorName,
        originalTitle: original.title,
        forkedAt: NOW(),
        originalSnapshot: hashManuel(original)
    }

    // 6. Copier les assets (images, audios)
    FOR EACH asset IN collectAssets(original)
        newAsset = duplicateAsset(asset, ownerId: newOwner.id)
        replaceAssetReferences(forkedManuel, oldAssetId: asset.id, newAssetId: newAsset.id)
    END FOR

    // 7. Sauvegarder
    saveManuel(forkedManuel)

    // 8. Incrémenter le compteur de forks de l'original
    original.metadata.forkCount += 1
    saveManuel(original)

    // 9. Notifier (optionnel, selon les préférences de l'auteur original)
    IF original.author.settings.notifyOnFork
        sendNotification(original.authorId,
            type: FORK,
            message: newOwner.name + " a copié votre manuel « " + original.title + " »"
        )
    END IF

    RETURN forkedManuel
END FUNCTION

// ── Copie profonde avec remplacement des IDs ────

FUNCTION deepCopyWithNewIds(original: Manuel) -> Manuel

    idMapping = {}   // oldId -> newId

    copy = shallowCopy(original)
    copy.chapters = []

    FOR EACH chapter IN original.chapters
        newChapter = shallowCopy(chapter)
        newChapter.id = generateId()
        idMapping[chapter.id] = newChapter.id
        newChapter.blocs = []

        FOR EACH bloc IN chapter.blocs
            newBloc = deepCopyBloc(bloc)
            newBloc.id = generateId()
            idMapping[bloc.id] = newBloc.id
            APPEND newBloc TO newChapter.blocs
        END FOR

        APPEND newChapter TO copy.chapters
    END FOR

    // Mettre à jour les références internes (liens entre blocs, miroirs, etc.)
    updateInternalReferences(copy, idMapping)

    RETURN copy
END FUNCTION

FUNCTION updateInternalReferences(manuel: Manuel, idMapping: Map<String, String>)

    FOR EACH chapter IN manuel.chapters
        FOR EACH bloc IN chapter.blocs
            // Liens internes dans le contenu rich text
            IF bloc.content HAS internalLinks
                FOR EACH link IN bloc.content.internalLinks
                    IF link.targetBlocId IN idMapping
                        link.targetBlocId = idMapping[link.targetBlocId]
                    END IF
                END FOR
            END IF

            // Blocs spéciaux : argument map, adventure, comparaison...
            IF bloc.type == ARGUMENT_MAP
                updateArgumentMapRefs(bloc.content, idMapping)
            ELSE IF bloc.type == ADVENTURE
                updateAdventureRefs(bloc.content, idMapping)
            ELSE IF bloc.type == COMPARAISON
                updateComparaisonRefs(bloc.content, idMapping)
            END IF
        END FOR
    END FOR
END FUNCTION

// ── Catalogue de manuels publics ────────────────

FUNCTION browsePublicManuels(filters: SearchFilters) -> PaginatedResult<ManuelPreview>

    query = buildQuery()
        .where("visibility", EQUALS, PUBLIC)
        .where("metadata.subject", EQUALS, filters.subject OR ANY)
        .where("metadata.level", EQUALS, filters.level OR ANY)
        .where("metadata.language", EQUALS, filters.language OR ANY)

    IF filters.searchText IS NOT EMPTY
        query = query.fullTextSearch(filters.searchText, fields: ["title", "description", "metadata.tags"])
    END IF

    IF filters.sortBy == POPULAR
        query = query.orderBy("metadata.forkCount", DESC)
    ELSE IF filters.sortBy == RECENT
        query = query.orderBy("createdAt", DESC)
    ELSE IF filters.sortBy == RATING
        query = query.orderBy("averageRating", DESC)
    END IF

    results = execute(query, page: filters.page, pageSize: 20)

    RETURN PaginatedResult {
        items: FOR EACH manuel IN results
            ManuelPreview {
                id: manuel.id,
                title: manuel.title,
                author: manuel.authorName,
                description: truncate(manuel.description, 200),
                subject: manuel.metadata.subject,
                level: manuel.metadata.level,
                forkCount: manuel.metadata.forkCount,
                chapterCount: LENGTH(manuel.chapters),
                blocCount: totalBlocCount(manuel),
                license: manuel.metadata.license,
                forkedFrom: manuel.forkedFrom?.originalTitle
            },
        totalCount: results.totalCount,
        page: filters.page,
        totalPages: CEIL(results.totalCount / 20)
    }
END FUNCTION

// ── Opérations sur le fork ──────────────────────

FUNCTION reorderChapters(manuel: Manuel, newOrder: List<ChapterId>) -> Manuel
    orderedChapters = []
    FOR EACH chapterId IN newOrder
        chapter = FIND(manuel.chapters, c -> c.id == chapterId)
        chapter.order = INDEX
        APPEND chapter TO orderedChapters
    END FOR
    manuel.chapters = orderedChapters
    manuel.updatedAt = NOW()
    saveManuel(manuel)
    RETURN manuel
END FUNCTION

FUNCTION reorderBlocs(manuel: Manuel, chapterId: ChapterId, newOrder: List<BlocId>) -> Manuel
    chapter = FIND(manuel.chapters, c -> c.id == chapterId)
    orderedBlocs = []
    FOR EACH blocId IN newOrder
        bloc = FIND(chapter.blocs, b -> b.id == blocId)
        bloc.order = INDEX
        APPEND bloc TO orderedBlocs
    END FOR
    chapter.blocs = orderedBlocs
    manuel.updatedAt = NOW()
    saveManuel(manuel)
    RETURN manuel
END FUNCTION

FUNCTION deleteBloc(manuel: Manuel, chapterId: ChapterId, blocId: BlocId) -> Manuel
    chapter = FIND(manuel.chapters, c -> c.id == chapterId)
    chapter.blocs = FILTER(chapter.blocs, b -> b.id != blocId)
    // Recalculer l'ordre
    FOR i FROM 0 TO LENGTH(chapter.blocs) - 1
        chapter.blocs[i].order = i
    END FOR
    manuel.updatedAt = NOW()
    saveManuel(manuel)
    RETURN manuel
END FUNCTION

FUNCTION addBloc(manuel: Manuel, chapterId: ChapterId, bloc: Bloc, afterBlocId: BlocId | null) -> Manuel
    chapter = FIND(manuel.chapters, c -> c.id == chapterId)
    bloc.id = generateId()

    IF afterBlocId IS null
        APPEND bloc TO chapter.blocs
    ELSE
        insertIndex = FIND_INDEX(chapter.blocs, b -> b.id == afterBlocId) + 1
        INSERT bloc AT insertIndex IN chapter.blocs
    END IF

    // Recalculer l'ordre
    FOR i FROM 0 TO LENGTH(chapter.blocs) - 1
        chapter.blocs[i].order = i
    END FOR

    manuel.updatedAt = NOW()
    saveManuel(manuel)
    RETURN manuel
END FUNCTION
```

---

## 8. 🔄 Bloc Dynamique (Sondage + autres)

### Description

Les blocs dynamiques sont des blocs dont le **contenu change en temps réel** en fonction des interactions des utilisateurs ou de sources externes. Le sondage est l'exemple principal, mais d'autres types existent : compteur, nuage de mots collaboratif, thermomètre d'opinion, question ouverte avec agrégation.

Le prof crée le bloc, l'active quand il veut (le bloc peut être dormant), et les résultats se mettent à jour en temps réel via WebSocket. Les résultats sont persistés et archivables.

### Pseudo-code

```
MODULE DynamicBlocs

// ── Structures communes ─────────────────────────

ENUM DynamicBlocType
    POLL                 // sondage à choix multiples
    WORD_CLOUD           // nuage de mots collaboratif
    OPEN_RESPONSE        // question ouverte agrégée
    THERMOMETER          // jauge d'opinion (slider)
    LIVE_COUNTER         // compteur en temps réel
    REACTION             // réactions emoji sur un contenu
END ENUM

ENUM BlocStatus
    DRAFT                // en cours de création
    DORMANT              // créé mais pas encore activé
    ACTIVE               // les élèves peuvent participer
    CLOSED               // les résultats sont figés
    ARCHIVED             // accessible en lecture seule
END ENUM

STRUCTURE DynamicBloc
    id               : String
    type             : DynamicBlocType
    status           : BlocStatus
    title            : String
    config           : DynamicBlocConfig        // spécifique au type
    results          : DynamicBlocResults       // spécifique au type
    participants     : Set<UserId>
    maxParticipants  : Integer | null
    anonymousVotes   : Boolean
    allowChangeVote  : Boolean
    createdAt        : DateTime
    activatedAt      : DateTime | null
    closedAt         : DateTime | null
    autoCloseAfter   : Duration | null          // fermer auto après X minutes
END STRUCTURE

// ── SONDAGE ─────────────────────────────────────

STRUCTURE PollConfig
    question         : String
    options          : List<PollOption>
    multipleChoice   : Boolean            // autoriser plusieurs réponses
    showResultsBefore : Boolean           // montrer les résultats avant de voter
    showResultsAfter : Boolean            // montrer les résultats après avoir voté
    correctAnswer    : OptionId | null     // si c'est un quiz
END STRUCTURE

STRUCTURE PollOption
    id               : String
    label            : String
    color            : String
END STRUCTURE

STRUCTURE PollResults
    votes            : Map<OptionId, Integer>
    voterDetails     : Map<UserId, List<OptionId>>   // qui a voté quoi (si pas anonyme)
    totalVotes       : Integer
END STRUCTURE

FUNCTION createPoll(title, question, options, settings) -> DynamicBloc
    RETURN DynamicBloc {
        id: generateId(),
        type: POLL,
        status: DORMANT,
        title: title,
        config: PollConfig {
            question: question,
            options: FOR EACH opt IN options
                PollOption { id: generateId(), label: opt, color: PALETTE[INDEX] },
            multipleChoice: settings.multipleChoice OR false,
            showResultsBefore: settings.showResultsBefore OR false,
            showResultsAfter: settings.showResultsAfter OR true,
            correctAnswer: settings.correctAnswer OR null
        },
        results: PollResults {
            votes: { opt.id: 0 FOR opt IN options },
            voterDetails: {},
            totalVotes: 0
        },
        participants: {},
        anonymousVotes: settings.anonymous OR true,
        allowChangeVote: settings.allowChangeVote OR false,
        autoCloseAfter: settings.autoCloseAfter OR null,
        createdAt: NOW()
    }
END FUNCTION

FUNCTION vote(bloc: DynamicBloc, userId: UserId, optionIds: List<OptionId>) -> DynamicBloc

    // Validations
    IF bloc.status != ACTIVE
        THROW Error("Le sondage n'est pas actif")
    END IF
    IF userId IN bloc.participants AND NOT bloc.allowChangeVote
        THROW Error("Vous avez déjà voté")
    END IF
    IF NOT bloc.config.multipleChoice AND LENGTH(optionIds) > 1
        THROW Error("Un seul choix autorisé")
    END IF
    FOR EACH optId IN optionIds
        IF NOT EXISTS(bloc.config.options, o -> o.id == optId)
            THROW Error("Option invalide : " + optId)
        END IF
    END FOR

    // Si changement de vote, retirer l'ancien vote
    IF userId IN bloc.participants AND bloc.allowChangeVote
        oldVotes = bloc.results.voterDetails[userId]
        FOR EACH oldOptId IN oldVotes
            bloc.results.votes[oldOptId] -= 1
            bloc.results.totalVotes -= 1
        END FOR
    END IF

    // Enregistrer le nouveau vote
    FOR EACH optId IN optionIds
        bloc.results.votes[optId] += 1
        bloc.results.totalVotes += 1
    END FOR
    bloc.results.voterDetails[userId] = optionIds
    bloc.participants.ADD(userId)

    // Diffuser la mise à jour en temps réel
    broadcastUpdate(bloc.id, {
        type: "VOTE_UPDATE",
        results: bloc.results,
        participantCount: LENGTH(bloc.participants)
    })

    saveBloc(bloc)
    RETURN bloc
END FUNCTION

// ── NUAGE DE MOTS ───────────────────────────────

STRUCTURE WordCloudConfig
    prompt           : String             // "En un mot, qu'est-ce que la liberté ?"
    maxWords         : Integer            // max mots par participant
    bannedWords      : List<String>       // mots interdits
    mergeCase        : Boolean            // "Liberté" = "liberté"
    mergeSynonyms    : Boolean            // fusion manuelle par le prof
END STRUCTURE

STRUCTURE WordCloudResults
    words            : Map<String, WordEntry>
END STRUCTURE

STRUCTURE WordEntry
    word             : String
    count            : Integer
    contributors     : List<UserId>
    displaySize      : Float             // calculé proportionnellement
END STRUCTURE

FUNCTION submitWords(bloc: DynamicBloc, userId: UserId, words: List<String>) -> DynamicBloc

    IF bloc.status != ACTIVE THEN THROW Error("Bloc inactif")
    IF userId IN bloc.participants AND NOT bloc.allowChangeVote THEN THROW Error("Déjà participé")

    cleanedWords = []
    FOR EACH word IN words
        w = TRIM(LOWERCASE(word)) IF bloc.config.mergeCase ELSE TRIM(word)
        IF w IN bloc.config.bannedWords THEN CONTINUE
        IF LENGTH(w) < 2 THEN CONTINUE
        APPEND w TO cleanedWords
    END FOR

    // Limiter
    cleanedWords = cleanedWords[0 : bloc.config.maxWords]

    // Ajouter au nuage
    FOR EACH word IN cleanedWords
        IF word IN bloc.results.words
            bloc.results.words[word].count += 1
            APPEND userId TO bloc.results.words[word].contributors
        ELSE
            bloc.results.words[word] = WordEntry {
                word: word,
                count: 1,
                contributors: [userId]
            }
        END IF
    END FOR

    // Recalculer les tailles d'affichage
    maxCount = MAX(entry.count FOR entry IN bloc.results.words.values())
    FOR EACH entry IN bloc.results.words.values()
        entry.displaySize = MIN_FONT + (entry.count / maxCount) * (MAX_FONT - MIN_FONT)
    END FOR

    bloc.participants.ADD(userId)

    broadcastUpdate(bloc.id, {
        type: "WORD_CLOUD_UPDATE",
        words: bloc.results.words
    })

    saveBloc(bloc)
    RETURN bloc
END FUNCTION

// ── THERMOMÈTRE D'OPINION ───────────────────────

STRUCTURE ThermometerConfig
    question         : String            // "Dans quelle mesure êtes-vous d'accord ?"
    minLabel         : String            // "Pas du tout d'accord"
    maxLabel         : String            // "Tout à fait d'accord"
    minValue         : Integer           // 0
    maxValue         : Integer           // 100
    showAverage      : Boolean
    showDistribution : Boolean
END STRUCTURE

STRUCTURE ThermometerResults
    values           : List<{ userId: UserId, value: Integer }>
    average          : Float
    median           : Float
    distribution     : List<Integer>      // histogramme en 10 tranches
END STRUCTURE

FUNCTION submitThermometer(bloc: DynamicBloc, userId: UserId, value: Integer) -> DynamicBloc

    value = CLAMP(value, bloc.config.minValue, bloc.config.maxValue)

    // Remplacer si déjà voté
    bloc.results.values = FILTER(bloc.results.values, v -> v.userId != userId)
    APPEND { userId, value } TO bloc.results.values

    // Recalculer les statistiques
    allValues = [v.value FOR v IN bloc.results.values]
    bloc.results.average = AVG(allValues)
    bloc.results.median = MEDIAN(allValues)
    bloc.results.distribution = computeHistogram(allValues, buckets: 10,
        min: bloc.config.minValue, max: bloc.config.maxValue)

    bloc.participants.ADD(userId)

    broadcastUpdate(bloc.id, {
        type: "THERMOMETER_UPDATE",
        average: bloc.results.average,
        median: bloc.results.median,
        distribution: bloc.results.distribution,
        participantCount: LENGTH(bloc.participants)
    })

    saveBloc(bloc)
    RETURN bloc
END FUNCTION

// ── Activation / fermeture par le prof ──────────

FUNCTION activateBloc(bloc: DynamicBloc, prof: User) -> DynamicBloc
    IF bloc.status != DORMANT THEN THROW Error("Le bloc doit être dormant pour être activé")
    bloc.status = ACTIVE
    bloc.activatedAt = NOW()

    // Programmer la fermeture automatique si configuré
    IF bloc.autoCloseAfter IS NOT null
        scheduleJob(AT: NOW() + bloc.autoCloseAfter, DO: () -> closeBloc(bloc))
    END IF

    broadcastUpdate(bloc.id, { type: "BLOC_ACTIVATED" })
    saveBloc(bloc)
    RETURN bloc
END FUNCTION

FUNCTION closeBloc(bloc: DynamicBloc) -> DynamicBloc
    bloc.status = CLOSED
    bloc.closedAt = NOW()
    broadcastUpdate(bloc.id, { type: "BLOC_CLOSED", finalResults: bloc.results })
    saveBloc(bloc)
    RETURN bloc
END FUNCTION

// ── Temps réel (WebSocket) ──────────────────────

FUNCTION broadcastUpdate(blocId: String, payload: Object)
    // Trouver tous les clients connectés qui voient ce bloc
    subscribers = getWebSocketSubscribers(channel: "bloc:" + blocId)
    FOR EACH subscriber IN subscribers
        subscriber.send(JSON.stringify(payload))
    END FOR
END FUNCTION

FUNCTION handleWebSocketConnection(socket, userId, blocId)
    subscribe(socket, channel: "bloc:" + blocId)

    // Envoyer l'état actuel au nouveau connecté
    bloc = loadBloc(blocId)
    socket.send(JSON.stringify({
        type: "INITIAL_STATE",
        bloc: serializeBloc(bloc),
        hasVoted: userId IN bloc.participants
    }))

    socket.onClose(() -> unsubscribe(socket, channel: "bloc:" + blocId))
END FUNCTION
```

---

## 9. 📡 Mode Follow-Me

### Description

Le mode Follow-Me permet au prof de **synchroniser** l'affichage de son manuel avec celui de tous les élèves connectés. Quand le prof navigue vers un bloc, change de chapitre, ou surligne un passage, les écrans des élèves suivent en temps réel.

L'élève peut temporairement "décrocher" pour consulter un autre passage, puis "raccrocher" d'un clic. Le prof voit combien d'élèves sont accrochés. Il peut aussi verrouiller le mode (empêcher le décrochage, utile en contrôle).

Le mode supporte aussi les annotations en direct : le prof dessine, surligne, encadre — tout est visible par les élèves.

### Pseudo-code

```
MODULE FollowMe

// ── Structures ──────────────────────────────────

STRUCTURE FollowMeSession
    id               : String
    profId           : UserId
    manuelId         : String
    classId          : String
    isActive         : Boolean
    isLocked         : Boolean            // si true, les élèves ne peuvent pas décrocher
    startedAt        : DateTime
    currentView      : ViewState
    annotations      : List<Annotation>
    connectedStudents : Map<UserId, StudentConnection>
END STRUCTURE

STRUCTURE ViewState
    chapterId        : ChapterId
    blocId           : BlocId | null       // bloc actuellement ciblé / mis en avant
    scrollPosition   : Float               // 0.0 à 1.0 (position dans la page)
    zoomLevel        : Float               // 1.0 = normal
    highlights       : List<Highlight>
END STRUCTURE

STRUCTURE Highlight
    id               : String
    blocId           : BlocId
    startOffset      : Integer             // position dans le texte
    endOffset        : Integer
    color            : String
    createdAt        : DateTime
END STRUCTURE

STRUCTURE Annotation
    id               : String
    type             : Enum(DRAWING, ARROW, CIRCLE, TEXT_NOTE, POINTER)
    position         : { x: Float, y: Float }   // relative au bloc
    blocId           : BlocId
    data             : AnnotationData      // spécifique au type
    color            : String
    createdAt        : DateTime
    isTemporary      : Boolean             // disparaît après X secondes
END STRUCTURE

STRUCTURE StudentConnection
    userId           : String
    userName         : String
    isFollowing      : Boolean             // true = accroché, false = décroché
    lastSeenAt       : DateTime
    socketId         : String
END STRUCTURE

// ── Cycle de vie de la session ──────────────────

FUNCTION startFollowMeSession(profId: UserId, manuelId: String, classId: String) -> FollowMeSession

    session = FollowMeSession {
        id: generateId(),
        profId: profId,
        manuelId: manuelId,
        classId: classId,
        isActive: true,
        isLocked: false,
        startedAt: NOW(),
        currentView: ViewState {
            chapterId: firstChapterId(manuelId),
            blocId: null,
            scrollPosition: 0.0,
            zoomLevel: 1.0,
            highlights: []
        },
        annotations: [],
        connectedStudents: {}
    }

    saveSession(session)

    // Notifier les élèves de la classe
    notifyClass(classId, {
        type: "FOLLOW_ME_STARTED",
        sessionId: session.id,
        profName: loadUser(profId).name,
        manuelTitle: loadManuel(manuelId).title
    })

    RETURN session
END FUNCTION

FUNCTION endFollowMeSession(session: FollowMeSession) -> void
    session.isActive = false

    // Notifier tous les élèves connectés
    FOR EACH (userId, connection) IN session.connectedStudents
        sendToSocket(connection.socketId, { type: "SESSION_ENDED" })
    END FOR

    // Archiver les annotations si le prof le souhaite
    IF profWantsToSaveAnnotations(session.profId)
        archiveAnnotations(session.id, session.annotations)
    END IF

    saveSession(session)
END FUNCTION

// ── Actions du prof ─────────────────────────────

FUNCTION profNavigate(session: FollowMeSession, newView: ViewState) -> void

    session.currentView = newView

    // Diffuser à tous les élèves accrochés
    broadcastToFollowers(session, {
        type: "VIEW_UPDATE",
        view: newView,
        timestamp: NOW()
    })

    saveSession(session)
END FUNCTION

FUNCTION profScrollTo(session: FollowMeSession, blocId: BlocId) -> void
    session.currentView.blocId = blocId
    session.currentView.scrollPosition = getBlocScrollPosition(blocId)

    broadcastToFollowers(session, {
        type: "SCROLL_TO_BLOC",
        blocId: blocId,
        smooth: true
    })
END FUNCTION

FUNCTION profHighlight(session: FollowMeSession, blocId: BlocId, startOffset: Integer, endOffset: Integer, color: String) -> void

    highlight = Highlight {
        id: generateId(),
        blocId: blocId,
        startOffset: startOffset,
        endOffset: endOffset,
        color: color,
        createdAt: NOW()
    }

    APPEND highlight TO session.currentView.highlights

    broadcastToFollowers(session, {
        type: "HIGHLIGHT",
        highlight: highlight
    })
END FUNCTION

FUNCTION profAnnotate(session: FollowMeSession, annotation: Annotation) -> void

    annotation.id = generateId()
    annotation.createdAt = NOW()
    APPEND annotation TO session.annotations

    broadcastToFollowers(session, {
        type: "ANNOTATION",
        annotation: annotation
    })

    // Si temporaire, programmer la suppression
    IF annotation.isTemporary
        scheduleJob(AT: NOW() + 5 SECONDS, DO: () ->
            removeAnnotation(session, annotation.id)
            broadcastToFollowers(session, {
                type: "REMOVE_ANNOTATION",
                annotationId: annotation.id
            })
        )
    END IF
END FUNCTION

FUNCTION profDrawPointer(session: FollowMeSession, position: { x, y }, blocId: BlocId) -> void
    // Le pointeur laser du prof — se déplace en continu
    broadcastToFollowers(session, {
        type: "POINTER_MOVE",
        position: position,
        blocId: blocId
    })
END FUNCTION

FUNCTION profClearAnnotations(session: FollowMeSession) -> void
    session.annotations = []
    session.currentView.highlights = []

    broadcastToFollowers(session, { type: "CLEAR_ALL_ANNOTATIONS" })

    saveSession(session)
END FUNCTION

FUNCTION profToggleLock(session: FollowMeSession) -> void
    session.isLocked = NOT session.isLocked

    broadcastToAll(session, {
        type: "LOCK_CHANGED",
        isLocked: session.isLocked
    })

    saveSession(session)
END FUNCTION

// ── Actions de l'élève ──────────────────────────

FUNCTION studentJoin(session: FollowMeSession, userId: UserId, socketId: String) -> void

    session.connectedStudents[userId] = StudentConnection {
        userId: userId,
        userName: loadUser(userId).name,
        isFollowing: true,
        lastSeenAt: NOW(),
        socketId: socketId
    }

    // Envoyer l'état actuel au nouvel arrivant
    sendToSocket(socketId, {
        type: "SYNC_STATE",
        view: session.currentView,
        annotations: session.annotations,
        isLocked: session.isLocked
    })

    // Notifier le prof
    notifyProf(session.profId, {
        type: "STUDENT_JOINED",
        studentName: loadUser(userId).name,
        totalConnected: LENGTH(session.connectedStudents),
        totalFollowing: COUNT(session.connectedStudents WHERE isFollowing)
    })

    saveSession(session)
END FUNCTION

FUNCTION studentDetach(session: FollowMeSession, userId: UserId) -> Boolean

    IF session.isLocked
        RETURN false   // impossible de décrocher en mode verrouillé
    END IF

    session.connectedStudents[userId].isFollowing = false

    notifyProf(session.profId, {
        type: "STUDENT_DETACHED",
        studentName: session.connectedStudents[userId].userName,
        totalFollowing: COUNT(session.connectedStudents WHERE isFollowing)
    })

    RETURN true
END FUNCTION

FUNCTION studentReattach(session: FollowMeSession, userId: UserId) -> void

    session.connectedStudents[userId].isFollowing = true

    // Synchroniser immédiatement l'élève avec la vue actuelle
    sendToSocket(session.connectedStudents[userId].socketId, {
        type: "SYNC_STATE",
        view: session.currentView,
        annotations: session.annotations
    })

    notifyProf(session.profId, {
        type: "STUDENT_REATTACHED",
        studentName: session.connectedStudents[userId].userName,
        totalFollowing: COUNT(session.connectedStudents WHERE isFollowing)
    })
END FUNCTION

// ── Diffusion ───────────────────────────────────

FUNCTION broadcastToFollowers(session: FollowMeSession, payload: Object)
    FOR EACH (userId, connection) IN session.connectedStudents
        IF connection.isFollowing
            sendToSocket(connection.socketId, payload)
        END IF
    END FOR
END FUNCTION

FUNCTION broadcastToAll(session: FollowMeSession, payload: Object)
    FOR EACH (userId, connection) IN session.connectedStudents
        sendToSocket(connection.socketId, payload)
    END FOR
END FUNCTION

// ── Dashboard prof (en direct) ──────────────────

FUNCTION getProfDashboard(session: FollowMeSession) -> Dashboard

    RETURN Dashboard {
        sessionDuration: NOW() - session.startedAt,
        totalConnected: LENGTH(session.connectedStudents),
        totalFollowing: COUNT(session.connectedStudents.values() WHERE isFollowing),
        detachedStudents: [
            s.userName FOR s IN session.connectedStudents.values() WHERE NOT s.isFollowing
        ],
        absentStudents: getAbsentStudents(session.classId, session.connectedStudents),
        annotationCount: LENGTH(session.annotations),
        isLocked: session.isLocked
    }
END FUNCTION
```

---

## 10. 💬 Bloc Débat Structuré

### Description

Un bloc interactif qui organise un **débat argumenté** entre les élèves de la classe, directement dans le manuel. Le prof définit une question de débat liée à un chapitre. Les élèves prennent position (Pour / Contre / Nuancé), postent des arguments, citent des textes du manuel, votent pour les meilleurs arguments, et répondent aux arguments adverses.

Le débat est **structuré** : pas un simple forum, mais une organisation en colonnes Pour/Contre avec des fils de réponse, des citations de blocs, et un système de vote qui fait remonter les meilleurs arguments. Le prof peut modérer, épingler des arguments, et clôturer le débat avec un bilan.

### Pseudo-code

```
MODULE DebatStructure

// ── Structures ──────────────────────────────────

ENUM Position
    POUR
    CONTRE
    NUANCE
END ENUM

STRUCTURE DebatBloc
    id               : String
    question         : String            // "L'État doit-il limiter la liberté ?"
    description      : String            // contexte, consignes du prof
    linkedBlocIds    : List<BlocId>      // textes liés du manuel
    status           : Enum(DRAFT, OPEN, CLOSED, ARCHIVED)
    config           : DebatConfig
    positions        : Map<UserId, Position>
    arguments        : List<Argument>
    summary          : DebatSummary | null  // bilan du prof à la clôture
    createdAt        : DateTime
    closedAt         : DateTime | null
END STRUCTURE

STRUCTURE DebatConfig
    allowAnonymous    : Boolean          // arguments anonymes
    requireSource     : Boolean          // obliger à citer un texte du manuel
    maxArgumentLength : Integer          // en caractères
    minArgumentLength : Integer
    allowVoting       : Boolean
    allowReplies      : Boolean
    maxRepliesDepth   : Integer          // profondeur max des fils (défaut: 2)
    moderationMode    : Enum(NONE, PRE_MODERATION, POST_MODERATION)
END STRUCTURE

STRUCTURE Argument
    id               : String
    authorId         : UserId
    authorName       : String            // ou "Anonyme"
    position         : Position
    content          : String
    sourceRefs       : List<SourceReference>  // citations du manuel
    parentId         : ArgumentId | null      // si c'est une réponse
    replies          : List<Argument>
    upvotes          : Set<UserId>
    downvotes        : Set<UserId>
    score            : Integer                // upvotes - downvotes
    isPinned         : Boolean                // épinglé par le prof
    isModerated      : Boolean                // validé par le prof (si pré-modération)
    createdAt        : DateTime
END STRUCTURE

STRUCTURE SourceReference
    blocId           : BlocId
    blocTitle        : String
    excerpt          : String            // passage cité (max 200 chars)
    chapterTitle     : String
END STRUCTURE

STRUCTURE DebatSummary
    bestArgumentPour   : ArgumentId
    bestArgumentContre : ArgumentId
    profComment        : String           // synthèse du prof
    philosophersReferenced : List<String> // auteurs mentionnés
    votePour           : Integer
    voteContre         : Integer
    voteNuance         : Integer
END STRUCTURE

// ── Participer au débat ─────────────────────────

FUNCTION takePosition(debat: DebatBloc, userId: UserId, position: Position) -> DebatBloc

    IF debat.status != OPEN THEN THROW Error("Débat fermé")

    debat.positions[userId] = position

    broadcastDebatUpdate(debat.id, {
        type: "POSITION_UPDATE",
        positionCounts: countPositions(debat.positions)
    })

    saveBloc(debat)
    RETURN debat
END FUNCTION

FUNCTION postArgument(debat: DebatBloc, userId: UserId, content: String,
                       position: Position, sourceRefs: List<SourceReference>,
                       parentId: ArgumentId | null) -> DebatBloc

    IF debat.status != OPEN THEN THROW Error("Débat fermé")

    // Validations
    IF LENGTH(content) < debat.config.minArgumentLength
        THROW Error("Argument trop court (min " + debat.config.minArgumentLength + " caractères)")
    END IF
    IF LENGTH(content) > debat.config.maxArgumentLength
        THROW Error("Argument trop long (max " + debat.config.maxArgumentLength + " caractères)")
    END IF
    IF debat.config.requireSource AND LENGTH(sourceRefs) == 0
        THROW Error("Vous devez citer au moins un texte du manuel")
    END IF

    // Vérifier la profondeur des réponses
    IF parentId IS NOT null
        depth = getReplyDepth(debat.arguments, parentId)
        IF depth >= debat.config.maxRepliesDepth
            THROW Error("Profondeur de réponse maximale atteinte")
        END IF
    END IF

    argument = Argument {
        id: generateId(),
        authorId: userId,
        authorName: IF debat.config.allowAnonymous THEN "Anonyme" ELSE loadUser(userId).name,
        position: position,
        content: content,
        sourceRefs: sourceRefs,
        parentId: parentId,
        replies: [],
        upvotes: {},
        downvotes: {},
        score: 0,
        isPinned: false,
        isModerated: (debat.config.moderationMode != PRE_MODERATION),
        createdAt: NOW()
    }

    IF parentId IS null
        APPEND argument TO debat.arguments
    ELSE
        parentArg = findArgument(debat.arguments, parentId)
        APPEND argument TO parentArg.replies
    END IF

    // Prendre automatiquement position si pas encore fait
    IF userId NOT IN debat.positions
        debat.positions[userId] = position
    END IF

    broadcastDebatUpdate(debat.id, {
        type: "NEW_ARGUMENT",
        argument: argument,
        positionCounts: countPositions(debat.positions)
    })

    saveBloc(debat)
    RETURN debat
END FUNCTION

FUNCTION voteArgument(debat: DebatBloc, userId: UserId, argumentId: ArgumentId,
                       voteType: Enum(UP, DOWN)) -> DebatBloc

    IF NOT debat.config.allowVoting THEN THROW Error("Votes désactivés")

    argument = findArgument(debat.arguments, argumentId)

    // Un utilisateur ne peut pas voter pour son propre argument
    IF argument.authorId == userId
        THROW Error("Vous ne pouvez pas voter pour votre propre argument")
    END IF

    // Retirer un vote existant
    argument.upvotes.REMOVE(userId)
    argument.downvotes.REMOVE(userId)

    // Ajouter le nouveau vote
    IF voteType == UP
        argument.upvotes.ADD(userId)
    ELSE
        argument.downvotes.ADD(userId)
    END IF

    argument.score = LENGTH(argument.upvotes) - LENGTH(argument.downvotes)

    broadcastDebatUpdate(debat.id, {
        type: "VOTE_UPDATE",
        argumentId: argumentId,
        score: argument.score
    })

    saveBloc(debat)
    RETURN debat
END FUNCTION

// ── Actions du prof ─────────────────────────────

FUNCTION pinArgument(debat: DebatBloc, argumentId: ArgumentId) -> DebatBloc
    argument = findArgument(debat.arguments, argumentId)
    argument.isPinned = NOT argument.isPinned
    saveBloc(debat)
    RETURN debat
END FUNCTION

FUNCTION moderateArgument(debat: DebatBloc, argumentId: ArgumentId, approved: Boolean) -> DebatBloc
    argument = findArgument(debat.arguments, argumentId)
    IF approved
        argument.isModerated = true
    ELSE
        removeArgument(debat.arguments, argumentId)
    END IF
    saveBloc(debat)
    RETURN debat
END FUNCTION

FUNCTION closeDebat(debat: DebatBloc, profComment: String) -> DebatBloc

    debat.status = CLOSED
    debat.closedAt = NOW()

    positions = countPositions(debat.positions)

    // Identifier les meilleurs arguments
    allArguments = flattenArguments(debat.arguments)
    pourArguments = FILTER(allArguments, a -> a.position == POUR)
    contreArguments = FILTER(allArguments, a -> a.position == CONTRE)

    bestPour = MAX_BY(pourArguments, a -> a.score)
    bestContre = MAX_BY(contreArguments, a -> a.score)

    // Collecter les philosophes mentionnés
    allSources = FLATTEN([a.sourceRefs FOR a IN allArguments])
    philosophers = UNIQUE([s.excerpt FOR s IN allSources WHERE containsPhilosopherName(s)])

    debat.summary = DebatSummary {
        bestArgumentPour: bestPour?.id,
        bestArgumentContre: bestContre?.id,
        profComment: profComment,
        philosophersReferenced: philosophers,
        votePour: positions[POUR] OR 0,
        voteContre: positions[CONTRE] OR 0,
        voteNuance: positions[NUANCE] OR 0
    }

    broadcastDebatUpdate(debat.id, {
        type: "DEBAT_CLOSED",
        summary: debat.summary
    })

    saveBloc(debat)
    RETURN debat
END FUNCTION

// ── Tri et affichage ────────────────────────────

FUNCTION getArgumentsSorted(debat: DebatBloc, sortBy: Enum, position: Position | null) -> List<Argument>

    args = debat.arguments

    // Filtrer par position si demandé
    IF position IS NOT null
        args = FILTER(args, a -> a.position == position)
    END IF

    // Filtrer les non-modérés
    args = FILTER(args, a -> a.isModerated)

    // Trier
    SWITCH sortBy
        CASE BEST:
            // Épinglés d'abord, puis par score, puis par date
            SORT args BY (a.isPinned DESC, a.score DESC, a.createdAt ASC)
        CASE RECENT:
            SORT args BY (a.isPinned DESC, a.createdAt DESC)
        CASE CONTROVERSIAL:
            // Arguments avec le plus de votes (up + down) et un score proche de 0
            SORT args BY (a.isPinned DESC, (LENGTH(a.upvotes) + LENGTH(a.downvotes)) DESC, ABS(a.score) ASC)
    END SWITCH

    RETURN args
END FUNCTION

// ── Utilitaires ─────────────────────────────────

FUNCTION countPositions(positions: Map<UserId, Position>) -> Map<Position, Integer>
    counts = { POUR: 0, CONTRE: 0, NUANCE: 0 }
    FOR EACH (userId, position) IN positions
        counts[position] += 1
    END FOR
    RETURN counts
END FUNCTION

FUNCTION getReplyDepth(arguments: List<Argument>, targetId: ArgumentId) -> Integer
    FUNCTION searchDepth(args, targetId, currentDepth)
        FOR EACH arg IN args
            IF arg.id == targetId THEN RETURN currentDepth
            IF LENGTH(arg.replies) > 0
                found = searchDepth(arg.replies, targetId, currentDepth + 1)
                IF found >= 0 THEN RETURN found
            END IF
        END FOR
        RETURN -1
    END FUNCTION
    RETURN searchDepth(arguments, targetId, 0)
END FUNCTION

FUNCTION findArgument(arguments: List<Argument>, targetId: ArgumentId) -> Argument | null
    FOR EACH arg IN arguments
        IF arg.id == targetId THEN RETURN arg
        IF LENGTH(arg.replies) > 0
            found = findArgument(arg.replies, targetId)
            IF found IS NOT null THEN RETURN found
        END IF
    END FOR
    RETURN null
END FUNCTION
```

---

## 11. 🎧 Bloc Lecteur Audio

### Description

Le bloc lecteur audio permet au prof d'**enregistrer ou d'uploader** un fichier audio directement dans un bloc du manuel. Cas d'usage : explication orale d'un passage difficile, cours magistral enregistré, lecture d'un texte philosophique, correction commentée.

Le lecteur intègre : lecture/pause, barre de progression, vitesse variable (0.5x à 2x), transcription automatique synchronisée (le texte se surligne au fur et à mesure de la lecture), et la possibilité pour l'élève de poser des marqueurs temporels ("Je n'ai pas compris à 2:34").

### Pseudo-code

```
MODULE AudioBloc

// ── Structures ──────────────────────────────────

STRUCTURE AudioBloc
    id               : String
    title            : String
    description      : String | null
    audioSource      : AudioSource
    duration         : Float              // en secondes
    transcription    : Transcription | null
    markers          : List<Marker>
    waveformData     : List<Float>        // amplitude normalisée pour affichage
    createdAt        : DateTime
END STRUCTURE

ENUM AudioSourceType
    RECORDED           // enregistré dans le navigateur
    UPLOADED           // fichier uploadé
    TTS                // text-to-speech généré
END ENUM

STRUCTURE AudioSource
    type             : AudioSourceType
    url              : String              // URL du fichier audio
    mimeType         : String              // "audio/webm", "audio/mp3", etc.
    fileSize         : Integer             // en bytes
    sampleRate       : Integer             // ex: 44100
END STRUCTURE

STRUCTURE Transcription
    segments         : List<TranscriptionSegment>
    fullText         : String
    language         : String
    isAutoGenerated  : Boolean
    confidence       : Float               // 0.0 à 1.0
END STRUCTURE

STRUCTURE TranscriptionSegment
    startTime        : Float               // en secondes
    endTime          : Float
    text             : String
    confidence       : Float
    speakerLabel     : String | null        // si multi-locuteurs
END STRUCTURE

STRUCTURE Marker
    id               : String
    userId           : UserId
    userName         : String
    timestamp        : Float               // position dans l'audio en secondes
    label            : String              // "Je n'ai pas compris", "Important", etc.
    type             : Enum(QUESTION, IMPORTANT, BOOKMARK, NOTE)
    note             : String | null
    createdAt        : DateTime
END STRUCTURE

STRUCTURE PlayerState
    isPlaying        : Boolean
    currentTime      : Float
    playbackRate     : Float              // 0.5, 0.75, 1.0, 1.25, 1.5, 2.0
    volume           : Float              // 0.0 à 1.0
    isMuted          : Boolean
    showTranscription : Boolean
    activeSegmentIndex : Integer | null    // segment de transcription en cours
    loop             : { start: Float, end: Float } | null  // boucle sur un passage
END STRUCTURE

// ── Enregistrement ──────────────────────────────

FUNCTION startRecording(blocId: String) -> RecordingSession

    // Demander l'accès au micro
    mediaStream = AWAIT navigator.mediaDevices.getUserMedia({ audio: true })

    recorder = new MediaRecorder(mediaStream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 128000
    })

    chunks = []
    recorder.onDataAvailable = (event) ->
        APPEND event.data TO chunks

    recorder.start(timeslice: 1000)  // chunk toutes les secondes

    RETURN RecordingSession {
        recorder: recorder,
        chunks: chunks,
        startedAt: NOW(),
        mediaStream: mediaStream
    }
END FUNCTION

FUNCTION stopRecording(session: RecordingSession) -> AudioSource

    session.recorder.stop()
    session.mediaStream.getTracks().forEach(track -> track.stop())

    // Assembler les chunks
    audioBlob = new Blob(session.chunks, { type: "audio/webm" })

    // Uploader
    url = AWAIT uploadAudio(audioBlob)

    // Générer la waveform
    waveformData = AWAIT generateWaveform(audioBlob)

    RETURN AudioSource {
        type: RECORDED,
        url: url,
        mimeType: "audio/webm",
        fileSize: audioBlob.size,
        sampleRate: 44100
    }
END FUNCTION

// ── Transcription automatique ───────────────────

FUNCTION transcribeAudio(audioSource: AudioSource) -> Transcription

    // Appel API de transcription (Whisper, Google Speech, etc.)
    result = AWAIT speechToTextAPI.transcribe({
        audioUrl: audioSource.url,
        language: "fr",
        enableTimestamps: true,
        enablePunctuation: true
    })

    segments = []
    FOR EACH segment IN result.segments
        APPEND TranscriptionSegment {
            startTime: segment.start,
            endTime: segment.end,
            text: segment.text,
            confidence: segment.confidence,
            speakerLabel: segment.speaker OR null
        } TO segments
    END FOR

    RETURN Transcription {
        segments: segments,
        fullText: JOIN([s.text FOR s IN segments], " "),
        language: "fr",
        isAutoGenerated: true,
        confidence: AVG([s.confidence FOR s IN segments])
    }
END FUNCTION

// ── Lecteur audio ───────────────────────────────

FUNCTION initPlayer(bloc: AudioBloc) -> PlayerState

    audioElement = new Audio(bloc.audioSource.url)
    audioElement.preload = "metadata"

    RETURN PlayerState {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        showTranscription: bloc.transcription IS NOT null,
        activeSegmentIndex: null,
        loop: null
    }
END FUNCTION

FUNCTION togglePlayPause(state: PlayerState, audioElement) -> PlayerState
    IF state.isPlaying
        audioElement.pause()
        state.isPlaying = false
    ELSE
        audioElement.play()
        state.isPlaying = true
    END IF
    RETURN state
END FUNCTION

FUNCTION seek(state: PlayerState, audioElement, time: Float) -> PlayerState
    audioElement.currentTime = CLAMP(time, 0, audioElement.duration)
    state.currentTime = audioElement.currentTime
    state.activeSegmentIndex = findSegmentAtTime(state, audioElement.currentTime)
    RETURN state
END FUNCTION

FUNCTION setPlaybackRate(state: PlayerState, audioElement, rate: Float) -> PlayerState
    rate = CLAMP(rate, 0.5, 2.0)
    audioElement.playbackRate = rate
    state.playbackRate = rate
    RETURN state
END FUNCTION

FUNCTION onTimeUpdate(state: PlayerState, audioElement, transcription: Transcription | null) -> PlayerState
    state.currentTime = audioElement.currentTime

    // Synchroniser la transcription
    IF transcription IS NOT null
        newIndex = findSegmentAtTime(transcription, state.currentTime)
        IF newIndex != state.activeSegmentIndex
            state.activeSegmentIndex = newIndex
            scrollTranscriptionToSegment(newIndex)
        END IF
    END IF

    // Gérer la boucle
    IF state.loop IS NOT null
        IF state.currentTime >= state.loop.end
            audioElement.currentTime = state.loop.start
        END IF
    END IF

    RETURN state
END FUNCTION

FUNCTION findSegmentAtTime(transcription: Transcription, time: Float) -> Integer | null
    FOR i FROM 0 TO LENGTH(transcription.segments) - 1
        segment = transcription.segments[i]
        IF time >= segment.startTime AND time < segment.endTime
            RETURN i
        END IF
    END FOR
    RETURN null
END FUNCTION

// ── Marqueurs ───────────────────────────────────

FUNCTION addMarker(bloc: AudioBloc, userId: UserId, timestamp: Float,
                    type: Enum, label: String, note: String | null) -> AudioBloc

    marker = Marker {
        id: generateId(),
        userId: userId,
        userName: loadUser(userId).name,
        timestamp: timestamp,
        label: label,
        type: type,
        note: note,
        createdAt: NOW()
    }

    APPEND marker TO bloc.markers
    SORT bloc.markers BY timestamp ASC

    // Si c'est une question, notifier le prof
    IF type == QUESTION
        notifyProf(bloc, {
            type: "STUDENT_QUESTION",
            studentName: marker.userName,
            timestamp: formatTime(timestamp),
            label: label,
            note: note
        })
    END IF

    saveBloc(bloc)
    RETURN bloc
END FUNCTION

// ── Waveform ────────────────────────────────────

FUNCTION generateWaveform(audioBlob: Blob) -> List<Float>

    audioContext = new AudioContext()
    arrayBuffer = AWAIT audioBlob.arrayBuffer()
    audioBuffer = AWAIT audioContext.decodeAudioData(arrayBuffer)

    channelData = audioBuffer.getChannelData(0)  // canal mono
    samples = LENGTH(channelData)
    bucketSize = FLOOR(samples / WAVEFORM_BARS)  // ex: 200 barres
    waveform = []

    FOR i FROM 0 TO WAVEFORM_BARS - 1
        start = i * bucketSize
        end = start + bucketSize
        slice = channelData[start:end]

        // RMS (root mean square) pour le volume moyen du bucket
        rms = SQRT(AVG([sample * sample FOR sample IN slice]))
        APPEND rms TO waveform
    END FOR

    // Normaliser entre 0 et 1
    maxRms = MAX(waveform)
    IF maxRms > 0
        waveform = [v / maxRms FOR v IN waveform]
    END IF

    RETURN waveform
END FUNCTION
```

---

## 12. 📅 Bloc Frise Chronologique Horizontale

### Description

La frise chronologique est un bloc interactif qui affiche des événements, auteurs, œuvres ou courants de pensée sur un **axe horizontal temporel**. L'utilisateur peut zoomer (d'une vue millénaire à une vue décennale), naviguer par glisser-déplacer, et cliquer sur chaque point pour accéder au bloc correspondant du manuel.

La frise supporte des **couches** (layers) : on peut afficher simultanément les auteurs, les œuvres, les événements historiques, et les courants philosophiques sur des lignes parallèles. Un système de filtre permet de ne voir que certaines couches.

Les **périodes** (Antiquité, Moyen-Âge, etc.) sont affichées en fond coloré. Les connexions entre événements (influence, contemporanéité) peuvent être visualisées par des lignes de liaison.

### Pseudo-code

```
MODULE FriseChronologique

// ── Structures ──────────────────────────────────

ENUM EventType
    AUTHOR_BIRTH
    AUTHOR_DEATH
    WORK_PUBLISHED
    HISTORICAL_EVENT
    PHILOSOPHICAL_MOVEMENT_START
    PHILOSOPHICAL_MOVEMENT_END
    CUSTOM
END ENUM

STRUCTURE TimelineEvent
    id              : String
    type            : EventType
    label           : String              // "Naissance de Kant"
    description     : String              // tooltip détaillé
    date            : HistoricalDate      // peut être approximative
    endDate         : HistoricalDate | null  // pour les périodes/durées
    layer           : String              // "Auteurs", "Œuvres", "Histoire"
    color           : String
    icon            : String | null        // emoji ou icône
    linkedBlocId    : BlocId | null        // lien vers le bloc du manuel
    imageUrl        : String | null
    importance      : Enum(MAJOR, NORMAL, MINOR)  // affecte la taille du point
END STRUCTURE

STRUCTURE HistoricalDate
    year            : Integer             // peut être négatif (avant J.-C.)
    month           : Integer | null      // 1-12, null si inconnu
    day             : Integer | null
    approximate     : Boolean             // "vers 427 av. J.-C."
    display         : String              // "427 av. J.-C.", "1724", etc.
END STRUCTURE

STRUCTURE Period
    id              : String
    label           : String              // "Antiquité", "Lumières"
    startYear       : Integer
    endYear         : Integer
    color           : String              // couleur de fond (semi-transparente)
    layer           : String
END STRUCTURE

STRUCTURE Connection
    id              : String
    fromEventId     : String
    toEventId       : String
    label           : String | null        // "influence", "en réaction à"
    type            : Enum(INFLUENCE, REACTION, CONTEMPORARY, CUSTOM)
    color           : String
END STRUCTURE

STRUCTURE TimelineBloc
    id              : String
    title           : String
    events          : List<TimelineEvent>
    periods         : List<Period>
    connections     : List<Connection>
    layers          : List<LayerConfig>
    defaultZoom     : ZoomLevel
END STRUCTURE

STRUCTURE LayerConfig
    id              : String
    label           : String              // "Auteurs", "Œuvres"
    color           : String
    visible         : Boolean
    yPosition       : Integer             // ordre vertical (0 = haut)
END STRUCTURE

STRUCTURE TimelineViewState
    visibleRange    : { startYear: Integer, endYear: Integer }
    zoom            : Float               // pixels par année
    panOffset       : Float               // décalage horizontal en pixels
    selectedEvent   : EventId | null
    hoveredEvent    : EventId | null
    visibleLayers   : Set<String>
    showConnections : Boolean
    showPeriods     : Boolean
    containerWidth  : Integer
    containerHeight : Integer
END STRUCTURE

ENUM ZoomLevel
    MILLENNIAL       // -500 → 2100 (tout visible)
    CENTURIES         // 500 ans visibles
    HALF_CENTURY      // 50 ans
    DECADE            // 10 ans
END ENUM

// ── Initialisation ──────────────────────────────

FUNCTION initTimeline(bloc: TimelineBloc, containerWidth: Integer, containerHeight: Integer) -> TimelineViewState

    // Calculer la plage totale
    allYears = [e.date.year FOR e IN bloc.events]
    IF LENGTH(bloc.periods) > 0
        allYears += [p.startYear FOR p IN bloc.periods]
        allYears += [p.endYear FOR p IN bloc.periods]
    END IF
    minYear = MIN(allYears) - 50    // marge
    maxYear = MAX(allYears) + 50

    // Zoom initial : tout visible
    totalYears = maxYear - minYear
    zoom = containerWidth / totalYears   // pixels par année

    RETURN TimelineViewState {
        visibleRange: { startYear: minYear, endYear: maxYear },
        zoom: zoom,
        panOffset: 0,
        selectedEvent: null,
        hoveredEvent: null,
        visibleLayers: SET(layer.id FOR layer IN bloc.layers WHERE layer.visible),
        showConnections: true,
        showPeriods: true,
        containerWidth: containerWidth,
        containerHeight: containerHeight
    }
END FUNCTION

// ── Positionnement ──────────────────────────────

FUNCTION yearToPixel(year: Integer, state: TimelineViewState) -> Float
    RETURN (year - state.visibleRange.startYear) * state.zoom + state.panOffset
END FUNCTION

FUNCTION pixelToYear(pixel: Float, state: TimelineViewState) -> Integer
    RETURN ROUND((pixel - state.panOffset) / state.zoom + state.visibleRange.startYear)
END FUNCTION

FUNCTION getEventPosition(event: TimelineEvent, state: TimelineViewState, layers: List<LayerConfig>) -> { x: Float, y: Float }

    x = yearToPixel(event.date.year, state)

    layerConfig = FIND(layers, l -> l.id == event.layer)
    layerIndex = layerConfig.yPosition
    y = TIMELINE_TOP_MARGIN + (layerIndex * LAYER_HEIGHT) + (LAYER_HEIGHT / 2)

    RETURN { x, y }
END FUNCTION

// ── Navigation ──────────────────────────────────

FUNCTION zoomTimeline(state: TimelineViewState, delta: Float, centerPixel: Float) -> TimelineViewState

    // Le zoom se fait autour du point sous la souris
    centerYear = pixelToYear(centerPixel, state)

    // Appliquer le zoom
    oldZoom = state.zoom
    state.zoom = CLAMP(state.zoom * (1 + delta * 0.1), MIN_ZOOM, MAX_ZOOM)

    // Ajuster le pan pour garder centerYear sous la souris
    state.panOffset = centerPixel - (centerYear - state.visibleRange.startYear) * state.zoom

    // Recalculer la plage visible
    state.visibleRange.startYear = pixelToYear(0, state)
    state.visibleRange.endYear = pixelToYear(state.containerWidth, state)

    RETURN state
END FUNCTION

FUNCTION panTimeline(state: TimelineViewState, deltaPixels: Float) -> TimelineViewState
    state.panOffset += deltaPixels
    state.visibleRange.startYear = pixelToYear(0, state)
    state.visibleRange.endYear = pixelToYear(state.containerWidth, state)
    RETURN state
END FUNCTION

FUNCTION zoomToFit(state: TimelineViewState, events: List<TimelineEvent>) -> TimelineViewState
    years = [e.date.year FOR e IN events]
    minYear = MIN(years) - 20
    maxYear = MAX(years) + 20
    totalYears = maxYear - minYear
    state.zoom = state.containerWidth / totalYears
    state.panOffset = 0
    state.visibleRange = { startYear: minYear, endYear: maxYear }
    RETURN state
END FUNCTION

// ── Rendu ───────────────────────────────────────

FUNCTION renderTimeline(bloc: TimelineBloc, state: TimelineViewState) -> UIElement

    RETURN Container {
        className: "timeline-container",
        onWheel: (e) -> zoomTimeline(state, -e.deltaY, e.offsetX),
        onDrag: (dx) -> panTimeline(state, dx),
        children: [

            // 1. Fond : périodes historiques
            IF state.showPeriods
                FOR EACH period IN bloc.periods
                    x1 = yearToPixel(period.startYear, state)
                    x2 = yearToPixel(period.endYear, state)
                    IF x2 > 0 AND x1 < state.containerWidth   // visible ?
                        PeriodBackground {
                            x: MAX(x1, 0),
                            width: MIN(x2, state.containerWidth) - MAX(x1, 0),
                            height: state.containerHeight,
                            color: period.color + "20",   // semi-transparent
                            label: period.label,
                            showLabel: (x2 - x1) > 80     // assez large pour le texte
                        }
                    END IF

            // 2. Axe principal
            TimelineAxis {
                startYear: state.visibleRange.startYear,
                endYear: state.visibleRange.endYear,
                zoom: state.zoom,
                y: state.containerHeight - AXIS_BOTTOM_MARGIN,
                // Graduations adaptatives au zoom
                majorTicks: computeMajorTicks(state),
                minorTicks: computeMinorTicks(state)
            },

            // 3. Lignes des couches (layers)
            FOR EACH layer IN bloc.layers WHERE layer.id IN state.visibleLayers
                LayerLine {
                    y: TIMELINE_TOP_MARGIN + (layer.yPosition * LAYER_HEIGHT),
                    width: state.containerWidth,
                    label: layer.label,
                    color: layer.color
                },

            // 4. Connexions entre événements
            IF state.showConnections
                FOR EACH conn IN bloc.connections
                    fromEvent = FIND(bloc.events, e -> e.id == conn.fromEventId)
                    toEvent = FIND(bloc.events, e -> e.id == conn.toEventId)
                    IF fromEvent.layer IN state.visibleLayers AND toEvent.layer IN state.visibleLayers
                        fromPos = getEventPosition(fromEvent, state, bloc.layers)
                        toPos = getEventPosition(toEvent, state, bloc.layers)
                        ConnectionLine {
                            from: fromPos,
                            to: toPos,
                            label: conn.label,
                            color: conn.color,
                            curved: true
                        }
                    END IF

            // 5. Événements
            FOR EACH event IN bloc.events WHERE event.layer IN state.visibleLayers
                pos = getEventPosition(event, state, bloc.layers)
                IF pos.x > -50 AND pos.x < state.containerWidth + 50   // visible ?

                    isSelected = (state.selectedEvent == event.id)
                    isHovered = (state.hoveredEvent == event.id)

                    // Point sur la frise
                    EventDot {
                        position: pos,
                        radius: SWITCH event.importance
                            CASE MAJOR -> 10
                            CASE NORMAL -> 6
                            CASE MINOR -> 4,
                        color: event.color,
                        icon: event.icon,
                        pulsing: isSelected,
                        glowing: isHovered
                    },

                    // Label (texte à côté du point)
                    EventLabel {
                        position: { x: pos.x, y: pos.y - 20 },
                        text: event.label,
                        date: event.date.display,
                        fontSize: IF event.importance == MAJOR THEN 14 ELSE 11,
                        visible: (state.zoom > LABEL_VISIBILITY_THRESHOLD) OR event.importance == MAJOR,
                        rotated: state.zoom < ROTATION_THRESHOLD   // tourner si zoom arrière pour éviter le chevauchement
                    },

                    // Durée (barre horizontale si endDate)
                    IF event.endDate IS NOT null
                        DurationBar {
                            x1: pos.x,
                            x2: yearToPixel(event.endDate.year, state),
                            y: pos.y,
                            color: event.color,
                            height: 4
                        },

            // 6. Tooltip au survol
            IF state.hoveredEvent IS NOT null
                event = FIND(bloc.events, e -> e.id == state.hoveredEvent)
                pos = getEventPosition(event, state, bloc.layers)
                EventTooltip {
                    position: pos,
                    event: event
                },

            // 7. Panneau détail (sélection)
            IF state.selectedEvent IS NOT null
                renderEventDetail(bloc, state),

            // 8. Contrôles
            TimelineControls {
                layers: bloc.layers,
                visibleLayers: state.visibleLayers,
                onToggleLayer: (layerId) -> toggleLayer(state, layerId),
                onZoomIn: () -> zoomTimeline(state, 3, state.containerWidth / 2),
                onZoomOut: () -> zoomTimeline(state, -3, state.containerWidth / 2),
                onZoomToFit: () -> zoomToFit(state, bloc.events),
                showConnections: state.showConnections,
                onToggleConnections: () -> state.showConnections = NOT state.showConnections,
                showPeriods: state.showPeriods,
                onTogglePeriods: () -> state.showPeriods = NOT state.showPeriods
            }
        ]
    }
END FUNCTION

// ── Graduations adaptatives ─────────────────────

FUNCTION computeMajorTicks(state: TimelineViewState) -> List<{ year: Integer, label: String }>

    visibleYears = state.visibleRange.endYear - state.visibleRange.startYear

    // Choisir l'intervalle selon le zoom
    interval = IF visibleYears > 2000 THEN 500
               ELSE IF visibleYears > 500 THEN 100
               ELSE IF visibleYears > 200 THEN 50
               ELSE IF visibleYears > 50 THEN 10
               ELSE IF visibleYears > 20 THEN 5
               ELSE 1

    ticks = []
    startTick = FLOOR(state.visibleRange.startYear / interval) * interval
    FOR year FROM startTick TO state.visibleRange.endYear STEP interval
        label = IF year < 0 THEN ABS(year) + " av. J.-C."
                ELSE IF year == 0 THEN "0"
                ELSE toString(year)
        APPEND { year, label } TO ticks
    END FOR

    RETURN ticks
END FUNCTION

// ── Détail d'un événement ───────────────────────

FUNCTION renderEventDetail(bloc: TimelineBloc, state: TimelineViewState) -> UIElement
    event = FIND(bloc.events, e -> e.id == state.selectedEvent)

    RETURN SidePanel {
        title: event.label,
        children: [
            DateDisplay(event.date, event.endDate),
            IF event.imageUrl THEN Image(event.imageUrl),
            Text(event.description),
            IF event.linkedBlocId
                Button(
                    label: "📖 Voir dans le manuel",
                    onClick: () -> navigateToBloc(event.linkedBlocId)
                ),
            // Connexions depuis cet événement
            relatedConnections = FILTER(bloc.connections,
                c -> c.fromEventId == event.id OR c.toEventId == event.id)
            IF LENGTH(relatedConnections) > 0
                ConnectionList {
                    connections: relatedConnections,
                    events: bloc.events,
                    onClickEvent: (eventId) -> state.selectedEvent = eventId
                },
            CloseButton(onClick: () -> state.selectedEvent = null)
        ]
    }
END FUNCTION
```

---

## 13. ⚖️ Bloc Comparaison Côte à Côte

### Description

Le bloc comparaison affiche **deux contenus en parallèle** dans deux colonnes synchronisées : deux textes philosophiques, deux auteurs, deux thèses, deux époques. Le prof peut créer des **liens visuels** entre les passages correspondants (des lignes colorées qui relient un passage de gauche à un passage de droite).

Le scroll est **synchronisé** : quand l'élève scrolle à gauche, la droite suit (optionnel). Chaque côté peut contenir du texte riche, des citations, des images. Un panneau de synthèse en bas résume les points communs et les divergences.

### Pseudo-code

```
MODULE ComparaisonBloc

// ── Structures ──────────────────────────────────

STRUCTURE ComparaisonBloc
    id               : String
    title            : String              // "Descartes vs Hume : les sources de la connaissance"
    leftColumn       : ComparisonColumn
    rightColumn      : ComparisonColumn
    links            : List<ComparisonLink>  // liens visuels entre passages
    synthesis        : Synthesis | null
    config           : ComparisonConfig
END STRUCTURE

STRUCTURE ComparisonColumn
    id               : String
    title            : String              // "Descartes" ou "Rationalisme"
    subtitle         : String | null        // "Méditations métaphysiques, II"
    color            : String              // couleur d'accentuation
    icon             : String | null
    sections         : List<ComparisonSection>
    sourceBlocId     : BlocId | null        // lien vers le bloc source du manuel
END STRUCTURE

STRUCTURE ComparisonSection
    id               : String
    label            : String | null        // "Thèse principale", "Argument 1", "Exemple"
    content          : RichText            // texte riche (Markdown/HTML)
    type             : Enum(QUOTE, ANALYSIS, DEFINITION, ARGUMENT, EXAMPLE, CONTEXT)
    highlightable    : Boolean             // l'élève peut surligner
END STRUCTURE

STRUCTURE ComparisonLink
    id               : String
    leftSectionId    : String
    rightSectionId   : String
    type             : Enum(SIMILARITY, OPPOSITION, NUANCE, EVOLUTION, CAUSE_EFFECT)
    label            : String | null        // "s'oppose à", "est similaire à"
    color            : String              // déduit du type
    description      : String | null        // explication du lien
END STRUCTURE

STRUCTURE Synthesis
    commonPoints     : List<String>
    divergences      : List<String>
    profComment      : String | null
    conclusion       : String | null
END STRUCTURE

STRUCTURE ComparisonConfig
    syncScroll       : Boolean             // scroll synchronisé entre les deux colonnes
    showLinks        : Boolean             // afficher les lignes de liaison
    showSynthesis    : Boolean
    allowStudentLinks : Boolean            // les élèves peuvent créer des liens
    layout           : Enum(SIDE_BY_SIDE, STACKED, OVERLAY)  // côte à côte, empilé (mobile), superposé
END STRUCTURE

STRUCTURE ComparisonViewState
    config           : ComparisonConfig
    selectedLink     : LinkId | null
    hoveredLink      : LinkId | null
    leftScrollTop    : Float
    rightScrollTop   : Float
    creatingLink     : {
        fromSide     : Enum(LEFT, RIGHT)
        fromSectionId : String
    } | null
    highlightedSections : Set<String>      // sections surlignées
END STRUCTURE

// ── Rendu principal ─────────────────────────────

FUNCTION renderComparaison(bloc: ComparaisonBloc, state: ComparisonViewState) -> UIElement

    // Choisir le layout selon la largeur d'écran
    effectiveLayout = IF screenWidth < 768 THEN STACKED ELSE state.config.layout

    RETURN Container {
        className: "comparison-bloc",
        children: [
            // Titre du bloc
            Header {
                title: bloc.title,
                controls: [
                    Toggle(label: "Scroll synchronisé", checked: state.config.syncScroll,
                           onChange: (v) -> state.config.syncScroll = v),
                    Toggle(label: "Liens", checked: state.config.showLinks,
                           onChange: (v) -> state.config.showLinks = v),
                    IF state.config.allowStudentLinks
                        Button(label: "✏️ Créer un lien", onClick: () -> startLinkCreation(state))
                ]
            },

            // Corps : deux colonnes + liens
            IF effectiveLayout == SIDE_BY_SIDE
                renderSideBySide(bloc, state)
            ELSE IF effectiveLayout == STACKED
                renderStacked(bloc, state),

            // Synthèse en bas
            IF state.config.showSynthesis AND bloc.synthesis IS NOT null
                renderSynthesis(bloc.synthesis)
        ]
    }
END FUNCTION

FUNCTION renderSideBySide(bloc: ComparaisonBloc, state: ComparisonViewState) -> UIElement

    RETURN HorizontalLayout {
        className: "comparison-columns",
        children: [
            // Colonne gauche
            ScrollableColumn {
                id: "left-column",
                width: "45%",
                onScroll: (scrollTop) ->
                    state.leftScrollTop = scrollTop
                    IF state.config.syncScroll
                        syncScroll("right-column", scrollTop),
                children: [
                    renderColumn(bloc.leftColumn, LEFT, state)
                ]
            },

            // Zone centrale : les liens visuels (SVG overlay)
            IF state.config.showLinks
                LinkOverlay {
                    width: "10%",
                    links: bloc.links,
                    leftSections: bloc.leftColumn.sections,
                    rightSections: bloc.rightColumn.sections,
                    state: state,
                    children: FOR EACH link IN bloc.links
                        renderLink(link, bloc, state)
                },

            // Colonne droite
            ScrollableColumn {
                id: "right-column",
                width: "45%",
                onScroll: (scrollTop) ->
                    state.rightScrollTop = scrollTop
                    IF state.config.syncScroll
                        syncScroll("left-column", scrollTop),
                children: [
                    renderColumn(bloc.rightColumn, RIGHT, state)
                ]
            }
        ]
    }
END FUNCTION

// ── Rendu d'une colonne ─────────────────────────

FUNCTION renderColumn(column: ComparisonColumn, side: Enum, state: ComparisonViewState) -> UIElement

    RETURN ColumnContainer {
        className: "comparison-column",
        borderColor: column.color,
        children: [
            // En-tête de colonne
            ColumnHeader {
                title: column.title,
                subtitle: column.subtitle,
                icon: column.icon,
                color: column.color,
                linkedBloc: column.sourceBlocId,
                onClickLinkedBloc: () -> navigateToBloc(column.sourceBlocId)
            },

            // Sections
            FOR EACH section IN column.sections
                SectionCard {
                    id: "section-" + section.id,
                    className: "comparison-section" +
                        IF section.id IN state.highlightedSections THEN " highlighted" ELSE "",
                    children: [
                        // Label de la section
                        IF section.label
                            SectionLabel {
                                text: section.label,
                                type: section.type,
                                icon: iconForType(section.type)
                            },

                        // Contenu
                        RichTextRenderer {
                            content: section.content,
                            highlightable: section.highlightable,
                            onHighlight: (selection) -> handleHighlight(section, selection)
                        },

                        // Bouton pour créer un lien depuis cette section
                        IF state.config.allowStudentLinks
                            IF state.creatingLink IS NOT null AND state.creatingLink.fromSide != side
                                // On est en mode création de lien, et l'autre côté a été sélectionné
                                LinkTargetButton {
                                    label: "🔗 Lier ici",
                                    onClick: () -> completeLink(state, section.id, side)
                                }
                            ELSE IF state.creatingLink IS null
                                LinkSourceButton {
                                    label: "🔗",
                                    onClick: () -> state.creatingLink = {
                                        fromSide: side,
                                        fromSectionId: section.id
                                    }
                                }
                    ],
                    onMouseEnter: () ->
                        // Surligner les sections liées de l'autre côté
                        linkedSections = getLinkedSections(bloc.links, section.id)
                        state.highlightedSections = SET(linkedSections),
                    onMouseLeave: () ->
                        state.highlightedSections = SET()
                }
        ]
    }
END FUNCTION

// ── Liens visuels ───────────────────────────────

FUNCTION renderLink(link: ComparisonLink, bloc: ComparaisonBloc, state: ComparisonViewState) -> UIElement

    // Calculer les positions Y des sections liées
    leftSectionElement = getElementById("section-" + link.leftSectionId)
    rightSectionElement = getElementById("section-" + link.rightSectionId)

    IF leftSectionElement IS null OR rightSectionElement IS null THEN RETURN null

    leftY = leftSectionElement.offsetTop + leftSectionElement.offsetHeight / 2 - state.leftScrollTop
    rightY = rightSectionElement.offsetTop + rightSectionElement.offsetHeight / 2 - state.rightScrollTop

    isActive = (state.selectedLink == link.id OR state.hoveredLink == link.id)

    // Couleur selon le type
    color = SWITCH link.type
        CASE SIMILARITY  -> "#22C55E"   // vert
        CASE OPPOSITION  -> "#EF4444"   // rouge
        CASE NUANCE      -> "#3B82F6"   // bleu
        CASE EVOLUTION   -> "#F59E0B"   // orange
        CASE CAUSE_EFFECT -> "#8B5CF6"  // violet
    END SWITCH

    RETURN Group {
        onMouseEnter: () -> state.hoveredLink = link.id,
        onMouseLeave: () -> state.hoveredLink = null,
        onClick: () -> state.selectedLink = IF state.selectedLink == link.id THEN null ELSE link.id,
        children: [
            // Courbe de Bézier entre les deux points
            BezierCurve {
                startX: 0,
                startY: leftY,
                endX: linkOverlayWidth,
                endY: rightY,
                controlPoint1: { x: linkOverlayWidth * 0.4, y: leftY },
                controlPoint2: { x: linkOverlayWidth * 0.6, y: rightY },
                strokeColor: color,
                strokeWidth: IF isActive THEN 3 ELSE 1.5,
                opacity: IF isActive THEN 1.0 ELSE 0.5,
                dashed: link.type == NUANCE
            },

            // Icône au milieu de la courbe
            LinkIcon {
                position: bezierMidpoint(leftY, rightY),
                icon: SWITCH link.type
                    CASE SIMILARITY  -> "="
                    CASE OPPOSITION  -> "≠"
                    CASE NUANCE      -> "~"
                    CASE EVOLUTION   -> "→"
                    CASE CAUSE_EFFECT -> "⇒",
                color: color,
                size: IF isActive THEN 24 ELSE 16
            },

            // Label du lien (au survol)
            IF isActive AND link.label
                LinkLabel {
                    text: link.label,
                    position: bezierMidpoint(leftY, rightY),
                    color: color
                },

            // Description détaillée (au clic)
            IF state.selectedLink == link.id AND link.description
                LinkDescription {
                    text: link.description,
                    position: bezierMidpoint(leftY, rightY),
                    maxWidth: linkOverlayWidth
                }
        ]
    }
END FUNCTION

// ── Création de lien par l'élève ────────────────

FUNCTION startLinkCreation(state: ComparisonViewState)
    state.creatingLink = null   // reset, l'élève doit cliquer sur une section source
    showInstruction("Cliquez sur une section à gauche ou à droite pour commencer le lien")
END FUNCTION

FUNCTION completeLink(state: ComparisonViewState, targetSectionId: String, targetSide: Enum)

    IF state.creatingLink IS null THEN RETURN

    // Déterminer quel côté est left, quel côté est right
    IF state.creatingLink.fromSide == LEFT
        leftSectionId = state.creatingLink.fromSectionId
        rightSectionId = targetSectionId
    ELSE
        leftSectionId = targetSectionId
        rightSectionId = state.creatingLink.fromSectionId
    END IF

    // Demander le type de lien
    showLinkTypeDialog({
        options: [SIMILARITY, OPPOSITION, NUANCE, EVOLUTION, CAUSE_EFFECT],
        onSelect: (type, label) ->
            newLink = ComparisonLink {
                id: generateId(),
                leftSectionId: leftSectionId,
                rightSectionId: rightSectionId,
                type: type,
                label: label,
                color: colorForType(type),
                description: null
            }
            APPEND newLink TO bloc.links
            state.creatingLink = null
            saveBloc(bloc)
    })
END FUNCTION

// ── Scroll synchronisé ─────────────────────────

FUNCTION syncScroll(targetColumnId: String, scrollTop: Float)
    targetElement = getElementById(targetColumnId)

    // Proportionnel : même pourcentage de scroll
    sourceMaxScroll = sourceElement.scrollHeight - sourceElement.clientHeight
    targetMaxScroll = targetElement.scrollHeight - targetElement.clientHeight

    IF sourceMaxScroll > 0
        scrollPercent = scrollTop / sourceMaxScroll
        targetElement.scrollTop = scrollPercent * targetMaxScroll
    END IF
END FUNCTION

// ── Synthèse ────────────────────────────────────

FUNCTION renderSynthesis(synthesis: Synthesis) -> UIElement

    RETURN SynthesisPanel {
        className: "comparison-synthesis",
        children: [
            Heading("Synthèse", level: 4),

            IF LENGTH(synthesis.commonPoints) > 0
                SynthesisSection {
                    icon: "🤝",
                    title: "Points communs",
                    items: synthesis.commonPoints,
                    color: "#22C55E"
                },

            IF LENGTH(synthesis.divergences) > 0
                SynthesisSection {
                    icon: "⚡",
                    title: "Divergences",
                    items: synthesis.divergences,
                    color: "#EF4444"
                },

            IF synthesis.profComment
                ProfComment {
                    icon: "💬",
                    title: "Commentaire du professeur",
                    text: synthesis.profComment
                },

            IF synthesis.conclusion
                ConclusionBox {
                    icon: "💡",
                    text: synthesis.conclusion
                }
        ]
    }
END FUNCTION

// ── Utilitaires ─────────────────────────────────

FUNCTION getLinkedSections(links: List<ComparisonLink>, sectionId: String) -> List<String>
    result = []
    FOR EACH link IN links
        IF link.leftSectionId == sectionId
            APPEND link.rightSectionId TO result
        ELSE IF link.rightSectionId == sectionId
            APPEND link.leftSectionId TO result
        END IF
    END FOR
    RETURN result
END FUNCTION

FUNCTION iconForType(type: Enum) -> String
    RETURN SWITCH type
        CASE QUOTE      -> "💬"
        CASE ANALYSIS   -> "🔍"
        CASE DEFINITION -> "📖"
        CASE ARGUMENT   -> "💡"
        CASE EXAMPLE    -> "📌"
        CASE CONTEXT    -> "🏛️"
    END SWITCH
END FUNCTION
```

---