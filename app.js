import Lenis from './assets/vendor/lenis.mjs';
import {DURATION,GEOMETRY,stateAt,progress,clamp,smooth,expoOut,sample,LOGO_TRACK_TOP,LOGO_TRACK_MIDDLE} from './motion.js';
// Kove engine (one reversible clock, see motion.js) re-aimed for Sif Benedicta (from the Anna María build).
// Desktop: the loader segment (6.8 s → end) plays once on arrival, then scroll drives 0 → 6.65 s:
// identity, opposing columns, ROOM / SKETCHBOOK spread, and the black wipe that hands over to the black About section.
// Mobile: the loader plays as a fixed intro; the stage is a stack and only the columns counter-move.
const $=id=>document.getElementById(id);
const stage=$('stage'), world=$('world'), hero=$('hero'), loader=$('loader'), pin=$('pin');
const cue=$('scroll-cue'), cueIn=$('scroll-cue-in'), cta=$('hero-cta'), ctaIn=$('hero-cta-in');
const columns=[$('column-one'),$('column-two'),$('column-three')];
const tracks=[$('track-top'),$('track-middle'),$('track-bottom')];
const tpl=$('name-copy');
const copies=tracks.map(track=>Array.from({length:8},()=>{
  const mask=document.createElement('span');mask.className='logo-copy-mask';
  const svg=tpl.content.firstElementChild.cloneNode(true);mask.append(svg);track.append(mask);return svg;
}));
const desktopQuery=matchMedia('(min-width:900px) and (min-aspect-ratio:1/1)');
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let desktop=desktopQuery.matches, reduced=reducedQuery.matches;
// Scroll → clock pacing: the two pushes get most of the scroll, the settled spread a short read, the wipe a clear exit.
const SCROLL_MAP=[[0,0],[.30,1.5],[.38,2.33],[.68,4.0],[.80,5.42],[1,6.65]];
const SCROLL_END=6.65, INTRO_FROM=6.8, MOBILE_INTRO_END=10.3;
// The full loader is a first-arrival moment: once per session, never on reload mid-page or for reduced motion.
// The inline head script decides (before first paint, so the hero never flashes) and marks <html class="sbd-intro">.
const root=document.documentElement;
try{sessionStorage.setItem('sbd-intro','1');}catch(e){}
let mode=root.classList.contains('sbd-intro')&&!reduced?'intro':'scroll';
if(mode!=='intro')root.classList.remove('sbd-intro');
// Hold on black until the name face and the first photographs are ready (max 2.5 s), so nothing swaps mid-animation.
let ready=mode!=='intro';
if(!ready){
  const firstTiles=[...document.querySelectorAll('.photo-column img')].slice(0,6).map(i=>i.decode?i.decode().catch(()=>{}):null);
  Promise.race([Promise.all([document.fonts.ready,...firstTiles]),new Promise(r=>setTimeout(r,2500))]).then(()=>{ready=true;last=0;paint();});
}
let t=mode==='intro'?INTRO_FROM:0, target=0, introSpeed=1, last=0, raf=0, w=0, h=0, vh=innerHeight, loaderFade=1;
// Lenis smooth scroll: desktop with a fine pointer only (phones keep native scroll and the iOS toolbar).
// It runs inside this file's single rAF loop; while it is active the stage follows its position directly.
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
let lenis=null, lenisLast=0;
function setupLenis(){
  const want=desktop&&finePointer.matches&&!reduced;
  if(want&&!lenis){lenis=new Lenis({lerp:.075,smoothWheel:true,wheelMultiplier:.9,autoRaf:false,anchors:false});lenis.on('scroll',paint);if(mode==='intro')lenis.stop();}
  else if(!want&&lenis){lenis.destroy();lenis=null;}
}
// Every per-frame style write goes through a cache: an unchanged value costs nothing (no style invalidation).
const setTf=(el,v)=>{if(el._tf!==v){el._tf=v;el.style.transform=v;}};
const r2=n=>Math.round(n*100)/100;
const tx=(el,x,y=0)=>setTf(el,`translate3d(${r2(x)}px,${r2(y)}px,0)`);
const op=(el,n)=>{const v=String(Math.round(n*1000)/1000);if(el._op!==v){el._op=v;el.style.opacity=v;}};

