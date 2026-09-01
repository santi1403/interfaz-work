// server.js - Alternativa Node a api.php (usa mismo MySQL 127.0.0.1:3306 root/1234)
// Ejecuta: node server.js  -> abre http://localhost:8000
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let mysql;
try { mysql = require('mysql2/promise'); } catch(e) {
  console.log('Falta mysql2. Ejecuta: npm init -y && npm install mysql2');
  process.exit(1);
}

const DB = { host:'127.0.0.1', port:3306, user:'root', password:'1234', database:'gestion_clientes' };

const docConfig = {
  'CC':  {label:'Cédula de Ciudadanía', tipo:'numeric', min:6, max:10},
  'CE':  {label:'Cédula de Extranjería', tipo:'numeric', min:3, max:7},
  'TI':  {label:'Tarjeta de Identidad', tipo:'numeric', min:10, max:11},
  'PA':  {label:'Pasaporte', tipo:'alphanumeric', min:6, max:16},
  'NIT': {label:'NIT', tipo:'numeric', min:9, max:10},
  'PEP': {label:'PEP', tipo:'numeric', min:15, max:15},
  'PPT': {label:'PPT', tipo:'numeric', min:6, max:8},
  'Otro':{label:'Otro', tipo:'alphanumeric', min:3, max:20}
};
function validarDocumento(tipo, num){
  const cfg = docConfig[tipo] || docConfig['CC'];
  let clean = String(num||'').replace(/[\s\.\-]/g,'');
  if(['PA','Otro'].includes(tipo)) clean = clean.toUpperCase();
  if(clean.length < cfg.min || clean.length > cfg.max) return `${cfg.label} debe tener entre ${cfg.min} y ${cfg.max} caracteres (actual: ${clean.length})`;
  const ok = cfg.tipo==='numeric' ? /^[0-9]+$/.test(clean) : /^[a-zA-Z0-9]+$/.test(clean);
  if(!ok) return cfg.tipo==='numeric' ? `Solo números para ${cfg.label}` : `Solo letras y números para ${cfg.label}`;
  return null;
}

const PORT = 8000;
const ROOT = __dirname;

const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.sql':'text/plain'};

async function getPool(){ return mysql.createPool({...DB, waitForConnections:true, connectionLimit:10}); }

async function handleApi(req,res,parsed){
  const pool = await getPool();
  const action = parsed.query.action || '';
  let body='';
  req.on('data',c=>body+=c);
  req.on('end', async ()=>{
    try{
      let input={}; try{ input=JSON.parse(body||'{}')}catch{}
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }

      if(req.method==='GET' && (action==='list' || action==='')){
        const estado=(parsed.query.estado||'todos'); let sql='SELECT * FROM clientes'; let params=[]; if(estado==='activo'||estado==='suspendido'){ sql+=' WHERE estado=?'; params.push(estado); } sql+=' ORDER BY id DESC'; const [rows]=await pool.query(sql,params);
        for(let c of rows){ const [em]=await pool.query('SELECT email FROM cliente_emails WHERE cliente_id=?',[c.id]); c.emails=em.map(x=>x.email); c.numCliente=c.num_cliente; c.tipoCliente=c.tipo_id; c.fechaDesde=c.fecha_desde; c.fechaNacimiento=c.fecha_nacimiento; c.estado=c.estado||'activo'; }
        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true,data:rows}));
      }
      if(req.method==='POST'){
        const d=input; const errN = validarDocumento(d.tipoCliente||'CC', d.identificacion||''); if(errN){ res.writeHead(400,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:false,error:errN})); }
        const identNorm = (['PA','Otro'].includes(d.tipoCliente) ? String(d.identificacion||'').replace(/[\s\.\-]/g,'').toUpperCase() : d.identificacion);
        const checkId = (d.check_id || d.checkId || '').toString().trim() || null;
        const num=d.numCliente||String((await pool.query('SELECT COUNT(*) as c FROM clientes'))[0][0].c+1).padStart(4,'0');
        const [r]=await pool.query("INSERT INTO clientes (num_cliente,tipo_id,identificacion,nombre,apellido,direccion,telefono,pais,fecha_desde,fecha_nacimiento,estado,check_id) VALUES (?,?,?,?,?,?,?,?,?,?, 'activo', ?)",[num,d.tipoCliente,identNorm,d.nombre,d.apellido,d.direccion||null,d.telefono||null,d.pais||null,d.fechaDesde||null,d.fechaNacimiento||null,checkId]);
        for(let e of d.emails||[]) await pool.query('INSERT INTO cliente_emails (cliente_id,email) VALUES (?,?)',[r.insertId,e]);
        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true,id:r.insertId,numCliente:num}));
      }
      if(req.method==='PUT'){
        const id=parsed.query.id||input.id; const d=input;
        const checkId = (d.check_id || d.checkId || '').toString().trim() || null;
        const estadoUpd=d.estado||'activo'; const identUpd=(['PA','Otro'].includes(d.tipoCliente)?String(d.identificacion||'').replace(/[\s\.\-]/g,'').toUpperCase():d.identificacion); await pool.query('UPDATE clientes SET num_cliente=?,tipo_id=?,identificacion=?,nombre=?,apellido=?,direccion=?,telefono=?,pais=?,fecha_desde=?,fecha_nacimiento=?,estado=?,check_id=? WHERE id=?',[d.numCliente,d.tipoCliente,identUpd,d.nombre,d.apellido,d.direccion,d.telefono,d.pais,d.fechaDesde,d.fechaNacimiento,estadoUpd,checkId,id]);
        await pool.query('DELETE FROM cliente_emails WHERE cliente_id=?',[id]);
        for(let e of d.emails||[]) await pool.query('INSERT INTO cliente_emails (cliente_id,email) VALUES (?,?)',[id,e]);
        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true}));
      }
      if(req.method==='DELETE'){
        const id=parsed.query.id; await pool.query('DELETE FROM clientes WHERE id=?',[id]); await pool.query('DELETE FROM cliente_emails WHERE cliente_id=?',[id]);
        await pool.query('SET @n:=0');
        await pool.query("UPDATE clientes SET num_cliente = LPAD((@n:=@n+1), 4, '0') ORDER BY id");
        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true}));
      }
      if(req.method==='PATCH'){
        const id=parsed.query.id; await pool.query("UPDATE clientes SET estado='activo' WHERE id=?",[id]);
        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true}));
      }
      res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:'Acción no válida'}));
    }catch(e){ console.error(e); res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:e.message})); }
  });
}

const server=http.createServer(async (req,res)=>{
  const parsed=url.parse(req.url,true);
  const pathname=parsed.pathname;
  if(pathname.startsWith('/api') || pathname==='/api.php'){
    // compatibilidad con app.js que pide 'api.php?action=list'
    parsed.query=parsed.query||{}; if(pathname==='/api.php') parsed.query.action=parsed.query.action||'list';
    return handleApi(req,res,parsed);
  }
  // servir api.php como alias a /api
  if(pathname==='/api.php'){ parsed.query.action=parsed.query.action||'list'; return handleApi(req,res,parsed); }
  let filePath=path.join(ROOT, pathname==='/'?'index.html':pathname);
  if(!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath,(err,data)=>{
    if(err){ res.writeHead(404); return res.end('Not found'); }
    const ext=path.extname(filePath); res.writeHead(200,{'Content-Type':mime[ext]||'text/plain'}); res.end(data);
  });
});

server.listen(PORT, ()=> console.log(`Servidor Node listo → http://localhost:${PORT}  (MySQL ${DB.host}:${DB.port})`));
