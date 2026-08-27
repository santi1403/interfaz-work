const identificacion = document.getElementById('identificacion');
const errorIdentificacion = document.getElementById('errorIdentificacion');
const hintIdentificacion = document.getElementById('hintIdentificacion');
const emailList = document.getElementById('emailList');
const btnAddEmail = document.getElementById('btnAddEmail');
const clienteForm = document.getElementById('clienteForm');
const clientCountEl = document.getElementById('clientCount');
const pageNumEl = document.getElementById('pageNum');
const btnTeclado = document.getElementById('btnTeclado'); // eliminado - teclado ahora es automático
const btnZoom = document.getElementById('btnZoom');
const appCard = document.getElementById('appCard');

const API_URL = 'api.php';
let usandoAPI = false;

async function apiList() {
  try {
    const r = await fetch(API_URL + '?action=list');
    if (!r.ok) throw new Error('no api');
    const j = await r.json();
    if (j.ok) return j.data;
  } catch(e) {}
  return null;
}
async function apiCrear(datos) {
  const r = await fetch(API_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(datos)});
  return r.json();
}
async function apiActualizar(id, datos) {
  const r = await fetch(API_URL + '?id=' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(datos)});
  return r.json();
}
async function apiBorrar(id) {
  const r = await fetch(API_URL + '?id=' + id, {method:'DELETE'});
  return r.json();
}
async function apiReactivar(id){
  const r = await fetch(API_URL + '?id=' + id, {method:'PATCH'});
  return r.json();
}
async function sincronizarDesdeAPI() {
  const data = await apiList();
  if (data) {
    usandoAPI = true;
    clientes = data;
    localStorage.setItem('clientes_proto', JSON.stringify(clientes));
    actualizarContadores();
    renderBuscar(); renderActualizar(); renderSeleccionar();
    toast('Conectado a MySQL — datos reales cargados','success');
  } else {
    toast('Modo local (sin servidor) — inicia php -S localhost:8000 para guardar en MySQL','info');
  }
}


let clientes = JSON.parse(localStorage.getItem('clientes_proto') || '[]');
// demo si vacío
if(clientes.length===0){
  clientes = [
    {id:1,numCliente:'0001',tipoCliente:'CC',identificacion:'0102030405',nombre:'María',apellido:'González',direccion:'Av. Amazonas 123',telefono:'0991234567',pais:'Ecuador',fechaDesde:'2024-01-15',fechaNacimiento:'1990-05-20',emails:['maria.gonzalez@mail.com']},
    {id:2,numCliente:'0002',tipoCliente:'CE',identificacion:'1723456789',nombre:'Carlos',apellido:'Ruiz',direccion:'Calle 10 # 20-30',telefono:'0987654321',pais:'Colombia',fechaDesde:'2023-11-02',fechaNacimiento:'1985-09-10',emails:['carlos.ruiz@mail.com','c.ruiz@empresa.com']},
    {id:3,numCliente:'0003',tipoCliente:'NIT',identificacion:'0933445566',nombre:'Empresa',apellido:'Soluciones SA',direccion:'Parque Empresarial',telefono:'022345678',pais:'Perú',fechaDesde:'2022-06-01',fechaNacimiento:'2000-01-01',emails:['contacto@soluciones.pe']},
  ];
  localStorage.setItem('clientes_proto', JSON.stringify(clientes));
}
// Migración tipos antiguos -> nuevos IDs
const mapaTipos = {vip:'CC', natural:'CC', juridica:'NIT', corporativo:'NIT'};
let migrado=false;
clientes.forEach(c=>{ if(mapaTipos[c.tipoCliente]){ c.tipoCliente=mapaTipos[c.tipoCliente]; migrado=true; } });
if(migrado) localStorage.setItem('clientes_proto', JSON.stringify(clientes));
// Asegurar estado por defecto para buenas prácticas
clientes.forEach(c=>{ if(!c.estado) c.estado='activo'; });
localStorage.setItem('clientes_proto', JSON.stringify(clientes));
let currentPage = 1;
let lastFocused = null;
let vistaActual = 'form';
let editandoId = null;
let seleccionadoId = JSON.parse(localStorage.getItem('seleccionado_proto') || 'null');
let paginaBuscar=1, paginaActualizar=1;
const porPagina=5;

clientCountEl.textContent = clientes.length;

// --- FOCO ---
const focusableSelector = 'input, select, textarea';
document.addEventListener('focusin', (e)=>{
  if(e.target.matches(focusableSelector)) {
    lastFocused = e.target;
    // Auto-mostrar teclado libre en cualquier campo de texto (compatible con Windows)
    const tag = e.target.tagName.toLowerCase();
    const type = (e.target.type||'').toLowerCase();
    const esTexto = tag==='textarea' || (tag==='input' && !['checkbox','radio','range','color','file'].includes(type));
    if(esTexto){
      toggleKeyboard(true);
      // Intentar mostrar teclado nativo de Windows si existe API (para compatibilidad)
      if(navigator.virtualKeyboard && navigator.virtualKeyboard.show) try{ navigator.virtualKeyboard.show(); }catch{}
    }
  }
});
// Ocultar al salir de todos los inputs (opcional, se puede cerrar con X)
document.addEventListener('focusout', (e)=>{
  // no ocultar inmediatamente para poder clickear el teclado, solo si no hay foco en otro input
  setTimeout(()=>{
    const active = document.activeElement;
    if(!active || !active.matches('input, textarea')) {
      // mantener abierto si el usuario está interactuando con el teclado
      // se cierra solo con el botón Cerrar
    }
  }, 150);
});
window.addEventListener('load', ()=>{
  if(!lastFocused) lastFocused = document.getElementById('nombre');
  actualizarContadores();
  if(seleccionadoId) mostrarBannerSeleccion();
  sincronizarDesdeAPI();
});

