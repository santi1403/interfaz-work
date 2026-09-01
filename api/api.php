<?php
// api.php - Backend para interfaz 2 -> MySQL gestion_clientes
// Coloca este archivo junto a index.html (o en htdocs/gestion_clientes/api.php)
// Requiere: PHP 7.4+ con PDO MySQL

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$DB_HOST = '127.0.0.1';
$DB_PORT = '3306';
$DB_NAME = 'gestion_clientes';
$DB_USER = 'root';
$DB_PASS = '1234'; // tu clave puesta en el Installer. Si la dejaste vacía usa ''

try {
    $pdo = new PDO("mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'No conecta a MySQL: '.$e->getMessage()]);
    exit;
}


// Configuración dinámica por Tipo ID (misma que frontend)
$docConfig = [
  'CC'  => ['label'=>'Cédula de Ciudadanía', 'tipo'=>'numeric', 'min'=>6, 'max'=>10],
  'CE'  => ['label'=>'Cédula de Extranjería', 'tipo'=>'numeric', 'min'=>3, 'max'=>7],
  'TI'  => ['label'=>'Tarjeta de Identidad', 'tipo'=>'numeric', 'min'=>10, 'max'=>11],
  'PA'  => ['label'=>'Pasaporte', 'tipo'=>'alphanumeric', 'min'=>6, 'max'=>16],
  'NIT' => ['label'=>'NIT', 'tipo'=>'numeric', 'min'=>9, 'max'=>10],
  'PEP' => ['label'=>'PEP', 'tipo'=>'numeric', 'min'=>15, 'max'=>15],
  'PPT' => ['label'=>'PPT', 'tipo'=>'numeric', 'min'=>6, 'max'=>8],
  'Otro'=> ['label'=>'Otro', 'tipo'=>'alphanumeric', 'min'=>3, 'max'=>20],
];
function validarDocumento($tipo, $num){
  global $docConfig;
  $cfg = $docConfig[$tipo] ?? $docConfig['CC'];
  $num = trim(preg_replace('/[\s\.\-]/','',$num));
  // Pasaporte y Otro siempre en mayúsculas
  if(in_array($tipo, ['PA','Otro'])) $num = strtoupper($num);
  $len = strlen($num);
  if($len < $cfg['min'] || $len > $cfg['max']){
    return $cfg['label']." debe tener entre ".$cfg['min']." y ".$cfg['max']." caracteres (actual: $len)";
  }
  $regex = $cfg['tipo']==='numeric' ? '/^[0-9]+$/' : '/^[a-zA-Z0-9]+$/';
  if(!preg_match($regex, $num)){
    return $cfg['tipo']==='numeric' ? "Solo números para ".$cfg['label'] : "Solo letras y números para ".$cfg['label'];
  }
  return null;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

function getClientesConEmails($pdo, $estadoFiltro='todos') {
    $sql = "SELECT * FROM clientes";
    $params = [];
    if ($estadoFiltro==='activo' || $estadoFiltro==='suspendido') { $sql .= " WHERE estado=?"; $params[]=$estadoFiltro; }
    $sql .= " ORDER BY id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $clientes = $stmt->fetchAll();
    foreach ($clientes as &$c) {
        $st = $pdo->prepare("SELECT email FROM cliente_emails WHERE cliente_id=?");
        $st->execute([$c['id']]);
        $c['emails'] = array_column($st->fetchAll(), 'email');
        $c['numCliente'] = $c['num_cliente'];
        $c['tipoCliente'] = $c['tipo_id'];
        $c['fechaDesde'] = $c['fecha_desde'];
        $c['fechaNacimiento'] = $c['fecha_nacimiento'];
        $c['estado'] = $c['estado'] ?? 'activo';
    }
    return $clientes;
}

// GET list / search
if ($method === 'GET') {
    if ($action === 'list' || $action === '') {
        $estado = $_GET['estado'] ?? 'todos'; // activo, suspendido, todos
        $data = getClientesConEmails($pdo, $estado);
        // Si se abre en navegador (Accept: text/html) mostrar vista bonita, si es fetch/API devolver JSON
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        $isBrowser = strpos($accept, 'text/html') !== false;
        $forceJson = isset($_GET['json']) || isset($_GET['format']) && $_GET['format']==='json';
        if ($isBrowser && !$forceJson) {
            header('Content-Type: text/html; charset=utf-8');
            $rowsHtml = '';
            foreach ($data as $c) {
                $emails = htmlspecialchars(implode(', ', $c['emails'] ?? []));
                $check = $c['check_id'] ? '<span class="badge" style="background:#fef3c7;border-color:#fde68a;color:#92400e">'.htmlspecialchars($c['check_id']).'</span>' : '<span style="color:#94a3b8">—</span>';
                $estadoBadge = ($c['estado']??'activo')==='suspendido' ? '<span class="badge suspendido">Suspendido</span>' : '<span class="badge activo">Activo</span>';
                $rowsHtml .= '<tr><td><strong>'.htmlspecialchars($c['num_cliente']??$c['numCliente']??'—').'</strong></td><td><strong>'.htmlspecialchars(($c['nombre']??'').' '.($c['apellido']??'')).'</strong><br><span style="font-size:11px;color:#64748b">'.htmlspecialchars($c['direccion']??'—').'</span></td><td><span class="badge">'.htmlspecialchars($c['identificacion']??'—').'</span></td><td><span class="badge">'.htmlspecialchars($c['tipo_id']??$c['tipoCliente']??'—').'</span></td><td>'.htmlspecialchars($c['telefono']??'—').'</td><td>'.htmlspecialchars($c['pais']??'—').'</td><td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'.$emails.'">'.$emails.'</td><td>'.$check.'</td><td>'.$estadoBadge.'</td></tr>';
            }
            if ($rowsHtml==='') $rowsHtml='<tr><td colspan="9"><div style="text-align:center;padding:36px;color:#64748b">Sin clientes</div></td></tr>';
            echo '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Clientes - API</title><link rel="stylesheet" href="../css/styles.css"><style>.viewer-wrap{max-width:1280px;margin:0 auto}</style></head><body><div class="card viewer-wrap"><div class="card-header"><div class="header-left"><h1>Vista Clientes - Tiempo Real</h1><p>'.count($data).' clientes · '.htmlspecialchars($estado).' · <a href="?action=list&json=1" style="color:#93c5fd">Ver JSON</a></p></div><a href="../index.html" class="btn-volver" style="text-decoration:none">← Interfaz</a><a href="../viewer.html" class="btn-volver" style="text-decoration:none">Vista completa</a></div><div class="vista" style="display:block"><div class="table-wrap" style="max-height:75vh"><table><thead><tr><th>#</th><th>CLIENTE</th><th>IDENTIFICACIÓN</th><th>TIPO</th><th>TELÉFONO</th><th>PAÍS</th><th>CORREOS</th><th>CHECK_ID</th><th>ESTADO</th></tr></thead><tbody>'.$rowsHtml.'</tbody></table></div></div></div></body></html>';
            exit;
        }
        echo json_encode(['ok'=>true,'data'=>$data]);
        exit;
    }
    if ($action === 'reactivar' && isset($_GET['id'])) {
        $pdo->prepare("UPDATE clientes SET estado='activo' WHERE id=?")->execute([$_GET['id']]);
        echo json_encode(['ok'=>true]); exit;
    }
    if ($action === 'get' && isset($_GET['id'])) {
        $st = $pdo->prepare("SELECT * FROM clientes WHERE id=?");
        $st->execute([$_GET['id']]);
        $c = $st->fetch();
        if (!$c) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'No encontrado']); exit; }
        $st2 = $pdo->prepare("SELECT email FROM cliente_emails WHERE cliente_id=?");
        $st2->execute([$c['id']]);
        $c['emails'] = array_column($st2->fetchAll(), 'email');
        $c['numCliente']=$c['num_cliente']; $c['tipoCliente']=$c['tipo_id']; $c['fechaDesde']=$c['fecha_desde']; $c['fechaNacimiento']=$c['fecha_nacimiento'];
        echo json_encode(['ok'=>true,'data'=>$c]);
        exit;
    }
}

