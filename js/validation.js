// js/validation.js - Validación dinámica por Tipo ID
import { docConfig } from './config.js';

export function getDocCfg(){
  const tipo = document.getElementById('tipoCliente')?.value || 'CC';
  return docConfig[tipo] || docConfig['CC'];
}

export function sanitizarDocumento(v, tipo){
  let s = v.replace(/[\s\.\-]/g,'');
  if(tipo==='numeric') s = s.replace(/[^0-9]/g,'');
  else s = s.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
  return s;
}

export function validarIdentificacion(identificacion, errorEl, hintEl){
  const cfg = getDocCfg();
  let val = identificacion.value.trim();
  if(val === ''){
    identificacion.classList.remove('error','success');
    errorEl.classList.remove('show');
    hintEl.style.display='block';
    hintEl.style.color='';
    hintEl.textContent = `${cfg.label}: ${cfg.tipo==='numeric'?'solo números':'alfanumérico'} · ${cfg.min} a ${cfg.max} caracteres`;
    return false;
  }
  const esNumerico = cfg.tipo==='numeric';
  const regex = esNumerico ? /^[0-9]+$/ : /^[A-Z0-9]+$/;
  if(!regex.test(val)){
    identificacion.classList.add('error');
    identificacion.classList.remove('success');
    errorEl.textContent = esNumerico ? `Solo se permiten números para ${cfg.label}` : `Solo letras y números para ${cfg.label}`;
    errorEl.classList.add('show');
    hintEl.style.display='none';
    return false;
  }
  if(val.length < cfg.min || val.length > cfg.max){
    identificacion.classList.add('error');
    identificacion.classList.remove('success');
    if(cfg.min===cfg.max) errorEl.textContent = `${cfg.label} debe tener exactamente ${cfg.min} caracteres (${val.length}/${cfg.max})`;
    else errorEl.textContent = `${cfg.label} debe tener entre ${cfg.min} y ${cfg.max} caracteres (${val.length}/${cfg.max})`;
    errorEl.classList.add('show');
    hintEl.style.display='none';
    return false;
  } else {
    identificacion.classList.remove('error');
    identificacion.classList.add('success');
    errorEl.classList.remove('show');
    hintEl.style.display='block';
    hintEl.textContent='✓ Identificación válida';
    hintEl.style.color='#16a34a';
    return true;
  }
}

export function actualizarAtributosDocumento(identificacion, hintEl, validarFn){
  const cfg = getDocCfg();
  identificacion.setAttribute('minlength', cfg.min);
  identificacion.setAttribute('maxlength', cfg.max);
  identificacion.setAttribute('inputmode', cfg.tipo==='numeric' ? 'numeric' : 'text');
  hintEl.textContent = `${cfg.label}: ${cfg.tipo==='numeric'?'solo números':'alfanumérico'} · ${cfg.min} a ${cfg.max} caracteres`;
  hintEl.style.display='block';
  hintEl.style.color='';
  if(identificacion.value.trim()!=='') validarFn();
}

export function initValidation({identificacion, errorEl, hintEl, validarFn, estado}){
  // Input sanitizado
  identificacion.addEventListener('input', (e)=>{
    const cfg = getDocCfg();
    let v = sanitizarDocumento(e.target.value, cfg.tipo);
    if(v.length > cfg.max) v = v.slice(0, cfg.max);
    if(v !== e.target.value) e.target.value = v;
    validarFn();
  });
  identificacion.addEventListener('paste', (e)=>{
    e.preventDefault();
    const cfg = getDocCfg();
    const text = (e.clipboardData.getData('text')||'');
    let v = sanitizarDocumento(text, cfg.tipo).slice(0, cfg.max);
    const start = identificacion.selectionStart||0, end=identificacion.selectionEnd||0;
    const cur = identificacion.value;
    let nuevo = (cur.slice(0,start) + v + cur.slice(end));
    nuevo = sanitizarDocumento(nuevo, cfg.tipo).slice(0, cfg.max);
    identificacion.value = nuevo;
    identificacion.selectionStart = identificacion.selectionEnd = start + v.length;
    validarFn();
  });
  identificacion.addEventListener('keypress', (e)=>{
    const cfg = getDocCfg();
    if(cfg.tipo==='numeric' && !/[0-9]/.test(e.key) && e.key.length===1) e.preventDefault();
  });
  identificacion.addEventListener('blur', validarFn);
  document.getElementById('tipoCliente')?.addEventListener('change', ()=>{
    actualizarAtributosDocumento(identificacion, hintEl, validarFn);
  });
  // Inicializar
  setTimeout(()=> actualizarAtributosDocumento(identificacion, hintEl, validarFn), 100);
}
