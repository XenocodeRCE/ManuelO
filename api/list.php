<?php
/**
 * api/list.php — Liste les manuels disponibles
 * GET → [{id, title, subject, chapter, updatedAt}]
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dir = __DIR__ . '/../manuals';
$manuals = [];

if (is_dir($dir)) {
    foreach (glob($dir . '/*.json') as $file) {
        $id = basename($file, '.json');
        // Validation défensive : ignorer les fichiers avec des noms invalides
        if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id)) continue;

        $content = file_get_contents($file);
        $data = json_decode($content, true);
        if (!$data) continue;

        $meta = $data['meta'] ?? [];
        $manuals[] = [
            'id'        => $id,
            'title'     => $meta['title']   ?? 'Sans titre',
            'subject'   => $meta['subject'] ?? '',
            'chapter'   => $meta['chapter'] ?? '',
            'author'    => $meta['author']  ?? '',
            'updatedAt' => $meta['updatedAt'] ?? filemtime($file),
        ];
    }
}

// Tri par date de modification décroissante
usort($manuals, fn($a, $b) => $b['updatedAt'] <=> $a['updatedAt']);

echo json_encode($manuals, JSON_UNESCAPED_UNICODE);