// --- CONFIGURACIÓN DINÁMICA POR TIPO ID (excelentes prácticas) ---
const docConfig = {
  'CC':  { label:'Cédula de Ciudadanía', tipo:'numeric', min:6, max:10 },
  'CE':  { label:'Cédula de Extranjería', tipo:'numeric', min:3, max:7 },
  'TI':  { label:'Tarjeta de Identidad', tipo:'numeric', min:10, max:11 },
  'PA':  { label:'Pasaporte', tipo:'alphanumeric', min:6, max:16 },
  'NIT': { label:'NIT', tipo:'numeric', min:9, max:10 },
  'PEP': { label:'PEP', tipo:'numeric', min:15, max:15 },
  'PPT': { label:'PPT', tipo:'numeric', min:6, max:8 },
  'Otro':{ label:'Otro', tipo:'alphanumeric', min:3, max:20 }
};
function getDocCfg(){
  const tipo = document.getElementById('tipoCliente')?.value || 'CC';
  return docConfig[tipo] || docConfig['CC'];
}
function actualizarAtributosDocumento(){
  const cfg = getDocCfg();
  identificacion.setAttribute('minlength', cfg.min);
  identificacion.setAttribute('maxlength', cfg.max);
  identificacion.setAttribute('inputmode', cfg.tipo==='numeric' ? 'numeric' : 'text');
  identificacion.setAttribute('autocomplete', 'off');
  // Actualizar hint dinámico
  hintIdentificacion.textContent = `${cfg.label}: ${cfg.tipo==='numeric'?'solo números':'alfanumérico'} · ${cfg.min} a ${cfg.max} caracteres`;
  hintIdentificacion.style.display='block';
  hintIdentificacion.style.color='';
  // Revalidar si ya hay valor
  if(identificacion.value.trim()!=='') validarIdentificacion();
}
function sanitizarDocumento(v, tipo){
  // Quitar espacios, puntos y guiones
  let s = v.replace(/[\s\.\-]/g,'');
  if(tipo==='numeric') s = s.replace(/[^0-9]/g,'');
  else s = s.replace(/[^a-zA-Z0-9]/g,'');
  return s;
}
// --- VALIDACIÓN DINÁMICA ---
function validarIdentificacion(){
  const cfg = getDocCfg();
  let val = identificacion.value.trim();
  // Sanitizar ya debería estar hecho, pero por si acaso
  if(val === ''){
    identificacion.classList.remove('error','success');
    errorIdentificacion.classList.remove('show');
    hintIdentificacion.style.display='block';
    hintIdentificacion.style.color='';
    hintIdentificacion.textContent = `${cfg.label}: ${cfg.tipo==='numeric'?'solo números':'alfanumérico'} · ${cfg.min} a ${cfg.max} caracteres`;
    return false;
  }
  const esNumerico = cfg.tipo==='numeric';
  const regex = esNumerico ? /^[0-9]+$/ : /^[a-zA-Z0-9]+$/;
  if(!regex.test(val)){
    identificacion.classList.add('error');
    identificacion.classList.remove('success');
    errorIdentificacion.textContent = esNumerico ? `Solo se permiten números para ${cfg.label}` : `Solo letras y números para ${cfg.label}`;
    errorIdentificacion.classList.add('show');
    hintIdentificacion.style.display='none';
    return false;
  }
  if(val.length < cfg.min || val.length > cfg.max){
    identificacion.classList.add('error');
    identificacion.classList.remove('success');
    if(cfg.min===cfg.max) errorIdentificacion.textContent = `${cfg.label} debe tener exactamente ${cfg.min} caracteres (${val.length}/${cfg.max})`;
    else errorIdentificacion.textContent = `${cfg.label} debe tener entre ${cfg.min} y ${cfg.max} caracteres (${val.length}/${cfg.max})`;
    errorIdentificacion.classList.add('show');
    hintIdentificacion.style.display='none';
    return false;
  } else {
    identificacion.classList.remove('error');
    identificacion.classList.add('success');
    errorIdentificacion.classList.remove('show');
    hintIdentificacion.style.display='block';
    hintIdentificacion.textContent='✓ Identificación válida';
    hintIdentificacion.style.color='#16a34a';
    return true;
  }
}
// Sanitización y restricción dinámica
identificacion.addEventListener('input', (e)=>{
  const cfg = getDocCfg();
  let v = sanitizarDocumento(e.target.value, cfg.tipo);
  if(v.length > cfg.max) v = v.slice(0, cfg.max);
  if(v !== e.target.value) e.target.value = v;
  validarIdentificacion();
});
identificacion.addEventListener('paste', (e)=>{
  e.preventDefault();
  const cfg = getDocCfg();
  const text = (e.clipboardData.getData('text')||'');
  let v = sanitizarDocumento(text, cfg.tipo).slice(0, cfg.max);
  // Insertar en posición cursor
  const start = identificacion.selectionStart||0, end=identificacion.selectionEnd||0;
  const cur = identificacion.value;
  let nuevo = (cur.slice(0,start) + v + cur.slice(end));
  nuevo = sanitizarDocumento(nuevo, cfg.tipo).slice(0, cfg.max);
  identificacion.value = nuevo;
  identificacion.selectionStart = identificacion.selectionEnd = start + v.length;
  validarIdentificacion();
});
identificacion.addEventListener('keypress', (e)=>{
  const cfg = getDocCfg();
  if(cfg.tipo==='numeric' && !/[0-9]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)){
    // Permitir control keys
    if(e.key.length===1 && !/[0-9]/.test(e.key)) e.preventDefault();
  }
});
identificacion.addEventListener('blur', validarIdentificacion);
identificacion.addEventListener('focus', ()=> lastFocused = identificacion);
// Cambiar tipo -> actualizar atributos y revalidar
document.getElementById('tipoCliente')?.addEventListener('change', ()=>{
  actualizarAtributosDocumento();
  if(identificacion.value.trim()!=='' ) validarIdentificacion();
});
// Inicializar atributos al cargar
document.addEventListener('DOMContentLoaded', actualizarAtributosDocumento);
window.addEventListener('load', ()=> setTimeout(actualizarAtributosDocumento, 100));

