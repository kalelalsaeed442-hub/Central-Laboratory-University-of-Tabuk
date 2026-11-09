/* Only affects image elements whose original asset fails to load. */
(()=>{
const placeholders={
 'ut_official_logo.png':['◈','شعار جامعة تبوك','أضيفي ملف الشعار الأصلي داخل assets'],
 'modified_plan.png':['▦','المخطط التنظيمي','أضيفي ملف المخطط الأصلي داخل assets'],
 'open_research_area.jpg':['⌂','منطقة الأبحاث المفتوحة','الصورة الأصلية غير مرفقة']
};
function failed(img){if(img.dataset.fallbackApplied)return;img.dataset.fallbackApplied='1';const path=(img.getAttribute('src')||'').split('/').pop();const info=placeholders[path];if(info){const box=img.parentElement;if(!box)return;img.style.display='none';box.classList.add('asset-fallback');const wrap=document.createElement('div');wrap.innerHTML='';const sym=document.createElement('span');sym.className='asset-symbol';sym.textContent=info[0];const title=document.createElement('strong');title.textContent=info[1];const note=document.createElement('small');note.textContent=info[2];wrap.append(sym,title,note);box.appendChild(wrap);return}
if((img.getAttribute('src')||'').includes('assets/equipment/')){const holder=img.parentElement;if(!holder)return;const symbol=document.createElement('span');symbol.className='device-fallback';symbol.textContent='🔬';symbol.setAttribute('aria-label','صورة الجهاز غير متوفرة');img.replaceWith(symbol)}
}
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)failed(e.target)},true);
document.querySelectorAll('img').forEach(img=>{if(img.complete&&img.naturalWidth===0)failed(img)});
})();