// POST crear (siempre activo - excelentes prácticas)
if ($method === 'POST') {
    $d = $input;
    $err = validarDocumento($d['tipoCliente'] ?? 'CC', $d['identificacion'] ?? '');
    if($err){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>$err]); exit; }
    if (empty($d['tipoCliente']) || empty($d['nombre']) || empty($d['apellido']) || empty($d['emails'])) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Faltan campos obligatorios']); exit; }
    try {
        $pdo->beginTransaction();
        $num = $d['numCliente'] ?: str_pad((string)( $pdo->query("SELECT COUNT(*) FROM clientes")->fetchColumn() + 1 ), 4, '0', STR_PAD_LEFT);
        // Normalizar identificación a mayúsculas para Pasaporte/Otro
        $identNorm = in_array($d['tipoCliente'], ['PA','Otro']) ? strtoupper(trim(preg_replace('/[\s\.\-]/','',$d['identificacion']))) : $d['identificacion'];
        $checkId = trim($d['check_id'] ?? $d['checkId'] ?? '');
        if($checkId==='') $checkId = null;
        $stmt = $pdo->prepare("INSERT INTO clientes (num_cliente,tipo_id,identificacion,nombre,apellido,direccion,telefono,pais,fecha_desde,fecha_nacimiento,estado,check_id) VALUES (?,?,?,?,?,?,?,?,?,?, 'activo', ?)");
        $fechaDesde = !empty($d['fechaDesde']) ? $d['fechaDesde'] : null;
        $fechaNacimiento = !empty($d['fechaNacimiento']) ? $d['fechaNacimiento'] : null;
        $stmt->execute([$num, $d['tipoCliente'], $identNorm, $d['nombre'], $d['apellido'], $d['direccion']?:null, $d['telefono']?:null, $d['pais']?:null, $fechaDesde, $fechaNacimiento, $checkId]);
        $id = $pdo->lastInsertId();
        foreach ($d['emails'] as $email) {
            $pdo->prepare("INSERT INTO cliente_emails (cliente_id,email) VALUES (?,?)")->execute([$id, $email]);
        }
        $pdo->commit();
        echo json_encode(['ok'=>true,'id'=>$id,'numCliente'=>$num]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        if (strpos($e->getMessage(),'Duplicate')) { http_response_code(409); echo json_encode(['ok'=>false,'error'=>'Ya existe esa identificación (incluso suspendido)']); }
        else { http_response_code(500); echo json_encode(['ok'=>false,'error'=>$e->getMessage()]); }
    }
    exit;
}