// --- AUTOCOMPLETADO POR IDENTIFICACIÓN (negocio: mesero solo pone CC/TI y número) ---
function autocompletarPorIdentificacion(){
  const ident = identificacion.value.trim();
  const tipo = document.getElementById('tipoCliente').value;
  const cfgAc = getDocCfg();
  if(ident.length < cfgAc.min || ident.length > cfgAc.max) return;
  // Buscar primero por tipo+identificacion, si no solo por identificacion
  let c = null;
  if(tipo) c = clientes.find(x=> x.identificacion===ident && x.tipoCliente===tipo);
  if(!c) c = clientes.find(x=> x.identificacion===ident);
  if(c){
    // Llenar todo automático sin clonar
    document.getElementById('tipoCliente').value = c.tipoCliente||tipo;
    document.getElementById('nombre').value = c.nombre||'';
    document.getElementById('apellido').value = c.apellido||'';
    document.getElementById('direccion').value = c.direccion||'';
    document.getElementById('telefono').value = c.telefono||'';
    document.getElementById('pais').value = c.pais||'';
    const fd=document.getElementById('fechaDesde'); if(fd) fd.value=c.fechaDesde||'';
    const fn=document.getElementById('fechaNacimiento'); if(fn) fn.value=c.fechaNacimiento||'';
    // Emails
    emailList.innerHTML='';
    if(c.emails && c.emails.length){
      c.emails.forEach((mail,i)=>{
        const row=document.createElement('div'); row.className='email-row';
        if(i===0) row.innerHTML=`<input type="email" class="email-input" value="${mail}"><button type="button" class="btn-add-email" id="btnAddEmailNew">+ Agregar</button>`;
        else row.innerHTML=`<input type="email" class="email-input" value="${mail}"><button type="button" class="btn-remove-email">✕</button>`;
        emailList.appendChild(row);
      });
      emailList.querySelectorAll('.btn-remove-email').forEach(btn=> btn.addEventListener('click', (e)=>{ e.target.closest('.email-row').remove(); }));
      const addBtn=document.getElementById('btnAddEmailNew');
      if(addBtn) addBtn.addEventListener('click', ()=>{ addEmailField(); });
      emailList.querySelectorAll('.email-input').forEach(inp=> inp.addEventListener('focus', e=> lastFocused=e.target));
    }
    seleccionadoId = c.id;
    editandoId = c.id;
    const btnG=document.querySelector('[data-action="guardar"]');
    if(btnG){ btnG.innerHTML='<span class="icon">💾</span>Guardar Cambios'; btnG.classList.add('accent'); }
    validarIdentificacion();
    toast(`✓ Cliente ${c.nombre} ${c.apellido} autocompletado`, 'success');
  }
}
identificacion.addEventListener('input', ()=>{
  const cfgA = getDocCfg(); const l=identificacion.value.trim().length; if(l>=cfgA.min && l<=cfgA.max) autocompletarPorIdentificacion();
});
document.getElementById('tipoCliente')?.addEventListener('change', ()=>{
  const cfgA = getDocCfg(); const l=identificacion.value.trim().length; if(l>=cfgA.min && l<=cfgA.max) autocompletarPorIdentificacion();
});

// --- EMAILS DINÁMICOS ---
function addEmailField(value=''){
  const row = document.createElement('div');
  row.className='email-row';
  row.innerHTML = `<input type="email" class="email-input" placeholder="correo@ejemplo.com" value="${value}"><button type="button" class="btn-remove-email" title="Eliminar">✕</button>`;
  const input = row.querySelector('input');
  const btnRemove = row.querySelector('button');
  input.addEventListener('focus', ()=> lastFocused = input);
  btnRemove.addEventListener('click', ()=>{
    row.remove();
    toast('Correo eliminado','info');
    if(emailList.querySelectorAll('.email-input').length===0) addEmailField();
  });
  emailList.appendChild(row);
  input.focus();
  lastFocused = input;
}
btnAddEmail.addEventListener('click', ()=>{ addEmailField(); toast('Campo de correo agregado','info'); });
document.querySelector('.email-input').addEventListener('focus', (e)=> lastFocused=e.target);

