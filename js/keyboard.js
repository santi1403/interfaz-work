// js/keyboard.js - Teclado virtual libre auto-show
let keyboardWrapper, keyboardEl, btnCerrarTeclado;
let keysLayout = [
  ['1','2','3','4','5','6','7','8','9','0','⌫'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l','ñ'],
  ['z','x','c','v','b','n','m','@','.','_','-'],
  ['Espacio']
];

export function initKeyboard({estado, toast}){
  keyboardWrapper = document.getElementById('keyboardWrapper');
  keyboardEl = document.getElementById('keyboard');
  btnCerrarTeclado = document.getElementById('btnCerrarTeclado');
  if(!keyboardEl) return;

  function buildKeyboard(){
    keyboardEl.innerHTML='';
    keysLayout.forEach(row=>{
      const r=document.createElement('div'); r.className='k-row';
      row.forEach(k=>{
        const btn=document.createElement('button'); btn.type='button'; btn.className='k-key';
        if(k==='⌫') btn.classList.add('action','wide');
        if(k==='Espacio'){ btn.classList.add('extra-wide'); btn.textContent='Espacio'; } else btn.textContent=k;
        btn.dataset.key = k==='Espacio' ? ' ' : k;
        btn.addEventListener('mousedown', e=> e.preventDefault());
        btn.addEventListener('click', ()=> handleVirtualKey(k, estado, toast));
        r.appendChild(btn);
      });
      keyboardEl.appendChild(r);
    });
  }

  function handleVirtualKey(key, estado, toast){
    let lastFocused = estado.lastFocused;
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
    } else if(key==='Espacio'){ el.value=el.value.slice(0,start)+' '+el.value.slice(end); el.selectionStart=el.selectionEnd=start+1; }
    else {
      const char=key; const max=el.getAttribute('maxlength');
      if(max && el.value.length>=parseInt(max) && start===end){ toast('Límite alcanzado','error'); return; }
      el.value=el.value.slice(0,start)+char+el.value.slice(end); el.selectionStart=el.selectionEnd=start+1;
    }
    el.focus(); el.dispatchEvent(new Event('input',{bubbles:true}));
  }

  buildKeyboard();

  function toggleKeyboard(show){
    if(!keyboardWrapper) return;
    const shouldShow = show!==undefined ? show : keyboardWrapper.classList.contains('hidden');
    if(shouldShow) keyboardWrapper.classList.remove('hidden');
    else keyboardWrapper.classList.add('hidden');
  }

  if(btnCerrarTeclado) btnCerrarTeclado.addEventListener('click', ()=> toggleKeyboard(false));

  // Auto-mostrar al tocar campo
  document.addEventListener('focusin', (e)=>{
    const el=e.target;
    if(el.matches && el.matches('input, textarea')){
      const type=(el.type||'').toLowerCase();
      const esTexto = el.tagName.toLowerCase()==='textarea' || (el.tagName.toLowerCase()==='input' && !['checkbox','radio','range','color','file','button','submit'].includes(type));
      if(esTexto){
        estado.lastFocused=el;
        toggleKeyboard(true);
      }
    }
  });

  // Arrastrable
  const header=document.querySelector('.keyboard-header');
  if(header && keyboardWrapper){
    let dragging=false,sx,sy,ol,ot;
    function toFixed(){ const r=keyboardWrapper.getBoundingClientRect(); keyboardWrapper.style.left=r.left+'px'; keyboardWrapper.style.top=r.top+'px'; keyboardWrapper.style.right='auto'; keyboardWrapper.style.bottom='auto'; keyboardWrapper.style.transform='none'; }
    header.addEventListener('mousedown',e=>{
      if(e.target.tagName==='BUTTON') return;
      dragging=true; toFixed(); sx=e.clientX; sy=e.clientY; const r=keyboardWrapper.getBoundingClientRect(); ol=r.left; ot=r.top; document.body.style.userSelect='none'; e.preventDefault();
    });
    window.addEventListener('mousemove',e=>{ if(!dragging) return; keyboardWrapper.style.left=(ol+e.clientX-sx)+'px'; keyboardWrapper.style.top=(ot+e.clientY-sy)+'px'; });
    window.addEventListener('mouseup',()=>{ dragging=false; document.body.style.userSelect=''; });
    header.addEventListener('touchstart',e=>{
      if(e.target.tagName==='BUTTON') return;
      dragging=true; toFixed(); sx=e.touches[0].clientX; sy=e.touches[0].clientY; const r=keyboardWrapper.getBoundingClientRect(); ol=r.left; ot=r.top; e.preventDefault();
    },{passive:false});
    window.addEventListener('touchmove',e=>{ if(!dragging) return; keyboardWrapper.style.left=(ol+e.touches[0].clientX-sx)+'px'; keyboardWrapper.style.top=(ot+e.touches[0].clientY-sy)+'px'; e.preventDefault(); },{passive:false});
    window.addEventListener('touchend',()=> dragging=false);
  }

  // Exponer para uso externo
  window.toggleKeyboard = toggleKeyboard;
}
