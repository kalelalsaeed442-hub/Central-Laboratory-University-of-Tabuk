
(()=>{const original=JSON.parse(JSON.stringify(window.__LAB_DATA__));let data=JSON.parse(localStorage.getItem("centralLabsDigitalTwinData")||JSON.stringify(original));let current="micro",zoom=1;const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function shade(hex,p){let n=parseInt(hex.slice(1),16),a=Math.round(2.55*p),r=Math.max(0,Math.min(255,(n>>16)+a)),g=Math.max(0,Math.min(255,((n>>8)&255)+a)),b=Math.max(0,Math.min(255,(n&255)+a));return"#"+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function colors(){ $$(".lab").forEach(el=>{let d=data[el.dataset.lab];if(d){el.style.setProperty("--bgc",d.bg);el.style.setProperty("--bc",d.border)}})}
function maplabels(){ $$(".lab").forEach(el=>{let d=data[el.dataset.lab];if(!d)return;let b=el.querySelector("b"),s=el.querySelector("small");if(b)b.textContent=d.ar;if(s)s.textContent=d.en})}
function iconForDevice(n){
      const s=(n||"").toLowerCase();
      if(s.includes("microscope")||s.includes("tem")||s.includes("sem")||s.includes("afm")) return "🔬";
      if(s.includes("pcr")||s.includes("dna")||s.includes("gel")) return "🧬";
      if(s.includes("flow cytometer")||s.includes("incubator")||s.includes("biosafety")) return "🧫";
      if(s.includes("gc")||s.includes("lc")||s.includes("uplc")||s.includes("hplc")) return "📈";
      if(s.includes("xrd")||s.includes("xrf")) return "💠";
      if(s.includes("tga")||s.includes("dma")||s.includes("oven")) return "🔥";
      if(s.includes("raman")||s.includes("ftir")||s.includes("uv")||s.includes("nmr")) return "🌈";
      if(s.includes("icp")||s.includes("chn")||s.includes("atomic")) return "⚛️";
      if(s.includes("potentiostat")||s.includes("tds")) return "⚡";
      return "🧪";
    }
    const devicePhotos={
      "tem":"TEM.jpg","sem 1":"SEM.jpg","sem 2":"SEM.jpg","sem":"SEM.jpg","afm/stm":"AFM_STM.jpg",
      "confocal microscope":"Confocal_Microscope.jpg","fluorescent microscope":"Fluorescent_Microscope.jpg","slide scanner":"Slide_Scanner.jpg",
      "electron microscope sample prep suite":"Sample_Prep_Suite.jpg","sample prep. suite":"Sample_Prep_Suite.jpg","cryostat":"Cryostat.jpg","ultrasonic":"Ultrasonic_Cleaner.jpg","ultrasonic cleaner":"Ultrasonic_Cleaner.jpg","rapid prototyping machine":"Rapid_Prototyping_Machine.jpg",
      "xrd 1":"XRD.jpg","xrd 2":"XRD.jpg","xrd":"XRD.jpg","tga/dsc":"TGA_DSC.jpg","xrf":"XRF.jpg","surface area & pore size analyzer":"Surface_Area_Analyzer.jpg","surface area analyzer":"Surface_Area_Analyzer.jpg","crystal size analyzer":"Particle_Analyzer.jpg","particle analyzer":"Particle_Analyzer.jpg",
      "raman":"Raman.jpg","nmr":"NMR.jpg","ftir":"FTIR.jpg","uv-vis-ir":"UV_Vis_IR.jpg","spectrophotometer":"Spectrophotometer.jpg","thermo-nanodrop 8000":"NanoDrop_8000.jpg","nanodrop 8000":"NanoDrop_8000.jpg","atomic absorption spectrometer":"Spectrophotometer.jpg",
      "icp/ms":"ICP_MS.jpg","elemental analyzer (chn)":"Elemental_Analyzer_CHN.jpg","zetasizer":"Zetasizer.jpg",
      "uplc/ms/ms":"UPLC_MS_MS.jpg","gc/ms/ms":"GC_MS_MS.jpg","lc/ms/ms":"LC_MS_MS.jpg","hplc/ms":"LC_MS_MS.jpg","gpc":"GPC.jpg","dma":"DMA.jpg","dynamic mechanical analyzer":"DMA.jpg",
      "potentiostat/galvanostat":"Potentiostat_Galvanostat.jpg","tds meter":"TDS_Meter.jpg","mastersizer":"Mastersizer.jpg","autochem analyzer":"Autochem_Analyzer.jpg","viscometer":"Viscometer.jpg","ovens":"Ovens.jpg",
      "real-time pcr":"Real_time_PCR.jpg","flow cytometer":"Flow_Cytometer.jpg","elisa reader":"ELISA_Reader.jpg","gel electrophoresis":"Gel_Electrophoresis.jpg","gel doc":"Gel_Doc.jpg","co₂ incubator":"CO2_Incubator.jpg","co2 incubator":"CO2_Incubator.jpg","biosafety cabinet":"Biosafety_Cabinet.jpg","inverted microscope":"Inverted_Microscope.jpg"
    };
    function photoForDevice(n){return devicePhotos[(n||"").trim().toLowerCase()]||null}
    function deviceVisualHTML(n,cls="device-img"){
      const photo=photoForDevice(n);
      return photo?`<img class="${cls}" src="assets/equipment/${photo}" alt="${esc(n)}" loading="lazy">`:`<span class="device-fallback">${iconForDevice(n)}</span>`;
    }
    function showDevice(n){
      $("#deviceNameHero").textContent=n;
      $("#devicePhoto").innerHTML=deviceVisualHTML(n,"device-img-hero");
      $("#detail").innerHTML=`<b>${esc(n)}</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px;font-size:12px"><span>Equipment ID: يُستكمل</span><span>Calibration: يُستكمل</span><span>Maintenance: يُستكمل</span><span>Authorized Users: يُستكمل</span></div>`
    }
function bindEq(){ $$(".eq").forEach(b=>b.onclick=()=>{$$(".eq").forEach(x=>x.classList.remove("active"));b.classList.add("active");showDevice(b.dataset.eq);const hero=$(".device-visual");if(hero){hero.classList.remove("device-pulse");void hero.offsetWidth;hero.classList.add("device-pulse")}})}
function equipmentCard(e,i){return `<button class="eq ${i===0?"active":""}" data-eq="${esc(e)}"><span class="eq-thumb" aria-hidden="true">${deviceVisualHTML(e,"eq-img")}</span><span class="eq-copy"><b>${esc(e)}</b><small>Equipment</small></span></button>`}
function showEquipmentTab(){const tab=document.querySelector('.tab[data-tab="equipment"]');if(tab){$$(".tab").forEach(x=>x.classList.remove("active"));tab.classList.add("active");["equipment","operation","requirements","safety"].forEach(t=>{const panel=$("#"+t+"Tab");if(panel) panel.classList.toggle("hidden",t!=="equipment")})}}
function animateLabPanel(){const side=document.querySelector('.side.card');if(!side)return;side.classList.remove('lab-panel-enter');void side.offsetWidth;side.classList.add('lab-panel-enter');setTimeout(()=>side.classList.remove('lab-panel-enter'),520)}
function render(k,focusEquipment=false){current=k;let d=data[k];$$(".lab").forEach(x=>x.classList.toggle("selected",x.dataset.lab===k));$("#title").textContent=d.ar;$("#english").textContent=d.en;$("#equipment").innerHTML=d.equipment.map((e,i)=>equipmentCard(e,i)).join("");$("#requirements").innerHTML=d.requirements.map(x=>`<div>◆ ${esc(x)}</div>`).join("");$("#operation").innerHTML=d.operation.map(x=>`<li>${esc(x)}</li>`).join("");$("#editName").value=d.ar;$("#editEnglish").value=d.en;$("#editColor").value=d.bg;$("#editEquipment").value=d.equipment.join("\n");bindEq();showDevice(d.equipment[0]||"No equipment");if(focusEquipment){showEquipmentTab();animateLabPanel()}}
$$(".lab").forEach(b=>b.onclick=()=>render(b.dataset.lab,true));
$$("[data-floor]").forEach(btn=>btn.onclick=()=>{let g=btn.dataset.floor==="g";$("#ground").classList.toggle("hidden",!g);$("#first").classList.toggle("hidden",g);$$("[data-floor]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");zoom=1;set3D(false);applyFloorView()});
const infraBtn=$("#infraBtn"), infra=$("#infra");
if(infraBtn && infra) infraBtn.onclick=()=>infra.classList.toggle("hidden");
const editBtn=$("#editBtn"), editBox=$("#editBox");
if(editBtn && editBox) editBtn.onclick=()=>{const opening=editBox.classList.contains("hidden");editBox.classList.toggle("hidden");editBtn.classList.toggle("active",opening);if(opening) editBox.scrollIntoView({behavior:"smooth",block:"nearest"});};
$$(".tab").forEach(btn=>btn.onclick=()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  ["equipment","operation","requirements","safety"].forEach(t=>{const panel=$("#"+t+"Tab");if(panel) panel.classList.toggle("hidden",t!==btn.dataset.tab);});
});
$("#save").onclick=()=>{let d=data[current];d.ar=$("#editName").value.trim()||d.ar;d.en=$("#editEnglish").value.trim()||d.en;d.bg=$("#editColor").value;d.border=shade(d.bg,-18);d.equipment=$("#editEquipment").value.split("\n").map(x=>x.trim()).filter(Boolean);localStorage.setItem("centralLabsDigitalTwinData",JSON.stringify(data));colors();maplabels();render(current)};
function applyFloorView(){
  const target=activeFloor();
  if(!target) return;
  target.style.setProperty("--floor-zoom", zoom);
}
function setZoom(z){zoom=Math.max(.72,Math.min(1.35,z));applyFloorView()}
$("#zi").onclick=()=>setZoom(zoom+.08);$("#zo").onclick=()=>setZoom(zoom-.08);$("#zr").onclick=()=>setZoom(1);
$("#search").oninput=e=>{let q=e.target.value.trim().toLowerCase();$$(".lab").forEach(el=>{let d=data[el.dataset.lab],hit=!q||d.ar.toLowerCase().includes(q)||d.en.toLowerCase().includes(q)||d.equipment.some(x=>x.toLowerCase().includes(q));el.style.opacity=hit?"1":".24"})};
$("#export").onclick=()=>{let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="central_research_labs_data.json";a.click();URL.revokeObjectURL(a.href)};
$("#importFile").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);localStorage.setItem("centralLabsDigitalTwinData",JSON.stringify(data));colors();maplabels();render(current)}catch{alert("ملف JSON غير صالح")}};r.readAsText(f)};
$("#reset").onclick=()=>{if(confirm("استعادة جميع البيانات الأصلية؟")){data=JSON.parse(JSON.stringify(original));localStorage.removeItem("centralLabsDigitalTwinData");colors();maplabels();render("micro")}};