// --- TECLADO VIRTUAL LIBRE AUTO-SHOW (sin botón, sale al tocar campo) ---
// --- TECLADO VIRTUAL LIBRE AUTO-SHOW (sin botón, sale al tocar campo) ---
const keyboardWrapper = document.getElementById('keyboardWrapper');
const keyboardEl = document.getElementById('keyboard');
const btnCerrarTeclado = document.getElementById('btnCerrarTeclado');
const keysLayout = [
  ['1','2','3','4','5','6','7','8','9','0','⌫'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l','ñ'],
  ['z','x','c','v','b','n','m','@','.','_','-'],
  ['Espacio']
];
function buildKeyboard(){
  if(!keyboardEl) return;
  keyboardEl.innerHTML='';
  keysLayout.forEach(row=>{
    const r=document.createElement('div'); r.className='k-row';
    row.forEach(k=>{
      const btn=document.createElement('button'); btn.type='button'; btn.className='k-key';
      if(k==='⌫' || k==='Enter') btn.classList.add('action');
      if(k==='Espacio'){ btn.classList.add('extra-wide'); btn.textContent='Espacio'; } else btn.textContent=k;
      if(k==='Espacio') btn.dataset.key=' '; else btn.dataset.key=k;
      if(k==='⌫') btn.classList.add('wide');
      if(k==='Enter') btn.classList.add('wide');
      btn.addEventListener('mousedown', e=> e.preventDefault());
      btn.addEventListener('click', ()=> handleVirtualKey(k));
      r.appendChild(btn);
    });
    keyboardEl.appendChild(r);
  });
}
function handleVirtualKey(key){
  // Teclas especiales: no deben escribirse como texto
  if(key==='Tab'){
    const inputs=[...document.querySelectorAll('input, select, textarea')].filter(x=>!x.disabled&&x.type!=='hidden');
    const idx=inputs.indexOf(lastFocused);
    if(idx>=0 && idx<inputs.length-1) inputs[idx+1].focus();
    return;
  }
  if(key==='Enter'){ if(lastFocused) lastFocused.blur(); toggleKeyboard(false); return; }
  if(key==='Esc'){ if(lastFocused){ lastFocused.value=''; lastFocused.dispatchEvent(new Event('input',{bubbles:true})); } return; }

  if(!lastFocused || lastFocused.tagName==='SELECT'){
    lastFocused = document.querySelector('input:not([type="hidden"])') || lastFocused;
    if(!lastFocused) return;
  }
  if(lastFocused.tagName==='SELECT'){ toast('Selecciona un campo de texto primero','info'); return; }
  const el=lastFocused;
  const start=el.selectionStart??el.value.length;
  const end=el.selectionEnd??el.value.length;
  if(key==='⌫'){
    if(start===end && start>0){ el.value=el.value.slice(0,start-1)+el.value.slice(end); el.selectionStart=el.selectionEnd=start-1; }
    else if(start!==end){ el.value=el.value.slice(0,start)+el.value.slice(end); el.selectionStart=el.selectionEnd=start; }
  } else if(key==='Enter'){ el.blur(); }
  else if(key==='Espacio'){ el.value=el.value.slice(0,start)+' '+el.value.slice(end); el.selectionStart=el.selectionEnd=start+1; }
  else {
    const char=key; const max=el.getAttribute('maxlength');
    if(max && el.value.length>=parseInt(max) && start===end){ toast('Límite alcanzado','error'); return; }
    el.value=el.value.slice(0,start)+char+el.value.slice(end); el.selectionStart=el.selectionEnd=start+1;
  }
  el.focus(); el.dispatchEvent(new Event('input',{bubbles:true}));
}
if(keyboardEl) buildKeyboard();
function toggleKeyboard(show){
  if(!keyboardWrapper) return;
  const shouldShow = show!==undefined ? show : keyboardWrapper.classList.contains('hidden');
  if(shouldShow){ keyboardWrapper.classList.remove('hidden'); }
  else { keyboardWrapper.classList.add('hidden'); }
}
if(btnCerrarTeclado) btnCerrarTeclado.addEventListener('click', ()=> toggleKeyboard(false));
// Auto-mostrar al tocar cualquier campo de texto (sin botón)
document.addEventListener('focusin', (e)=>{
  const el=e.target;
  if(el.matches && el.matches('input, textarea')){
    const type=(el.type||'').toLowerCase();
    const esTexto = el.tagName.toLowerCase()==='textarea' || (el.tagName.toLowerCase()==='input' && !['checkbox','radio','range','color','file','button','submit'].includes(type));
    if(esTexto){
      lastFocused=el;
      toggleKeyboard(true);
    }
  }
});
// Arrastrable
(function(){
  const wrapper=document.getElementById('keyboardWrapper');
  const header=document.querySelector('.keyboard-header');
  if(!wrapper||!header) return;
  let dragging=false,sx,sy,ol,ot;
  function toFixed(){ const r=wrapper.getBoundingClientRect(); wrapper.style.left=r.left+'px'; wrapper.style.top=r.top+'px'; wrapper.style.right='auto'; wrapper.style.bottom='auto'; wrapper.style.transform='none'; }
  header.addEventListener('mousedown',e=>{
    if(e.target.tagName==='BUTTON') return;
    dragging=true; toFixed(); sx=e.clientX; sy=e.clientY; const r=wrapper.getBoundingClientRect(); ol=r.left; ot=r.top; document.body.style.userSelect='none'; e.preventDefault();
  });
  window.addEventListener('mousemove',e=>{ if(!dragging) return; wrapper.style.left=(ol+e.clientX-sx)+'px'; wrapper.style.top=(ot+e.clientY-sy)+'px'; });
  window.addEventListener('mouseup',()=>{ dragging=false; document.body.style.userSelect=''; });
  header.addEventListener('touchstart',e=>{
    if(e.target.tagName==='BUTTON') return;
    dragging=true; toFixed(); sx=e.touches[0].clientX; sy=e.touches[0].clientY; const r=wrapper.getBoundingClientRect(); ol=r.left; ot=r.top; e.preventDefault();
  },{passive:false});
  window.addEventListener('touchmove',e=>{ if(!dragging) return; wrapper.style.left=(ol+e.touches[0].clientX-sx)+'px'; wrapper.style.top=(ot+e.touches[0].clientY-sy)+'px'; e.preventDefault(); },{passive:false});
  window.addEventListener('touchend',()=> dragging=false);
})();


// --- TOAST ---
function toast(msg, type='info'){
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className=`toast ${type}`;
  const icons={success:'✓',error:'✕',info:'ℹ'};
  t.innerHTML=`<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(20px)'; setTimeout(()=>t.remove(),250)},2800);
}

// --- MODAL ---
function showModal({title, text, confirmText='Confirmar', confirmClass='danger', onConfirm}){
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalText').textContent=text;
  const btnConfirm = document.getElementById('modalConfirm');
  btnConfirm.textContent=confirmText;
  btnConfirm.className='btn-modal '+confirmClass;
  overlay.classList.remove('hidden');
  const close = ()=> overlay.classList.add('hidden');
  document.getElementById('modalCancel').onclick=close;
  overlay.onclick=(e)=>{ if(e.target===overlay) close(); };
  btnConfirm.onclick=()=>{ close(); onConfirm&&onConfirm(); };
}

// --- HELPERS ---
function actualizarContadores(){
  clientCountEl.textContent = clientes.length;
}
function guardarStorage(){
  localStorage.setItem('clientes_proto', JSON.stringify(clientes));
  localStorage.setItem('seleccionado_proto', JSON.stringify(seleccionadoId));
  actualizarContadores();
}
function recolectarDatos(){
  const emails = [...emailList.querySelectorAll('.email-input')].map(i=>i.value.trim()).filter(Boolean);
  return {
    numCliente: document.getElementById('numCliente').value.trim(),
    tipoCliente: document.getElementById('tipoCliente').value,
    identificacion: identificacion.value.trim(),
    nombre: document.getElementById('nombre').value.trim(),
    apellido: document.getElementById('apellido').value.trim(),
    direccion: document.getElementById('direccion').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    pais: document.getElementById('pais')?.value||'',
    fechaDesde: document.getElementById('fechaDesde')?.value||'',
    fechaNacimiento: document.getElementById('fechaNacimiento')?.value||'',
    emails
  };
}
function validarFormulario(){
  const d = recolectarDatos();
  if(!d.tipoCliente){ toast('Selecciona el Tipo de Identificación (CC, CE, Pasaporte...)','error'); return false; }
  if(!validarIdentificacion()){ toast('Corrige la Identificación (10 dígitos)','error'); identificacion.focus(); return false; }
  if(!d.nombre || !d.apellido){ toast('Nombre y Apellido son obligatorios','error'); return false; }
  if(d.emails.length===0){ toast('Agrega al menos un correo válido','error'); return false; }
  const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for(let e of d.emails){ if(!emailRegex.test(e)){ toast(`Correo inválido: ${e}`,'error'); return false; } }
  return true;
}
function limpiarCampos(silent=false){
  clienteForm.reset();
  emailList.innerHTML=`<div class="email-row"><input type="email" class="email-input" placeholder="correo@ejemplo.com" required><button type="button" class="btn-add-email" id="btnAddEmailNew">+ Agregar</button></div>`;
  document.getElementById('btnAddEmailNew').addEventListener('click', ()=>{ addEmailField(); toast('Campo de correo agregado','info'); });
  document.querySelector('.email-input').addEventListener('focus', e=> lastFocused=e.target);
  identificacion.classList.remove('error','success');
  errorIdentificacion.classList.remove('show');
  hintIdentificacion.textContent='Solo números · 10 caracteres exactos';
  hintIdentificacion.style.color='';
  hintIdentificacion.style.display='block';
  document.getElementById('numCliente').value='';
  editandoId=null;
  const bG=document.querySelector('[data-action="guardar"]'); if(bG){ bG.innerHTML='<span class="icon">💾</span>Guardar'; bG.classList.remove('accent'); }
  if(!silent) toast('Campos limpiados','info');
}
function cargarEnFormulario(c){
  document.getElementById('numCliente').value=c.numCliente||'';
  document.getElementById('tipoCliente').value=c.tipoCliente||'';
  identificacion.value=c.identificacion||'';
  document.getElementById('nombre').value=c.nombre||'';
  document.getElementById('apellido').value=c.apellido||'';
  document.getElementById('direccion').value=c.direccion||'';
  document.getElementById('telefono').value=c.telefono||'';
  document.getElementById('pais').value=c.pais||'';
  const fd=document.getElementById('fechaDesde'); if(fd) fd.value=c.fechaDesde||'';
  const fn=document.getElementById('fechaNacimiento'); if(fn) fn.value=c.fechaNacimiento||'';
  emailList.innerHTML='';
  if(c.emails && c.emails.length){
    c.emails.forEach((mail,i)=>{
      const row=document.createElement('div'); row.className='email-row';
      if(i===0) row.innerHTML=`<input type="email" class="email-input" placeholder="correo@ejemplo.com" value="${mail}"><button type="button" class="btn-add-email" id="btnAddEmailNew">+ Agregar</button>`;
      else row.innerHTML=`<input type="email" class="email-input" value="${mail}"><button type="button" class="btn-remove-email">✕</button>`;
      emailList.appendChild(row);
    });
    // rebind removes
    emailList.querySelectorAll('.btn-remove-email').forEach(btn=> btn.addEventListener('click', (e)=>{ e.target.closest('.email-row').remove(); toast('Correo eliminado','info'); }));
    const addBtn=document.getElementById('btnAddEmailNew');
    if(addBtn) addBtn.addEventListener('click', ()=>{ addEmailField(); toast('Campo agregado','info'); });
    emailList.querySelectorAll('.email-input').forEach(inp=> inp.addEventListener('focus', e=> lastFocused=e.target));
  } else addEmailField();
  validarIdentificacion();
  showVista('form');
  toast(`Cliente ${c.nombre} cargado en formulario`,'info');
}

// --- VISTAS NAVEGACIÓN ---
function showVista(nombre){
  vistaActual=nombre;
  document.getElementById('cardBodyOriginal').style.display = (nombre==='form' ? 'grid' : 'none');
  document.getElementById('vistaBuscar').classList.toggle('hidden', nombre!=='buscar');
  document.getElementById('vistaActualizar').classList.toggle('hidden', nombre!=='actualizar');

  if(nombre==='buscar') renderBuscar();
  if(nombre==='actualizar') renderActualizar();
  if(nombre==='seleccionar') renderSeleccionar();
  window.scrollTo({top:0,behavior:'smooth'});
  // actualizar paginación footer
  pageNumEl.textContent = nombre==='form' ? currentPage : (nombre==='buscar'?paginaBuscar:paginaActualizar);
}

function getFiltered(){
  const q = (document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  const pais = document.getElementById('filterPais')?.value||'';
  const tipo = document.getElementById('filterTipo')?.value||'';
  const estadoFiltro = document.getElementById('filterEstado')?.value||'activo';
  return clientes.filter(c=>{
    const matchesQ = !q || `${c.nombre} ${c.apellido} ${c.identificacion} ${c.emails?.join(' ')}`.toLowerCase().includes(q);
    const matchesPais = !pais || c.pais===pais;
    const matchesTipo = !tipo || c.tipoCliente===tipo;
    const matchesEstado = estadoFiltro==='todos' || (c.estado||'activo')===estadoFiltro;
    return matchesQ && matchesPais && matchesTipo && matchesEstado;
  });
}

function renderBuscar(){
  const tbody=document.getElementById('tbodyBuscar');
  const filtered=getFiltered();
  const totalPag=Math.max(1, Math.ceil(filtered.length/porPagina));
  if(paginaBuscar>totalPag) paginaBuscar=totalPag;
  const start=(paginaBuscar-1)*porPagina;
  const slice=filtered.slice(start,start+porPagina);
  document.getElementById('buscarPage').textContent=paginaBuscar;
  document.getElementById('buscarInfo').textContent=`${filtered.length} resultados · ${clientes.length} totales`;
  if(slice.length===0){
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state"><div class="big">🔍</div><strong>Sin resultados</strong><br>Prueba con otro nombre o identificación</div></td></tr>`;
    return;
  }
  tbody.innerHTML=slice.map((c,i)=>`
    <tr class="${c.id===seleccionadoId?'selected':''}">
      <td><strong>#${String(c.numCliente|| (start+i+1)).padStart(4,'0')}</strong></td>
      <td><strong>${c.nombre} ${c.apellido}</strong> <span class="badge ${c.estado==='suspendido'?'eliminado':'activo'}">${c.estado==='suspendido'?'⊘ Suspendido':'✓ Activo'}</span><br><span style="color:var(--muted);font-size:11px">${c.direccion||'—'}</span></td>
      <td><span class="badge">${c.identificacion}</span></td>
      <td><span class="badge ${c.tipoCliente==='NIT'?'juridica':c.tipoCliente==='CC'||c.tipoCliente==='CE'?'vip':''}">${c.tipoCliente||'—'}</span></td>
      <td>${c.telefono||'—'}</td>
      <td>${c.pais||'—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(c.emails||[]).join(', ')}">${(c.emails||[])[0]||'—'} ${(c.emails||[]).length>1?` <span style="color:var(--accent)">+${c.emails.length-1}</span>`:''}</td>
      <td><div class="actions-cell">
        <button class="btn-mini primary" onclick="cargarEnFormulario(clientes.find(x=>x.id===${c.id}))">👁 Ver</button>
      </div></td>
    </tr>
  `).join('');
}

