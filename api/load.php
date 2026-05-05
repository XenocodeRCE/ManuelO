<?php
/**
 * api/load.php — Charge un manuel depuis son ID
 * GET ?id={id} → le contenu du manuel JSON
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$id = $_GET['id'] ?? '';

if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid id']);
    exit;
}

$path = __DIR__ . '/../manuals/' . $id . '.json';

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

echo file_get_contents($path);