function activeFloor(){return $("#ground").classList.contains("hidden")?$("#first"):$("#ground");}
function set3D(on){
  const target=activeFloor();
  if(!target) return;
  // Keep only the visible floor in 3D mode and clear stale state from the other floor.
  $$(".floor").forEach(f=>{ if(f!==target) f.classList.remove("isometric"); });
  target.classList.toggle("isometric",on);
  target.style.setProperty("--floor-zoom", zoom);
  const viewport=document.querySelector(".viewport");
  if(viewport) viewport.classList.toggle("view-3d",on);
  const top3=$("#view3d"), r3=$("#rail3d"), r2=$("#rail2d");
  if(top3){top3.classList.toggle("active",on);top3.textContent="3D";top3.setAttribute("aria-pressed",String(on));}
  if(r3){r3.classList.toggle("active",on);r3.setAttribute("aria-pressed",String(on));}
  if(r2){r2.classList.toggle("active",!on);r2.setAttribute("aria-pressed",String(!on));}
}
const view3d=$("#view3d");
if(view3d) view3d.onclick=()=>set3D(!activeFloor().classList.contains("isometric"));
$$(".layer").forEach(btn=>btn.onclick=()=>{
  btn.classList.toggle("active");
  const layer=btn.dataset.layer;
  document.body.classList.toggle("layer-"+layer,btn.classList.contains("active"));
});