function renderActualizar(){
  const tbody=document.getElementById('tbodyActualizar');
  const totalPag=Math.max(1, Math.ceil(clientes.length/porPagina));
  if(paginaActualizar>totalPag) paginaActualizar=totalPag;
  const start=(paginaActualizar-1)*porPagina;
  const slice=clientes.slice(start,start+porPagina);
  document.getElementById('actualizarPage').textContent=paginaActualizar;
  document.getElementById('actualizarInfo').textContent=`${clientes.length} clientes · Página ${paginaActualizar}/${totalPag}`;
  if(slice.length===0){
    tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state"><div class="big">📋</div>No hay clientes aún. Crea uno con el formulario.</div></td></tr>`;
    return;
  }
  tbody.innerHTML=slice.map(c=>`
    <tr class="${c.id===editandoId?'selected':''}">
      <td><strong>${c.numCliente||'—'}</strong></td>
      <td><strong>${c.nombre} ${c.apellido}</strong> <span class="badge ${c.estado==='suspendido'?'eliminado':'activo'}">${c.estado==='suspendido'?'Suspendido':'Activo'}</span><br><span style="font-size:11px;color:var(--muted)">${c.identificacion}</span></td>
      <td><span class="badge">${c.identificacion}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.direccion||'—'}</td>
      <td>${c.pais||'—'}</td>
      <td><div class="actions-cell">
        <button class="btn-mini primary" onclick="iniciarEdicion(${c.id})">✎ Editar</button>
        ${c.estado==='suspendido'?`<button class="btn-mini primary" onclick="reactivarCliente(${c.id})">↻ Reactivar</button>`:`<button class="btn-mini danger" onclick="confirmarBorrar(${c.id})">🗑 Delete</button>`}
      </div></td>
    </tr>
  `).join('');
}

