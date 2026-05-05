<?php
/**
 * api/save.php — Sauvegarde un manuel en JSON
 * POST { id: string, data: object }
 * Le fichier est écrit dans manuals/{id}.json
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$body = file_get_contents('php://input');
$payload = json_decode($body, true);

if (!$payload || !isset($payload['id']) || !isset($payload['data'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing id or data']);
    exit;
}

$id = $payload['id'];

// Validation stricte de l'ID : lettres, chiffres, tirets et underscores uniquement
// Prévient toute attaque de type path traversal
if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid id format']);
    exit;
}

$dir = __DIR__ . '/../manuals';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$path = $dir . '/' . $id . '.json';
$json = json_encode($payload['data'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

if ($json === false) {
    http_response_code(500);
    echo json_encode(['error' => 'JSON encoding failed']);
    exit;
}

// Écriture atomique via fichier temporaire
$tmp = $path . '.tmp';
if (file_put_contents($tmp, $json, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Write failed']);
    exit;
}
rename($tmp, $path);

echo json_encode(['ok' => true, 'id' => $id]);
