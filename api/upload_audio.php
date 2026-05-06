<?php
/**
 * api/upload_audio.php — Upload d'un fichier audio (max 50 Mo)
 * POST multipart/form-data avec champ "audio"
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

if (!isset($_FILES['audio'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing audio file']);
    exit;
}

$file = $_FILES['audio'];
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error']);
    exit;
}

$maxBytes = 50 * 1024 * 1024;
$size = (int)($file['size'] ?? 0);
if ($size <= 0 || $size > $maxBytes) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large (max 50MB)']);
    exit;
}

$tmpName = $file['tmp_name'] ?? '';
if (!$tmpName || !is_uploaded_file($tmpName)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid upload source']);
    exit;
}

$allowedExt = ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac', 'flac'];
$originalName = (string)($file['name'] ?? 'audio');
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unsupported audio format']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = strtolower((string)$finfo->file($tmpName));
$allowedMime = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4'
];
if (!in_array($mime, $allowedMime, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid audio mime type']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/audio';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create upload directory']);
    exit;
}

$basename = bin2hex(random_bytes(12));
$targetName = $basename . '.' . $ext;
$targetPath = $uploadDir . '/' . $targetName;

if (!move_uploaded_file($tmpName, $targetPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to store uploaded file']);
    exit;
}

echo json_encode([
    'ok' => true,
    'url' => 'uploads/audio/' . $targetName,
    'size' => $size,
    'mime' => $mime
]);