const ease3=p=>1-Math.pow(1-p,3);
// Per-character masks: SINCE on the stage, Skólavörðustígur 3 in Visit. Each letter rises out of its own line.
function splitChars(el){const txt=el.textContent;el.textContent='';return [...txt].map(c=>{const s=document.createElement('span');s.className='ch';s.setAttribute('aria-hidden','true');s.textContent=c===' '?'\u00a0':c;el.append(s);return s;});}
const sinceEl=$('since'), sinceChars=splitChars(sinceEl);
const landImg=document.querySelector('.landscape-frame img'), portImg=$('portrait-img');
// Desktop header: name slot + current-section marker. Elements are cached; writes happen only on change.
const head=$('sbd-head'), headName=$('head-name'), headLinks=[...head.querySelectorAll('[data-sec]')];
const sections=headLinks.map(a=>$(a.dataset.sec));
const toneEls=[...document.querySelectorAll('main>section[id], .sbd-footer')].filter(el=>el.id!=='pin');
let headCurrent=null, headH=60;const headLink=head.querySelector('.head-name');

// Loader geometry: every repeated copy is the logo itself (monogram + wordmark) at the lockup's exact size, and the middle track is
// solved so its copy no. 2 stops dead centre on the lockup's name lines. Track speeds keep Kove's curves, scaled by k.
const loaderLogo=$('loader-logo'), heroFootP=$('hero-footer').querySelector('p');let geo=null;
function measure(){
  headH=innerHeight*.064+Math.max(innerWidth*.0115,15)*1.4;
  const r=(desktop?stage:loader).getBoundingClientRect();w=r.width||innerWidth;h=r.height||innerHeight;vh=innerHeight;
  if(!loader.isConnected||!w)return;
  const lw=loaderLogo.offsetWidth, H=loaderLogo.offsetHeight, gap=lw*.1805, k=lw/(GEOMETRY.logo*w);
  const baseX=w/2-k*sample(LOGO_TRACK_MIDDLE,99)*w-2*(lw+gap)-lw/2;
  // Lockup starts with its name block on the middle band's centre line, then lifts to its optical centre as the field opens.
  const shift=0; // the repeated copy IS the logo, so the lockup already sits on the middle band's centre line
  geo={lw,gap,k,baseX,shift};
  tracks.forEach(tr=>{tr.style.gap=gap+'px';});
  copies.flat().forEach(svg=>{svg.parentElement.style.width=lw+'px';});
}
function drawLoader(time,s){
  loader.style.display=s.bands?'block':'none';
  if(!s.bands)return;
  if(!geo||!geo.lw)measure();
  const middleScale=s.expansion>0?1+s.expansion*2:s.bandHeight;
  setTf($('band-light'),`scaleY(${r2(middleScale*1000)/1000})`);
  // Names are sibling layers of the light field, so the field grows without stretching type.
  const topX=sample(LOGO_TRACK_TOP,time), middleX=sample(LOGO_TRACK_MIDDLE,time);
  tracks.forEach((track,row)=>{
    tx(track,geo.baseX+geo.k*(row===1?middleX:topX-(row===2?.180392:0))*w);
    copies[row].forEach((svg,i)=>{
      const order=(i+6)%8;
      const enter=expoOut(progress(time,7.04+row*.11+order*.043,7.66+row*.11+order*.043));
      tx(svg,0,(1-enter)*h*.33);
    });
    op(track,1-s.logoResolve);
  });
  $('loader-logo').style.visibility=time>=9.31?'visible':'hidden';
  op($('loader-logo'),s.logoResolve);
  setTf(loaderLogo,`translate(-50%,calc(-50% + ${geo.shift*(1-smooth(progress(time,9.47,10.05)))}px))`);
  op($('loader-caption'),smooth(progress(time,9.76,10.1)));
}
function drawDesktop(time){
  const s=stateAt(time);
  tx(world,-s.pan*w);
  columns.forEach((c,i)=>tx(c,0,s.columns[i]*h));
  tx($('rail'),-(1-s.rail)*GEOMETRY.rail*w);op($('rail'),s.rail);
  tx($('collection-title'),(1-smooth(progress(time,2.58,3.48)))*.56*w);
  tx($('year'),-(1-smooth(progress(time,2.64,3.56)))*.325*w);
  // The spread's photograph settles as the panel arrives; the tall ring rises into its frame a beat later.
  const k=smooth(progress(s.pan,.62,1.121)), k2=smooth(progress(s.pan,.82,1.121));
  setTf(landImg,`translate3d(${(1-k)*-5}%,0,0) scale(${1.2-.2*k})`);
  setTf(portImg,`translate3d(0,${(1-k2)*7}%,0) scale(${1.28-.28*k2})`);
  sinceChars.forEach((c,i)=>{const e=ease3(progress(time,2.7+i*.07,3.45+i*.07));setTf(c,`translate3d(0,${(1-e)*105}%,0)`);});
  tx($('black-wipe'),0,time>=6.8?0:(1-s.wipe)*h*1.01);
  $('black-wipe').style.visibility=s.galleryEntrance?'hidden':'visible';
  drawLoader(time,s);
  if(s.galleryEntrance){
    // Same world returning to identity: the gallery enters from the right, the lockup recentres in its panel.
    tx(world,0);
    tx($('gallery'),(1-s.entrance)*(1-GEOMETRY.hero)*w);
    const centre=(.5-GEOMETRY.hero*.5)*(1-s.logoEntrance)*w;
    setTf($('hero-wordmark'),`translate(calc(-50% + ${r2(centre)}px),-50%)`);
    setTf(heroFootP,`translateX(calc(-50% + ${r2(centre)}px))`);
    tx($('hero-footer').lastElementChild,(1-s.entrance)*(1-GEOMETRY.hero)*w);
  }else{
    tx($('gallery'),0);
    setTf($('hero-wordmark'),'translate(-50%,-50%)');
    setTf(heroFootP,'translateX(-50%)');
    tx($('hero-footer').lastElementChild,0);
  }
  // The centre line is the loader caption's exact twin, so it stays; only the edge items and nav fade in.
  op($('hero-nav'),s.heroUI);[...$('hero-footer').children].forEach(ch=>op(ch,ch.tagName==='P'?1:s.heroUI));
  const hi=s.pan>.35, ci=!(s.pan>.9&&time<5.6);if(hero.inert!==hi)hero.inert=hi;const col=$('collection');if(col.inert!==ci)col.inert=ci;
}
function drawHead(secRects,pinEnd,toneRects){
  const s=stateAt(t), inPin=scrollY<pinEnd+2;
  // Arrives with the hero after the loader; constant from then on.
  op(head,mode==='intro'||mode==='hold'?(t>=10.82?s.heroUI:0):1);
  // One logo per screen: the name rises in once the big lockup has panned away, and steps aside while the rail carries it.
  const show=reduced?(inPin&&t<1?0:1):inPin?smooth(progress(s.pan,.28,.42))*(1-smooth(s.rail)):1;
  setTf(headName,`translate3d(0,${(1-show)*170}%,0)`);
  const ti=show>.5?0:-1;if(headLink.tabIndex!==ti)headLink.tabIndex=ti;
  // Bar mode once the stage has been wiped to black (or below the pin); tone = the section under the header's bottom edge.
  // Only in normal scrolling: during the intro the clock runs 6.8–12.2, which is NOT the end of the pin.
  const bar=mode==='scroll'&&(!inPin||t>=6.6), hb=headH;
  if(head.classList.contains('is-bar')!==bar)head.classList.toggle('is-bar',bar);
  let light=false;if(bar)toneRects.forEach((r,i)=>{if(r.top<=hb&&r.bottom>hb)light=!toneEls[i].matches('[data-tone="dark"]');});
  if(head.classList.contains('tone-light')!==light)head.classList.toggle('tone-light',light);
  // Current section = the one crossing 45% of the viewport.
  let cur=null;secRects.forEach((r,i)=>{if(r.top<=vh*.45&&r.bottom>vh*.45)cur=headLinks[i];});
  if(cur!==headCurrent){headCurrent?.removeAttribute('aria-current');cur?.setAttribute('aria-current','location');headCurrent=cur;}
}
function drawMobile(time){
  // Phones: only the one-time intro is clock-driven. Columns, marquees and reveals are CSS or IntersectionObserver, never scroll-linked.
  if(mode==='intro'||mode==='hold'){const s=stateAt(time);drawLoader(time,s);loader.style.display='block';}
  op(loader,smooth(loaderFade));
  // iOS: a hidden-but-present fixed loader can keep tinting Safari's chrome; remove it once the intro is over.
  if(loaderFade<=0&&mode!=='intro'&&loader.isConnected)loader.remove();
}
function tick(now){
  raf=0;
  if(document.hidden){last=0;return;}
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(lenis){
    // The loop sleeps when idle; on wake, give Lenis a one-frame delta so it does not jump the whole glide at once.
    if(!lenisLast||now-lenisLast>60)lenis.time=now-16.7;
    lenis.raf(now);lenisLast=now;
  }
  // ---- reads (all geometry before any write) ----
  const pinTop=pin.offsetTop, pinRange=Math.max(1,pin.offsetHeight-vh);
  const secRects=desktop?sections.map(el=>el.getBoundingClientRect()):null;
  const toneRects=desktop?toneEls.map(el=>el.getBoundingClientRect()):null;
  // ---- clock ----
  let busy=false;
  if(mode==='intro'){
    if(ready)t+=dt*introSpeed;busy=true;
    const end=desktop?DURATION:MOBILE_INTRO_END;
    if(t>=end){
      if(desktop){mode='scroll';t=0;}else{mode='scroll';t=end;}
      root.classList.remove('sbd-intro');lenis?.start();
    }
  }
  if(!desktop&&mode==='scroll'&&loaderFade>0){loaderFade=Math.max(0,loaderFade-dt/.45);busy=true;}
  if(desktop&&mode==='scroll'){
    const sp=clamp((scrollY-pinTop)/pinRange);
    // Reduced motion: three still states that swap instantly (identity, gallery, collection); no pan, no wipe.
    target=reduced?(sp<.34?0:sp<.67?1.6:4.6):sample(SCROLL_MAP,sp);
    const gap=target-t;
    // With Lenis the scroll itself is already eased, so the clock follows it 1:1 (no double smoothing).
    // Without it, a critically damped follow (~120 ms) makes wheel steps glide; reduced motion snaps.
    if(reduced||lenis||Math.abs(gap)<.0005)t=target;else{t+=gap*(1-Math.exp(-dt*18));busy=true;}
  }
  // ---- writes ----
  if(desktop)drawDesktop(t);else drawMobile(t);
  if(desktop)drawHead(secRects,pinTop+pin.offsetHeight-vh,toneRects);
  // Scroll cue and hero actions arrive once the reveal is over. Desktop: opacity tied to the pin (reversible). Phones: a plain class on first scroll, no per-frame work.
  {const on=mode==='scroll'&&(desktop||loaderFade<=.05);
   if(cueIn._on!==on){cueIn._on=on;cueIn.classList.toggle('is-on',on);ctaIn.classList.toggle('is-on',on);}
   if(desktop){const f=1-clamp((scrollY-pinTop)/(pinRange*.035));op(cue,f);op(cta,f);}}
  if(lenis&&lenis.isScrolling)busy=true;
  // Lenis emits 'scroll' inside lenis.raf → paint() may already have queued the next frame: never queue two.
  if(busy&&!raf)raf=requestAnimationFrame(tick);
}
function paint(){if(!raf)raf=requestAnimationFrame(tick);}
function hurry(){if(mode==='intro')introSpeed=3.5;}
let gone=false;
const goneCheck=()=>{const g=scrollY>60;if(g!==gone){gone=g;cue.classList.toggle('is-gone',g);cta.classList.toggle('is-gone',g);}};
addEventListener('scroll',()=>{hurry();if(desktop||mode==='intro')paint();else goneCheck();},{passive:true});
addEventListener('wheel',()=>{hurry();if(desktop)paint();},{passive:true});addEventListener('touchstart',hurry,{passive:true});addEventListener('keydown',hurry);addEventListener('pointerdown',hurry,{passive:true});
addEventListener('resize',()=>{const was=desktop;desktop=desktopQuery.matches;measure();if(was!==desktop){loaderFade=desktop?1:0;loader.style.opacity='';setupLenis();}paint();});
new ResizeObserver(()=>{measure();paint();}).observe(stage);
document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)paint();});
reducedQuery.addEventListener('change',e=>{reduced=e.matches;setupLenis();if(reduced&&mode==='intro'){mode='scroll';t=0;loaderFade=0;}paint();});