// PUT actualizar (actualiza y asegura activo)
if ($method === 'PUT') {
    $id = $_GET['id'] ?? $input['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Falta id']); exit; }
    $d = $input;
    $err = validarDocumento($d['tipoCliente'] ?? 'CC', $d['identificacion'] ?? '');
    if($err){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>$err]); exit; }
    try {
        $pdo->beginTransaction();
        $estado = $d['estado'] ?? 'activo';
        $identUpd = in_array($d['tipoCliente'], ['PA','Otro']) ? strtoupper(trim(preg_replace('/[\s\.\-]/','',$d['identificacion']))) : $d['identificacion'];
        $fechaDesde = !empty($d['fechaDesde']) ? $d['fechaDesde'] : null;
        $fechaNacimiento = !empty($d['fechaNacimiento']) ? $d['fechaNacimiento'] : null;
        $checkId = trim($d['check_id'] ?? $d['checkId'] ?? '');
        if($checkId==='') $checkId = null;
        $stmt = $pdo->prepare("UPDATE clientes SET num_cliente=?,tipo_id=?,identificacion=?,nombre=?,apellido=?,direccion=?,telefono=?,pais=?,fecha_desde=?,fecha_nacimiento=?,estado=?,check_id=? WHERE id=?");
        $stmt->execute([$d['numCliente'], $d['tipoCliente'], $identUpd, $d['nombre'], $d['apellido'], $d['direccion'], $d['telefono'], $d['pais'], $fechaDesde, $fechaNacimiento, $estado, $checkId, $id]);
        $pdo->prepare("DELETE FROM cliente_emails WHERE cliente_id=?")->execute([$id]);
        foreach ($d['emails'] as $email) $pdo->prepare("INSERT INTO cliente_emails (cliente_id,email) VALUES (?,?)")->execute([$id,$email]);
        $pdo->commit();
        echo json_encode(['ok'=>true]);
    } catch (PDOException $e) { $pdo->rollBack(); http_response_code(500); echo json_encode(['ok'=>false,'error'=>$e->getMessage()]); }
    exit;
}

// DELETE = SUSPENDER (borrado lógico - excelentes prácticas)
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Falta id']); exit; }
    $pdo->prepare("DELETE FROM clientes WHERE id=?")->execute([$id]);
    $pdo->prepare("DELETE FROM cliente_emails WHERE cliente_id=?")->execute([$id]);
    // Renumerar sin huecos: 0001,0002,0003...
    $pdo->exec("SET @n:=0");
    $pdo->exec("UPDATE clientes SET num_cliente = LPAD((@n:=@n+1), 4, '0') ORDER BY id");
    echo json_encode(['ok'=>true,'msg'=>'Cliente eliminado y numeración reorganizada']);
    exit;
}
// PATCH reactivar
if ($method === 'PATCH') {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Falta id']); exit; }
    $pdo->prepare("UPDATE clientes SET estado='activo' WHERE id=?")->execute([$id]);
    echo json_encode(['ok'=>true,'msg'=>'Cliente reactivado']);
    exit;
}

http_response_code(400);
echo json_encode(['ok'=>false,'error'=>'Acción no válida']);