function renderSeleccionar(){
  const tbody=document.getElementById('tbodySeleccionar');
  const q=(document.getElementById('seleccionarSearch')?.value||'').toLowerCase().trim();
  let list=clientes;
  if(q) list=clientes.filter(c=> `${c.nombre} ${c.apellido} ${c.identificacion}`.toLowerCase().includes(q));
  mostrarBannerSeleccion();
  if(list.length===0){
    tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state">Sin clientes que coincidan</div></td></tr>`;
    return;
  }
  tbody.innerHTML=list.map(c=>`
    <tr class="${c.id===seleccionadoId?'selected':''}">
      <td><input type="radio" name="sel" ${c.id===seleccionadoId?'checked':''} onchange="seleccionarCliente(${c.id})"></td>
      <td>${c.numCliente||'—'}</td>
      <td><strong>${c.nombre} ${c.apellido}</strong></td>
      <td><span class="badge">${c.identificacion}</span></td>
      <td><span class="badge">${c.tipoCliente}</span></td>
      <td><button class="btn-mini ${c.id===seleccionadoId?'primary':''}" onclick="seleccionarCliente(${c.id})">${c.id===seleccionadoId?'✓ Seleccionado':'Seleccionar'}</button></td>
    </tr>
  `).join('');
}
function mostrarBannerSeleccion(){
  const banner=document.getElementById('bannerSeleccion');
  if(!seleccionadoId){ banner.style.display='none'; return; }
  const c=clientes.find(x=>x.id===seleccionadoId);
  if(!c){ banner.style.display='none'; return; }
  banner.style.display='flex';
  banner.className='selected-banner';
  banner.innerHTML=`<span>✓ Seleccionado: <strong>${c.nombre} ${c.apellido}</strong> · ${c.identificacion} · ${c.pais||''}</span><div style="display:flex;gap:8px"><button class="btn-mini" onclick="cargarEnFormulario(clientes.find(x=>x.id===${c.id}))">👁 Ver en formulario</button><button class="btn-mini" onclick="deseleccionar()">Quitar</button></div>`;
}
function seleccionarCliente(id){
  seleccionadoId=id;
  guardarStorage();
  renderBuscar(); renderSeleccionar(); renderActualizar();
  mostrarBannerSeleccion();
  const c=clientes.find(x=>x.id===id);
  toast(`Cliente seleccionado: ${c.nombre} ${c.apellido}`,'success');
}
function deseleccionar(){ seleccionadoId=null; guardarStorage(); renderSeleccionar(); renderBuscar(); document.getElementById('bannerSeleccion').style.display='none'; toast('Selección limpiada','info'); }

let detalleId = null;
function verDetalle(id){
  detalleId = id;
  const c = clientes.find(x=>x.id===id);
  if(!c) return;
  const cont = document.getElementById('detalleContenido');
  cont.innerHTML = `
    <div><strong># Cliente:</strong> ${c.numCliente||'—'}</div>
    <div><strong>Estado:</strong> <span class="badge ${c.estado==='suspendido'?'eliminado':'activo'}">${c.estado==='suspendido'?'⊘ Suspendido':'✓ Activo'}</span></div>
    <div><strong>Tipo ID:</strong> <span class="badge">${c.tipoCliente||'—'}</span></div>
    <div><strong>Identificación:</strong> <span class="badge">${c.identificacion||'—'}</span></div>
    <div><strong>Nombre:</strong> ${c.nombre||'—'}</div>
    <div><strong>Apellido:</strong> ${c.apellido||'—'}</div>
    <div style="grid-column:1 / -1"><strong>Dirección:</strong> ${c.direccion||'—'}</div>
    <div><strong>Teléfono:</strong> ${c.telefono||'—'}</div>
    <div><strong>País:</strong> ${c.pais||'—'}</div>
    <div><strong>Fecha Desde:</strong> ${c.fechaDesde ? c.fechaDesde.split('-').reverse().join('/') : '—'}</div>
    <div><strong>Fecha Nacimiento:</strong> ${c.fechaNacimiento ? c.fechaNacimiento.split('-').reverse().join('/') : '—'}</div>
    <div style="grid-column:1 / -1"><strong>Correos:</strong> ${(c.emails||[]).join(', ')||'—'}</div>
  `;
  document.getElementById('detalleCliente').classList.remove('hidden');
  document.getElementById('detalleCliente').scrollIntoView({behavior:'smooth', block:'nearest'});
}
function cerrarDetalle(){ document.getElementById('detalleCliente').classList.add('hidden'); detalleId=null; }
function editarDesdeDetalle(){ if(detalleId) iniciarEdicion(detalleId); }