// Mobile menu: fixed-body scroll lock, instant restore (mobile chrome standard).
const burger=document.querySelector('.sbd-burger'), menu=$('sbd-menu');let lockY=0;
function setMenu(open,viaKey=false){
  burger.setAttribute('aria-expanded',String(open));menu.hidden=!open;
  if(open){lockY=scrollY;Object.assign(document.body.style,{position:'fixed',top:`-${lockY}px`,left:'0',right:'0'});
    // focus-guard: a pointer open focuses the panel itself (nothing highlighted), a keyboard open the first link.
    (viaKey?menu.querySelector('a'):menu).focus({preventScroll:true});}
  else{Object.assign(document.body.style,{position:'',top:'',left:'',right:''});scrollTo({top:lockY,behavior:'instant'});if(viaKey)burger.focus({preventScroll:true});}
}
burger.addEventListener('click',e=>setMenu(burger.getAttribute('aria-expanded')!=='true',e.detail===0));
menu.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();setMenu(false,e.detail===0);document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:reduced?'instant':'smooth'});});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)setMenu(false,true);});

if(reduced){mode='scroll';t=0;loaderFade=0;}
if(!desktop&&mode!=='intro')loaderFade=0;
// In-page links glide with Lenis. resize() first: the pinned stage changes the document height Lenis cached.
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a||!lenis)return;
  const el=document.querySelector(a.getAttribute('href'));if(!el)return;
  e.preventDefault();hurry();lenis.resize();
  lenis.scrollTo(el,{duration:1.6,easing:x=>x<.5?8*x*x*x*x:1-Math.pow(-2*x+2,4)/2});paint();
});
setupLenis();measure();paint();
// Decode every photograph in idle time once the first screen is up (one at a time), so none decodes mid-scroll.
(()=>{const imgs=[...document.images].filter(i=>!i.closest('#loader'));let k=0;
  const idle=window.requestIdleCallback||(f=>setTimeout(f,120));
  const next=()=>{if(k>=imgs.length)return;const im=imgs[k++];im.loading='eager';(im.decode?im.decode():Promise.resolve()).catch(()=>{}).then(()=>idle(next));};
  const start=()=>idle(next);(mode==='intro')?setTimeout(start,6000):setTimeout(start,800);})();
// QA hook: hold the clock at a time (intro frames) or release it back to scroll.
window.sbd={lenis:()=>lenis,state:()=>({mode,t,target,desktop,reduced,lenis:!!lenis,...stateAt(t)}),hold:x=>{mode='hold';t=x;loaderFade=1;paint();},release:()=>{mode='scroll';t=0;paint();}};
