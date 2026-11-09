(()=>{
const initial=[
['د. عائشة نواف البلوي','كلية العلوم / الكيمياء'],['د. منال أحمد قريش','كلية العلوم / الكيمياء الحيوية'],
['د. الحسين عجيم','كلية العلوم الطبية التطبيقية'],['د. مصطفى زبيدي كعبي','كلية العلوم / الأحياء'],
['د. خليل يحيى السعيد','كلية العلوم / قسم الفيزياء'],['د. نور القرشي','وحدة الجينوم'],
['د. رامي العسيري','كلية العلوم / الكيمياء الحيوية'],['د. رجى عبدالله الغديري','كلية العلوم'],
['د. ماجدة راجي العتيبي','كلية العلوم / الكيمياء'],['أ. هبة محمد العطوي','فنية مختبر / كلية العلوم'],
['Dr. Uzma Faridi','كلية العلوم / الكيمياء الحيوية'],['د. عبدالرحمن العطوي','باحث ما بعد الدكتوراه / وحدة الجينوم'],
['د. نادر محمد الضويمر','كلية العلوم / الكيمياء الحيوية'],['أ.د. هالة بيومي','كلية العلوم / علوم الغذاء'],
['أ. محمد محمود البلوي','كلية العلوم / الفيزياء'],['أ. فهد محمد الخثعمي','المركز الطبي'],
['د. فاطمة العتيبي','كلية العلوم / قسم الكيمياء'],['أ. أحمد العطوي','كلية العلوم / باحث أكاديمي']
].map((x,i)=>({id:i+1,name:x[0],affiliation:x[1],specialty:'',group:''}));

const key='centralLabTeamMembersV1';let members;try{const stored=JSON.parse(localStorage.getItem(key));members=Array.isArray(stored)?stored:initial}catch{members=initial}
members=members.filter(m=>m&&typeof m.name==='string').map((m,i)=>({id:Number(m.id)||i+1,name:m.name,affiliation:String(m.affiliation||''),specialty:String(m.specialty||''),group:String(m.group||'')}));
let editId=null;const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const persist=()=>window.centralLabSave(key,JSON.stringify(members),'تعديل بيانات فريق العمل');const modal=$('teamModal'),form=$('teamForm');
const uniq=key=>[...new Set(members.map(m=>m[key].trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
function initials(name){const parts=name.replace(/^(د\.|أ\.د\.|أ\.|Dr\.)\s*/i,'').trim().split(/\s+/);return parts.length>1?(parts[0][0]+parts[1][0]):(parts[0]?.slice(0,2)||'؟')}
function render(){const q=$('teamSearch').value.trim().toLocaleLowerCase(),group=$('teamGroupFilter').value,spec=$('teamSpecialtyFilter').value;const groups=uniq('group'),specs=uniq('specialty');
$('teamGroupFilter').innerHTML='<option value="">كل المجموعات</option>'+groups.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('teamGroupFilter').value=groups.includes(group)?group:'';
$('teamSpecialtyFilter').innerHTML='<option value="">كل التخصصات</option>'+specs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('teamSpecialtyFilter').value=specs.includes(spec)?spec:'';
$('teamGroupSuggestions').innerHTML=groups.map(x=>`<option value="${esc(x)}"></option>`).join('');$('teamSpecialtySuggestions').innerHTML=specs.map(x=>`<option value="${esc(x)}"></option>`).join('');
let shown=members.filter(m=>(!group||m.group===group)&&(!spec||m.specialty===spec)&&[m.name,m.affiliation,m.specialty,m.group].some(v=>v.toLocaleLowerCase().includes(q)));
if($('teamSort').value==='name')shown.sort((a,b)=>a.name.localeCompare(b.name,'ar'));if($('teamSort').value==='group')shown.sort((a,b)=>a.group.localeCompare(b.group,'ar'));
$('teamCount').textContent=members.length;$('teamHeaderCount').textContent=members.length;$('teamShown').textContent=shown.length;$('teamGroupsCount').textContent=groups.length;$('teamSpecialtiesCount').textContent=specs.length;
$('teamCards').innerHTML=shown.map(m=>`<article class="team-card"><div class="team-avatar team-avatar--${window.teamSpecialtyIcon?.(m).key||'general'}" title="${esc(m.specialty||m.affiliation||'التخصص غير محدد')}" aria-hidden="true">${window.teamSpecialtyIcon?.(m).html||esc(initials(m.name))}</div><div class="team-info"><div class="team-person-line"><strong>${esc(m.name)}</strong><span class="team-number">${String(members.indexOf(m)+1).padStart(2,'0')}</span></div><small>${esc(m.affiliation)||'الجهة غير محددة'}</small><div class="team-tags"><span class="team-tag ${m.specialty?'':'team-unset'}">◈ ${esc(m.specialty)||'إضافة التخصص'}</span><span class="team-tag gold ${m.group?'':'team-unset'}">♧ ${esc(m.group)||'إضافة مجموعة العمل'}</span></div></div><div class="team-actions"><button type="button" data-edit="${m.id}" title="تعديل بيانات العضو">✎ تعديل</button><button type="button" class="team-delete" data-delete="${m.id}" title="حذف العضو">حذف</button></div></article>`).join('')||'<div class="team-empty"><strong>لا توجد نتائج مطابقة</strong><p>جرّب تغيير كلمات البحث أو إزالة عوامل التصفية.</p></div>';
}
function open(){modal.classList.remove('hidden');document.body.classList.add('team-modal-open');$('teamNavBtn').setAttribute('aria-expanded','true');render()}
function close(){modal.classList.add('hidden');document.body.classList.remove('team-modal-open');$('teamNavBtn').setAttribute('aria-expanded','false');form.classList.add('hidden')}
function startEdit(id){editId=id;const m=members.find(x=>x.id===id);$('teamFormTitle').textContent=m?'تعديل بيانات العضو':'إضافة عضو جديد';$('teamName').value=m?.name||'';$('teamAffiliation').value=m?.affiliation||'';$('teamSpecialty').value=m?.specialty||'';$('teamGroup').value=m?.group||'';form.classList.remove('hidden');form.scrollIntoView({behavior:'smooth',block:'nearest'});$('teamName').focus()}
$('teamNavBtn').addEventListener('click',open);$('teamClose').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});$('teamAdd').addEventListener('click',()=>startEdit(null));for(const id of ['teamCancel','teamCancelBottom'])$(id).addEventListener('click',()=>form.classList.add('hidden'));for(const id of ['teamSearch','teamGroupFilter','teamSpecialtyFilter','teamSort'])$(id).addEventListener(id==='teamSearch'?'input':'change',render);
form.addEventListener('submit',e=>{e.preventDefault();const values={name:$('teamName').value.trim(),affiliation:$('teamAffiliation').value.trim(),specialty:$('teamSpecialty').value.trim(),group:$('teamGroup').value.trim()};if(!values.name)return;if(editId!==null){const m=members.find(x=>x.id===editId);if(m)Object.assign(m,values)}else members.push({id:Math.max(0,...members.map(x=>x.id))+1,...values});persist();form.classList.add('hidden');render()});
$('teamCards').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)startEdit(Number(edit.dataset.edit));if(del&&confirm('هل تريد حذف هذا العضو من فريق العمل؟')){members=members.filter(m=>m.id!==Number(del.dataset.delete));persist();render()}});
$('teamExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(members,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='central-lab-team.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('teamImport').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const arr=JSON.parse(await file.text());if(!Array.isArray(arr)||!arr.every(x=>x&&typeof x.name==='string'))throw Error('format');if(!confirm('استبدال قائمة الأعضاء الحالية بالبيانات المستوردة؟'))return;members=arr.map((m,i)=>({id:i+1,name:m.name,affiliation:String(m.affiliation||''),specialty:String(m.specialty||''),group:String(m.group||'')}));persist();render()}catch{alert('تعذّر استيراد الملف. يرجى اختيار ملف JSON صحيح لقائمة الأعضاء.')}finally{e.target.value=''}});
render();
})();