async function reactivarCliente(id){
  if(usandoAPI){ const res=await apiReactivar(id); if(!res.ok){ toast(res.error||'Error al reactivar','error'); return; } await sincronizarDesdeAPI(); } else { const c=clientes.find(x=>x.id===id); if(c) c.estado='activo'; guardarStorage(); renderBuscar(); renderActualizar(); renderSeleccionar(); }
  toast('Cliente reactivado ✓','success');
}

function iniciarEdicion(id){
  const c=clientes.find(x=>x.id===id);
  if(!c) return;
  editandoId=id;
  cargarEnFormulario(c);
  // flujo simplificado: sin banner, el botón Guardar del panel hará el update
  const btnGuardar = document.querySelector('[data-action="guardar"]');
  if(btnGuardar){ btnGuardar.innerHTML='<span class="icon">💾</span>Guardar Cambios'; btnGuardar.classList.add('accent'); }
  toast('Editando a '+c.nombre+' '+c.apellido+' — modifica y pulsa Guardar Cambios','info');
}
function cancelarEdicion(){ editandoId=null; const b=document.querySelector('[data-action="guardar"]'); if(b){ b.innerHTML='<span class="icon">💾</span>Guardar'; b.classList.remove('accent'); } limpiarCampos(true); toast('Edición cancelada','info'); showVista('actualizar'); }
async function guardarEdicion(){
  if(!editandoId) return;
  if(!validarFormulario()) return;
  const idx=clientes.findIndex(x=>x.id===editandoId);
  if(idx===-1) return;
  const datos=recolectarDatos();
  // evitar duplicado identificación si cambia a una existente
  const dup=clientes.find(x=>x.identificacion===datos.identificacion && x.id!==editandoId);
  if(dup){ toast('Ya existe otro cliente con esa identificación','error'); return; }
  if(usandoAPI){
    const res = await apiActualizar(editandoId, datos);
    if(!res.ok){ toast(res.error||'Error al actualizar','error'); return; }
    await sincronizarDesdeAPI();
  } else {
    clientes[idx]={...clientes[idx], ...datos};
    guardarStorage();
  }
  editandoId=null;
  document.getElementById('bannerEdicion').classList.add('hidden');
  renderActualizar(); renderBuscar();
  toast('Cliente actualizado correctamente','success');
  showVista('actualizar');
}
function confirmarBorrar(id){
  const c=clientes.find(x=>x.id===id);
  showModal({
    title:'¿Eliminar cliente?',
    text:`Se eliminará a ${c.nombre} ${c.apellido} (${c.identificacion}). Esta acción no se puede deshacer.`,
    confirmText:'Sí, eliminar',
    confirmClass:'danger',
    onConfirm:async ()=>{
      if(usandoAPI){ const res=await apiBorrar(id); if(!res.ok){ toast(res.error||'Error al borrar','error'); return; } await sincronizarDesdeAPI(); } else { clientes=clientes.filter(x=>x.id!==id); if(seleccionadoId===id) seleccionadoId=null; if(editandoId===id) editandoId=null; guardarStorage(); renderActualizar(); renderBuscar(); renderSeleccionar(); }
      toast('Cliente eliminado','info');
    }
  });
}

// --- EVENTOS BÚSQUEDA ---
document.getElementById('searchInput')?.addEventListener('input', ()=>{ paginaBuscar=1; renderBuscar(); });
document.getElementById('filterPais')?.addEventListener('change', ()=>{ paginaBuscar=1; renderBuscar(); });
document.getElementById('filterTipo')?.addEventListener('change', ()=>{ paginaBuscar=1; renderBuscar(); });
document.getElementById('filterEstado')?.addEventListener('change', ()=>{ paginaBuscar=1; renderBuscar(); });
document.getElementById('btnBuscarAhora')?.addEventListener('click', ()=>{ paginaBuscar=1; renderBuscar(); toast('Búsqueda actualizada','info'); });
document.getElementById('buscarPrev')?.addEventListener('click', ()=>{ if(paginaBuscar>1){ paginaBuscar--; renderBuscar(); }});
document.getElementById('buscarNext')?.addEventListener('click', ()=>{
  const total=Math.ceil(getFiltered().length/porPagina);
  if(paginaBuscar<total){ paginaBuscar++; renderBuscar(); }
});
document.getElementById('actualizarPrev')?.addEventListener('click', ()=>{ if(paginaActualizar>1){ paginaActualizar--; renderActualizar(); }});
document.getElementById('actualizarNext')?.addEventListener('click', ()=>{
  const total=Math.ceil(clientes.length/porPagina);
  if(paginaActualizar<total){ paginaActualizar++; renderActualizar(); }
});
document.getElementById('seleccionarSearch')?.addEventListener('input', renderSeleccionar);