$$("[data-rail-floor]").forEach(btn=>btn.onclick=()=>{
  const g=btn.dataset.railFloor==="g";
  $("#ground").classList.toggle("hidden",!g);
  $("#first").classList.toggle("hidden",g);
  $$("[data-rail-floor]").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  $$("[data-floor]").forEach(x=>x.classList.toggle("active",x.dataset.floor===(g?"g":"f")));
  zoom=1; set3D(false); applyFloorView();
});
const r3=$("#rail3d");
if(r3) r3.onclick=()=>set3D(!activeFloor().classList.contains("isometric"));
const r2=$("#rail2d");
if(r2) r2.onclick=()=>set3D(false);
$$("[data-switch]").forEach(s=>s.onchange=()=>document.body.classList.toggle("layer-"+s.dataset.switch,s.checked));

colors();maplabels();render("micro");
})();


(function(){
  const orgBtn=document.getElementById("orgPlanBtn");
  const orgModal=document.getElementById("orgPlanModal");
  const closeOrg=document.getElementById("closeOrg");
  if(!orgBtn || !orgModal) return;

  function openOrg(){
    orgModal.classList.remove("hidden");
    document.documentElement.style.overflow="hidden";
    document.body.style.overflow="hidden";
  }
  function closeOrgModal(){
    orgModal.classList.add("hidden");
    document.documentElement.style.overflow="";
    document.body.style.overflow="";
  }

  orgBtn.addEventListener("click",openOrg);
  if(closeOrg) closeOrg.addEventListener("click",closeOrgModal);
  orgModal.addEventListener("click",e=>{ if(e.target===orgModal) closeOrgModal(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !orgModal.classList.contains("hidden")) closeOrgModal(); });

  document.querySelectorAll(".org-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".org-tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const ground=document.getElementById("org-ground");
      const first=document.getElementById("org-first");
      if(ground) ground.classList.toggle("hidden",btn.dataset.org!=="ground");
      if(first) first.classList.toggle("hidden",btn.dataset.org!=="first");
    });
  });
})();



