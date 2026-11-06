// Shop behaviour for the sections after the stage. Nothing here is scroll-linked: reveals are one-shot (IntersectionObserver),
// the filter is a click-driven FLIP, the loops are CSS. The pinned stage and its intro live in app.js.
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const root=document.documentElement;
const reducedQ=matchMedia('(prefers-reduced-motion: reduce)');
const phoneQ=matchMedia('(max-width:899px),(max-aspect-ratio:1/1)');

// ---- Contact number: one mask per character ----
const chars=$('.chars');
if(chars){const txt=chars.textContent;chars.textContent='';[...txt].forEach((c,i)=>{const s=document.createElement('span');s.className='ch';s.style.setProperty('--i',i);s.setAttribute('aria-hidden','true');s.textContent=c===' '?' ':c;chars.append(s);});}

// ---- Cards get a gentle row stagger before the observer sees them ----
const grid=$('#pieces'), items=$$('li',grid||document);
items.forEach((li,i)=>{li.setAttribute('data-reveal','');li.style.setProperty('--i',i%4);});

// ---- One-shot reveals ----
const seen=new WeakSet();
const reveal=el=>{if(seen.has(el))return;seen.add(el);el.classList.add('is-in');
  // card reveals must not keep a transform transition: it would fight the filter animation
  if(el.matches('.pieces li'))setTimeout(()=>{el.removeAttribute('data-reveal');el.style.removeProperty('--i');},1600);};
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    // an element already above the viewport (reload mid-page) is shown at once, so scrolling back up never meets hidden content
    if(e.isIntersecting||e.boundingClientRect.top<0){reveal(e.target);io.unobserve(e.target);}
  }),{rootMargin:'0px 0px -6% 0px',threshold:.1});
  $$('[data-reveal],.chars').forEach(el=>io.observe(el));
  const foot=$('.sbd-footer');if(foot)new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting||e.boundingClientRect.top<0){foot.classList.add('is-in');o.disconnect();}}),{threshold:.08}).observe($('.foot-rule'));
}else{$$('[data-reveal],.chars').forEach(el=>el.classList.add('is-in'));$('.sbd-footer')?.classList.add('is-in');}

// ---- Safety sweep: a jump (menu link, reload mid-page, fast fling) can skip an element without the observer ever seeing it cross.
// Once scrolling pauses, anything at or above the viewport bottom is shown, so scrolling back up never meets hidden content. ----
let sweepT=0;
function sweep(){
  $$('[data-reveal]:not(.is-in),.chars:not(.is-in)').forEach(el=>{if(el.getBoundingClientRect().top<innerHeight*.98)reveal(el);});
  const f=$('.sbd-footer'),r=$('.foot-rule');
  if(f&&r&&!f.classList.contains('is-in')&&r.getBoundingClientRect().top<innerHeight*.98)f.classList.add('is-in');
}
addEventListener('scroll',()=>{clearTimeout(sweepT);sweepT=setTimeout(sweep,140);},{passive:true});
addEventListener('hashchange',()=>setTimeout(sweep,200));

// ---- Selection filter (chips) ----
const chips=$$('.chip'), live=$('#shop-live');
const labels={all:'All',clothes:'Clothes',dresses:'Dresses',bags:'Bags',accessories:'Accessories'};
let current='all', ticking=false;
const cols=()=>phoneQ.matches?2:4;
function layout(){let k=0;items.forEach(li=>{if(li.hidden)return;li.classList.toggle('drop',(k%cols())%2===1);k++;});}
function apply(f,{animate=true,push=true}={}){
  if(!labels[f])f='all';
  const first=new Map(items.filter(li=>!li.hidden).map(li=>[li,li.getBoundingClientRect()]));
  items.forEach(li=>li.getAnimations().forEach(a=>a.cancel()));        // interruptible: restart from the current state
  items.forEach(li=>{li.hidden=!(f==='all'||li.dataset.cat===f);});
  layout();current=f;
  const go=animate&&!reducedQ.matches;let shown=0;
  items.forEach(li=>{
    if(li.hidden)return;shown++;
    if(!go)return;
    const fr=first.get(li),last=li.getBoundingClientRect();
    if(fr){const dx=fr.left-last.left,dy=fr.top-last.top;if(dx||dy)li.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:650,easing:'cubic-bezier(.23,1,.32,1)'});}
    else li.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:600,delay:80,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'});
  });
  chips.forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.f===f)));
  if(live)live.textContent=`Showing ${shown} ${shown===1?'piece':'pieces'}${f==='all'?'':' in '+labels[f].toLowerCase()}`;
  if(push){try{const u=new URL(location.href);if(f==='all')u.searchParams.delete('cat');else u.searchParams.set('cat',f);history.replaceState(null,'',u);}catch(e){}}
}
chips.forEach(c=>c.addEventListener('click',()=>{apply(c.dataset.f);
  // keep the chosen chip in view inside the horizontal scroller
  c.scrollIntoView({block:'nearest',inline:'center',behavior:reducedQ.matches?'instant':'smooth'});}));
try{const q=new URL(location.href).searchParams.get('cat');if(q&&labels[q])apply(q,{animate:false,push:false});else layout();}catch(e){layout();}
phoneQ.addEventListener('change',()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{layout();ticking=false;});}});

// ---- Motion switch (pauses every automatic loop; the system setting wins) ----
const btn=$('#motion-toggle');
if(btn){
  let still=false;try{still=localStorage.getItem('sbd-still')==='1';}catch(e){}
  const set=v=>{still=v;root.classList.toggle('sbd-still',v);btn.setAttribute('aria-checked',String(!v));btn.textContent=v?'Motion: off':'Motion: on';try{localStorage.setItem('sbd-still',v?'1':'0');}catch(e){}};
  if(reducedQ.matches){btn.textContent='Motion: off (system setting)';btn.setAttribute('aria-checked','false');btn.disabled=true;}
  else{set(still);btn.addEventListener('click',()=>set(!still));}
}

// ---- Loops only run while they are on screen (saves battery; the pause switch still wins) ----
if('IntersectionObserver' in window){
  const loops=$$('.mq,.look-pan,.column-one,.column-two,.column-three,.landscape-frame img,.portrait-frame img');
  const lio=new IntersectionObserver(es=>es.forEach(e=>{e.target.style.animationPlayState=e.isIntersecting?'':'paused';}),{rootMargin:'120px 0px'});
  loops.forEach(el=>lio.observe(el));
}

// ---- Newsletter (a preview: nothing is sent) ----
const form=$('#list-form');
if(form){const input=$('#list-email'),status=$('#list-status');
  form.addEventListener('submit',e=>{e.preventDefault();
    if(input.checkValidity()&&input.value.trim()){status.textContent='Thank you. This is a preview, so nothing was sent or stored.';input.value='';}
    else{status.textContent='Please enter a valid e-mail address, for example name@example.com.';input.focus();}});}

// ---- In-page links on touch devices (desktop uses Lenis in app.js) ----
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a||(window.sbd&&window.sbd.lenis&&window.sbd.lenis()))return;
  if(a.closest('#sbd-menu'))return;                                         // the menu handles its own links
  const id=a.getAttribute('href');if(id.length<2)return;
  const el=document.querySelector(id);if(!el)return;
  e.preventDefault();el.scrollIntoView({behavior:reducedQ.matches?'instant':'smooth',block:'start'});
});