// --- ACCIONES DE BOTONES (TODAS CON VIDA REAL) ---
document.getElementById('btnGrid').addEventListener('click', async (e)=>{
  const btn = e.target.closest('.btn-action');
  if(!btn) return;
  const action = btn.dataset.action;
  switch(action){
    case 'buscar':
      showVista('buscar');
      break;
    case 'actualizar':
      if(clientes.length===0){ toast('No hay clientes para actualizar — crea uno primero','info'); showVista('form'); break; }
      showVista('actualizar');
      break;
    case 'limpiar':
      limpiarCampos();
      showVista('form');
      break;
    case 'nuevo':
      limpiarCampos(true);
      document.getElementById('numCliente').value = String(clientes.length+1).padStart(4,'0');
      showVista('form');
      document.getElementById('nombre').focus();
      toast('Listo para nuevo cliente','info');
      break;
    case 'crear': {
      if(editandoId){ await guardarEdicion(); break; }
      if(!validarFormulario()) break;
      const datosCrear=recolectarDatos();
      if(usandoAPI){
        const res = await apiCrear(datosCrear);
        if(res.ok){ toast(`✓ Cliente ${datosCrear.nombre} ${datosCrear.apellido} guardado en MySQL (#${res.numCliente})`,'success'); await sincronizarDesdeAPI(); }
        else toast(res.error||'Error al crear en MySQL','error');
      } else {
        if(clientes.some(c=>c.identificacion===datosCrear.identificacion)){ toast('Ya existe un cliente con esa identificación — usa otra','error'); identificacion.focus(); break; }
        const nuevo={...datosCrear, id: Date.now(), numCliente: datosCrear.numCliente || String(clientes.length+1).padStart(4,'0')};
        clientes.push(nuevo); guardarStorage(); renderBuscar(); renderActualizar();
        clientCountEl.style.transform='scale(1.2)'; clientCountEl.style.transition='.2s'; setTimeout(()=> clientCountEl.style.transform='scale(1)',200);
        toast(`✓ Cliente ${nuevo.nombre} ${nuevo.apellido} creado correctamente (#${nuevo.numCliente}) — ya aparece en Buscar`,'success');
      }
      break;
    }
    case 'guardar': {
      if(editandoId){ await guardarEdicion(); break; }
      if(!validarFormulario()) break;
      const datosG=recolectarDatos();
      if(usandoAPI){
        const res = await apiCrear(datosG);
        if(res.ok){ toast(`✓ Cliente ${datosG.nombre} ${datosG.apellido} guardado en MySQL (#${res.numCliente})`,'success'); await sincronizarDesdeAPI(); }
        else toast(res.error||'Error al guardar','error');
      } else {
        if(clientes.some(c=>c.identificacion===datosG.identificacion)){ toast('Ya existe un cliente con esa identificación','error'); break; }
        const nuevoG={...datosG, id: Date.now(), numCliente: datosG.numCliente || String(clientes.length+1).padStart(4,'0')};
        clientes.push(nuevoG); guardarStorage(); renderBuscar(); renderActualizar();
        toast(`✓ Cliente ${nuevoG.nombre} ${nuevoG.apellido} guardado (#${nuevoG.numCliente})`,'success');
      }
      break;
    }
    case 'borrar': {
      const ident = identificacion.value.trim();
      const tipo = document.getElementById('tipoCliente').value;
      let target = null;
      if(ident){
        target = clientes.find(c=> c.identificacion===ident && (!tipo || c.tipoCliente===tipo));
        if(!target) target = clientes.find(c=> c.identificacion===ident);
      }
      if(!target && seleccionadoId) target = clientes.find(c=>c.id===seleccionadoId);
      if(!target){
        toast('Escribe una identificación existente o selecciona un cliente para eliminar','error');
        break;
      }
      confirmarBorrar(target.id);
      break;
    }
    case 'teclado':
      toggleKeyboard();
      break;
    case 'salir':
      showModal({
        title:'¿Salir del sistema?',
        text:'Se cerrará la sesión actual. Los datos quedan guardados localmente.',
        confirmText:'Salir',
        confirmClass:'primary',
        onConfirm:async ()=>{
          toast('Sesión finalizada — ¡hasta pronto!','info');
          setTimeout(()=>{ limpiarCampos(true); showVista('form'); },600);
        }
      });
      break;
  }
});

// Paginación footer original ahora pagina la vista activa
document.getElementById('prevBtn').addEventListener('click', ()=>{
  if(vistaActual==='buscar'){ if(paginaBuscar>1){ paginaBuscar--; renderBuscar(); } }
  else if(vistaActual==='actualizar'){ if(paginaActualizar>1){ paginaActualizar--; renderActualizar(); } }
  else { if(currentPage>1){ currentPage--; pageNumEl.textContent=currentPage; }}
});
document.getElementById('nextBtn').addEventListener('click', ()=>{
  if(vistaActual==='buscar'){
    const total=Math.ceil(getFiltered().length/porPagina);
    if(paginaBuscar<total){ paginaBuscar++; renderBuscar(); }
  } else if(vistaActual==='actualizar'){
    const total=Math.ceil(clientes.length/porPagina);
    if(paginaActualizar<total){ paginaActualizar++; renderActualizar(); }
  } else { currentPage++; pageNumEl.textContent=currentPage; toast(`Página ${currentPage}`,'info'); }
});
document.getElementById('selectAll').addEventListener('change', (e)=>{
  const checked=e.target.checked;
  if(vistaActual==='buscar' || vistaActual==='seleccionar'){
    if(checked && clientes.length>0){ seleccionadoId=clientes[0].id; guardarStorage(); renderSeleccionar(); renderBuscar(); toast('Primer cliente seleccionado','info'); }
    else { deseleccionar(); }
  } else toast(checked ? 'Todos seleccionados' : 'Selección limpiada','info');
});

// Zoom
btnZoom.addEventListener('click', ()=>{
  if(!document.fullscreenElement){
    appCard.requestFullscreen?.().catch(()=>{});
    btnZoom.classList.add('active');
    btnZoom.textContent='⤢ Salir Zoom';
    toast('Modo zoom activado','info');
  } else {
    document.exitFullscreen?.();
    btnZoom.classList.remove('active');
    btnZoom.textContent='⤢ Zoom Pantalla';
  }
});
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement){
    btnZoom.classList.remove('active');
    btnZoom.textContent='⤢ Zoom Pantalla';
  }
});

// Solo números para teléfono y #Cliente
['telefono','numCliente'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('input', e=> e.target.value=e.target.value.replace(/\D/g,''));
  el.addEventListener('focus', ()=> lastFocused=el);
});
function formatearFechaDMY(el){
  let v=el.value.replace(/\D/g,'').slice(0,8);
  if(v.length>=5) v=v.replace(/^(\d{2})(\d{2})(\d{0,4})/,'$1 / $2 / $3');
  else if(v.length>=3) v=v.replace(/^(\d{2})(\d{0,2})/,'$1 / $2');
  el.value=v;
}
function fechaDMY_a_YMD(dmy){
  const m=dmy.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
  if(!m) return '';
  const dd=m[1], mm=m[2], aaaa=m[3];
  if(+mm<1||+mm>12||+dd<1||+dd>31) return '';
  return `${aaaa}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}
function fechaYMD_a_DMY(ymd){
  if(!ymd) return '';
  const p=ymd.split('-'); if(p.length!==3) return ymd;
  return `${p[2].padStart(2,'0')} / ${p[1].padStart(2,'0')} / ${p[0]}`;
}
['nombre','apellido','direccion','tipoCliente','pais'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('focus', ()=> lastFocused=el);
});