(function(){
  const btn=document.getElementById("orgPlanBtn");
  const modal=document.getElementById("orgPlanModal");
  const close=document.getElementById("closeOrg");
  if(!modal) return;

  function openModal(){
    modal.classList.remove("hidden");
    document.body.style.overflow="hidden";
  }
  function closeModal(){
    modal.classList.add("hidden");
    document.body.style.overflow="";
  }

  if(btn) btn.onclick=openModal;
  if(close) close.onclick=closeModal;
  modal.addEventListener("click",e=>{ if(e.target===modal) closeModal(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!modal.classList.contains("hidden")) closeModal(); });

  document.querySelectorAll(".org-tab").forEach(t=>{
    t.addEventListener("click",()=>{
      document.querySelectorAll(".org-tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      document.getElementById("org-ground").classList.toggle("hidden",t.dataset.org!=="ground");
      document.getElementById("org-first").classList.toggle("hidden",t.dataset.org!=="first");
    });
  });
})();

/* ===== V13 professional lab transitions ===== */
(function(){
  function bindMotion(){
    const side=document.querySelector('.side.card')||document.querySelector('.side');
    document.querySelectorAll('.lab').forEach(lab=>{
      if(lab.dataset.v13Bound) return;
      lab.dataset.v13Bound='1';

      lab.addEventListener('click',function(ev){
        // ripple
        const rect=lab.getBoundingClientRect();
        const ripple=document.createElement('span');
        ripple.className='v13-ripple';
        ripple.style.left=(ev.clientX-rect.left)+'px';
        ripple.style.top=(ev.clientY-rect.top)+'px';
        ripple.style.width=ripple.style.height=Math.max(rect.width,rect.height)*0.5+'px';
        lab.appendChild(ripple);
        setTimeout(()=>ripple.remove(),650);

        if(!side) return;
        side.classList.add('v13-changing');

        // Let the original application update the lab content first.
        requestAnimationFrame(()=>{
          setTimeout(()=>{
            side.classList.remove('v13-changing');

            const blocks=side.querySelectorAll(
              '.panel,.tab-panel,.side-content,.equipment-grid,.detail-grid,.operation-list,.requirements-list,.device-visual,.lab-summary'
            );
            blocks.forEach(el=>{
              el.classList.remove('v13-reveal');
              void el.offsetWidth;
              el.classList.add('v13-reveal');
            });

            const cards=side.querySelectorAll('.equipment-card,.eq,.detail-card,.req-card');
            cards.forEach((card,i)=>{
              card.classList.remove('v13-stagger');
              card.style.animationDelay=Math.min(i*45,360)+'ms';
              void card.offsetWidth;
              card.classList.add('v13-stagger');
            });
          },110);
        });
      });
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bindMotion);
  }else{
    bindMotion();
  }

  new MutationObserver(bindMotion).observe(document.body,{childList:true,subtree:true});
})();

/* V14: identify Open Research Area visually without changing application logic */
(function(){
  function tagOpenResearchArea(){
    const nodes=[...document.querySelectorAll('div,section,article,button')];
    const target=nodes.find(el=>{
      const t=(el.textContent||'').trim();
      return (t.includes('منطقة الأبحاث المفتوحة') || t.includes('Open Research Area')) &&
             el.children.length < 18;
    });
    if(target && !target.classList.contains('open-research-area')){
      target.classList.add('open-research-area');
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',tagOpenResearchArea);
  }else{
    tagOpenResearchArea();
  }
  new MutationObserver(tagOpenResearchArea).observe(document.body,{childList:true,subtree:true});
})();


/* Research benches removed from entrance/open area per revised presentation. */
