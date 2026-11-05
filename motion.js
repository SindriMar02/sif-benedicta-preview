// Fitted to the supplied recording, not claimed original source-library settings.
// Fractions refer to the stationary stage. Seconds refer to the supplied clip.
export const DURATION = 12.203;
export const GEOMETRY = Object.freeze({hero: .574, column: .2, collection: .614, rail: .054, travel: 1.121, logo: .3405});
export const PAN = [
  [0,0],[.25,0],[.4167,.01471],[.5,.02696],[.5833,.06275],
  [.6667,.11667],[.75,.24657],[.8333,.29510],[1,.35539],
  [1.25,.395],[1.5,.40882],[2,.41225],[2.3333,.41225],
  [2.5,.43382],[2.6667,.48137],[2.75,.542],
  [2.8333,.62890],[2.9167,.776],[3,.88331],
  [3.1667,.98724],[3.3333,1.04214],[3.5,1.07547],
  [3.75,1.10586],[4,1.11616],[4.5,1.121],[5.42,1.121]
];
export const ENTRANCE = [[10.82,0],[10.8333,0.008052],[10.9167,0.024155],[11.0,0.050634],[11.0833,0.126573],[11.1667,0.235892],[11.25,0.555775],[11.3333,0.691573],[11.4167,0.803192],[11.5,0.851526],[11.5833,0.903286],[11.6667,0.928615],[11.75,0.95507],[11.8333,0.970047],[11.9167,0.985],[12.0,0.991901],[12.0833,0.998803],[12.15,1]];
export const EXPANSION = [[9.47,0],[9.5,.19474],[9.5833,.62105],[9.6667,.76842],[9.75,.88421],[9.8333,.92632],[9.9167,.96842],[10,.98421],[10.0833,1]];
export const LOGO_TRACK_TOP = [[7.65,.063],[7.8333,.03795],[8.3333,-.02774],[8.4167,-.0395],[8.8333,-.07381],[9.1667,-.09342],[9.31,-.1009]];
export const LOGO_TRACK_MIDDLE = [[7.65,.17],[7.8333,.195794],[8.3333,.26641],[8.4167,.279157],[8.8333,.31641],[9.1667,.33602],[9.31,.344]];
// Outer columns move DOWN, middle moves UP (fractions of stage height).
export const COLUMN_ONE=[[0,0],[.5,.018],[.85,.2],[1.6,.244],[2.4,.246],[2.75,.29],[3.4,.38],[4.5,.39]];
export const COLUMN_TWO=[[0,0],[.5,-.045],[.85,-.23],[1.6,-.288],[2.4,-.29],[2.75,-.32],[3.4,-.40],[4.5,-.41]];
export const COLUMN_THREE=[[0,0],[.5,.02],[.85,.22],[1.6,.26],[2.4,.263],[2.75,.30],[3.4,.39],[4.5,.40]];
export const clamp = (n, a=0, b=1) => Math.max(a,Math.min(b,n));
export const progress = (t,a,b) => clamp((t-a)/(b-a));
export const smooth = n => n*n*(3-2*n);
export const expoOut = n => n>=1?1:1-Math.pow(2,-10*n);
// Monotone cubic (Fritsch–Carlson) through the measured samples: every sample is still hit
// exactly and holds never overshoot, but velocity no longer jumps at each sample point.
const tangentCache=new WeakMap();
function tangents(points){
  let m=tangentCache.get(points);if(m)return m;
  const n=points.length, d=[];m=new Array(n).fill(0);
  for(let i=0;i<n-1;i++)d.push((points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]));
  m[0]=d[0]??0;m[n-1]=d[n-2]??0;
  for(let i=1;i<n-1;i++){
    if(d[i-1]*d[i]<=0)continue;
    const h0=points[i][0]-points[i-1][0], h1=points[i+1][0]-points[i][0];
    const w1=2*h1+h0, w2=h1+2*h0;
    m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);
  }
  // Endpoints follow the neighbouring segment but never exceed 3x its slope (no overshoot).
  for(const [i,k] of [[0,0],[n-1,n-2]]){if(m[i]*d[k]<=0||d[k]===0)m[i]=0;else if(Math.abs(m[i])>3*Math.abs(d[k]))m[i]=3*d[k];}
  tangentCache.set(points,m);return m;
}
export function sample(points,t) {
  if(t<=points[0][0]) return points[0][1];
  const m=tangents(points);
  for(let i=1;i<points.length;i++) {
    const [tb,b]=points[i], [ta,a]=points[i-1];
    if(t<=tb){
      const h=tb-ta, u=(t-ta)/h, u2=u*u, u3=u2*u;
      return (2*u3-3*u2+1)*a+(u3-2*u2+u)*h*m[i-1]+(-2*u3+3*u2)*b+(u3-u2)*h*m[i];
    }
  }
  return points.at(-1)[1];
}
export function phase(t) {
  if(t<.58)return 'Identity / counter-motion gallery';
  if(t<2.66)return 'Horizontal gallery / opposing columns';
  if(t<5.42)return 'VORLÍF / collection spread';
  if(t<6.8)return 'Full black wipe';
  if(t<9.32)return 'Three wordmark bands';
  if(t<10.82)return 'Center band expands / logo resolves';
  return 'Gallery enters / identity returns';
}
export function stateAt(t) {
  t=clamp(t,0,DURATION);
  const entrance = sample(ENTRANCE,t);
  const pan=t<6.8?sample(PAN,t):0;
  // Outer columns move DOWN, middle moves UP. Smooth residual motion continues at the drag stops.
  const y1=sample(COLUMN_ONE,t);
  const y2=sample(COLUMN_TWO,t);
  const y3=sample(COLUMN_THREE,t);
  const bands=t>=6.8 && t<10.82;
  return {
    t,pan,entrance,bands,
    galleryEntrance:t>=10.82,
    columns:t<6.8?[y1,y2,y3]:[(1-entrance)*-.75,(1-entrance)*.72,(1-entrance)*-.42],
    wipe:expoOut(progress(t,5.42,6.65)),
    rail:smooth(progress(pan,.97,1.118)),
    bandHeight:smooth(progress(t,6.83,7.7)),
    expansion:sample(EXPANSION,t),
    logoResolve:smooth(progress(t,9.31,9.61)),
    logoEntrance:entrance,
    heroUI:t>=10.82?expoOut(progress(t,10.83,11.3333)):1,
    phase:phase(t)
  };
}
