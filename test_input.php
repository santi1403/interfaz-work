<?php
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
header('Content-Type: application/json');
echo json_encode(['raw'=>$raw, 'data'=>$data, 'post'=>$_POST]);
