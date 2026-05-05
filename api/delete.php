<?php
/**
 * api/delete.php — Supprime un manuel
 * POST { id: string }
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method Not Allowed']); exit; }

$body = file_get_contents('php://input');
$payload = json_decode($body, true);
$id = $payload['id'] ?? '';

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

unlink($path);
echo json_encode(['ok' => true]);
