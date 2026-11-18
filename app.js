const { useState, useMemo } = React;

const IMG_SIDENAV = "assets/sidenav.png";
const IMG_BASE    = "assets/vehicles/";

function parseCsvRow(line) {
  const result = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  result.push(field);
  return result;
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const headers = parseCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvRow(line);
    const row = {};
    headers.forEach((h, j) => { row[h] = values[j] !== undefined ? values[j] : ''; });
    rows.push(row);
  }
  return rows;
}

// Populated by init() before React renders
let VEHICLES = [], ACTIVE = [], INACTIVE_UNSOLD = [], INACTIVE_SOLD = [], HISTORY = [];


const PERF = [0.30,0.10,0.25,0.45,0.30,0.25,0.55,0.80,0.55,0.40,0.62,0.95,0.82,1.12,1.15,1.10,0.80,1.42,1.50,1.85,1.60,1.55,1.50,1.18,2.15,2.62,1.35,2.55,0.42,0.28,0.75,0.75,0.78,1.50,1.50,1.25,1.25,0.35,1.90,3.00,2.00,0.05,3.00];

const IMG_PLACEHOLDER = "assets/Vehicle-Placeholder.png";

function toHistoryP(p) {
  let out = '';
  if (p.includes('Sponsored')) out += 'P';
  if (p.includes('Social')) out += 'S';
  if (p.includes('Sort boost')) out += 'B';
  return out;
}
function toHistoryRow(v) {
  return { title: v.title, vin: v.vin, stock: v.stock, p: toHistoryP(v.p || []), status: v.status, days: v.act, range: v.range, sold: v.sold, image: v.image };
}

function fmt(n) { return (n||0).toLocaleString('en-US'); }
function mdStr(d) { return (d.getMonth()+1)+'/'+d.getDate(); }
function longDate(d) { return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function placeOrder(p) {
  const out = [];
  if (p.includes('P')) out.push('Sponsored');
  if (p.includes('S')) out.push('Social');
  if (p.includes('B')) out.push('Sort boost');
  return out.map((l) => ({ label: l }));
}
function chipLabel(p) { return p === 'Social' ? 'Social ad' : p === 'Sort boost' ? 'Sort boost' : 'Sponsored'; }
const REASON_SHORT = {
  'Turnaround pick': 'Underperforming and will be highly responsive to more exposure.',
  'Growth potential': 'More exposure could drive extra leads.',
  'Aging risk': 'Underperforming compared to similar cars in your market and at risk of aging.',
  'Reliable performer': 'A solid fit for extra visibility based on performance and demand.',
};
function signalsFor(v) {
  return [
    'On the lot ' + (v.days + v.act) + ' days' + ((v.days + v.act) > 30 ? ' — above your 32-day lot average' : ' — within your typical turn window'),
    (v.vdp === 'Pending' ? 'VDP views still being measured' : v.vdp + ' VDP views in the last 30 days') + (Number(v.vdp) < 10 ? ' — below similar inventory' : ' — tracking ahead of similar inventory'),
    v.reason.signal || 'Strong shopper demand for this model in your market',
  ];
}

// ── Sidebar
function Sidebar() {
  return (
    <aside className="vmx-scroll" style={{ width: 248, flex: '0 0 248px', background: '#0d1722', height: '100%', overflowY: 'auto' }}>
      <img src={IMG_SIDENAV} alt="Side navigation" style={{ display: 'block', width: 248, height: 'auto' }} />
    </aside>
  );
}

// ── Topbar
function Topbar() {
  return (
    <div id="vmx-topbar" style={{ height: 56, flex: '0 0 56px', background: '#fff', borderBottom: '1px solid #e8ebed', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 24px' }}>
      <button style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 11px', background: '#fff', border: '1px solid #d8dbde', borderRadius: 8, cursor: 'pointer' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d1722" strokeWidth="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5e6976" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <button style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 13px', background: '#fff', border: '1px solid #d8dbde', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#0d1722', fontWeight: 500 }}>
        Your Dealership
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5e6976" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </div>
  );
}

// ── Tabs
const TABS = [{ key: 'performance', label: 'Performance' }, { key: 'active', label: 'Active vehicles' }, { key: 'history', label: 'History' }];
function Tabs({ tab, onChange }) {
  return (
    <div style={{ borderBottom: '1px solid #d8dbde', display: 'flex', gap: 30, marginBottom: 24 }}>
      {TABS.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', padding: '0 2px 12px', color: tab === t.key ? '#0763d3' : '#5e6976', fontWeight: tab === t.key ? 600 : 400, borderBottom: '3px solid ' + (tab === t.key ? '#0763d3' : 'transparent'), marginBottom: -1 }}>{t.label}</button>
      ))}
    </div>
  );
}

// ── VoteButtons
function VoteButtons({ size = 15, vote, onVote }) {
  return (
    <>
      <button onClick={() => onVote('up')} style={{ background: vote === 'up' ? '#dcf7dd' : 'none', border: 'none', borderRadius: 6, padding: 3, cursor: 'pointer', display: 'flex', color: vote === 'up' ? '#078a0b' : '#9aa3ad' }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 10v11H4V10zM7 10l4-7c1.3 0 2 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 16.7 21H7"/></svg>
      </button>
      <button onClick={() => onVote('down')} style={{ background: vote === 'down' ? '#ffe2e2' : 'none', border: 'none', borderRadius: 6, padding: 3, cursor: 'pointer', display: 'flex', color: vote === 'down' ? '#dc1d34' : '#9aa3ad' }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 14V3h3v11zM17 14l-4 7c-1.3 0-2-1-2-2v-3H6a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 7.3 3H17"/></svg>
      </button>
    </>
  );
}

// ── VehicleThumb
function VehicleThumb({ size = 'sm', sold = false, image = null }) {
  const dims = size === 'sm' ? { w: 62, h: 46, icon: 30 } : { w: 58, h: 42, icon: 26 };
  return (
    <div style={{ width: dims.w, height: dims.h, flex: '0 0 ' + dims.w + 'px', borderRadius: 6, background: size === 'sm' ? '#e8ebed' : '#cdd3da', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {image
        ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <svg width={dims.icon} height={dims.icon} viewBox="0 0 24 24" fill="none" stroke={size === 'sm' ? '#a7adb5' : '#8a929c'} strokeWidth="1.4">
            <path d="M5 17h14l-1.4-5.2a2 2 0 0 0-1.9-1.4H8.3a2 2 0 0 0-1.9 1.4L5 17Z"/>
            {size === 'sm' && <path d="M5 17v2M19 17v2M3 13h2M19 13h2"/>}
            <circle cx="8" cy="17" r="1.4"/><circle cx="16" cy="17" r="1.4"/>
          </svg>}
      {sold && <span style={{ position: 'absolute', inset: 0, background: 'rgba(13,23,34,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '.5px' }}>SOLD</span>}
    </div>
  );
}

// ── PerfChart
const PC = { W:940, H:300, PL:40, PR:14, PT:16, PB:42, SPLIT:13, MAXY:3 };
PC.PW = PC.W-PC.PL-PC.PR; PC.PH = PC.H-PC.PT-PC.PB;
function dayLabel(i) { const d = i-PC.SPLIT; return d>0?'+'+d:String(d); }
function PerfChart({ values }) {
  const [hover, setHover] = useState(null);
  const n = values.length;
  const x = (i) => PC.PL + i*(PC.PW/(n-1));
  const y = (v) => PC.PT + PC.PH*(1-v/PC.MAXY);
  const baseY = y(0); const barW = PC.PW/(n-1);
  const seg = (a,b) => { const p=[]; for(let i=a;i<=b;i++) p.push([x(i),y(values[i])]); return p; };
  const before = seg(0,PC.SPLIT), after = seg(PC.SPLIT,n-1);
  const pts = (ps) => ps.map((p)=>p[0]+','+p[1]).join(' ');
  const area = (ps) => 'M'+ps[0][0]+' '+baseY+' L'+ps.map((p)=>p[0]+' '+p[1]).join(' L')+' L'+ps[ps.length-1][0]+' '+baseY+' Z';
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${PC.W} ${PC.H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {[0,1,2,3].map((v) => <line key={'g'+v} x1={PC.PL} x2={PC.W-PC.PR} y1={y(v)} y2={y(v)} stroke="#eceff2" strokeWidth={1}/>)}
        <line x1={x(PC.SPLIT)} x2={x(PC.SPLIT)} y1={PC.PT} y2={baseY} stroke="#9aa3ad" strokeWidth={1.5} strokeDasharray="5 4"/>
        <path d={area(before)} fill="rgba(245,51,63,.13)"/>
        <path d={area(after)} fill="rgba(4,153,253,.16)"/>
        <polyline points={pts(before)} fill="none" stroke="#f5333f" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round"/>
        <polyline points={pts(after)} fill="none" stroke="#0499fd" strokeWidth={2} strokeLinejoin="round"/>
        {[0,1,2,3].map((v) => <text key={'yl'+v} x={PC.PL-8} y={y(v)+4} textAnchor="end" fontSize={11} fill="#79828d" fontFamily="Graphik">{v}</text>)}
        {values.map((_,i) => <text key={'xl'+i} x={x(i)} y={PC.H-PC.PB+18} textAnchor="middle" fontSize={8.5} fill="#9aa3ad" fontFamily="Graphik">{dayLabel(i)}</text>)}
        {hover!=null && <circle cx={x(hover)} cy={y(values[hover])} r={4.5} fill={hover<PC.SPLIT?'#f5333f':'#0499fd'} stroke="#fff" strokeWidth={2}/>}
        {values.map((_,i) => <rect key={'bd'+i} x={x(i)-barW/2} y={PC.PT} width={barW} height={PC.PH} fill="transparent" onMouseEnter={() => setHover(i)}/>)}
      </svg>
      {hover!=null && (
        <div style={{ position: 'absolute', left:(x(hover)/PC.W)*100+'%', top:(y(values[hover])/PC.H)*100+'%', transform:'translate(-50%,-128%)', background:'#1b2530', color:'#fff', borderRadius:7, padding:'8px 11px', fontSize:12, whiteSpace:'nowrap', pointerEvents:'none', boxShadow:'0 4px 12px rgba(0,0,0,.25)' }}>
          <div style={{ fontWeight:600, marginBottom:3 }}>Day {dayLabel(hover)}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:9, height:9, borderRadius:2, background:hover<PC.SPLIT?'#f5333f':'#0499fd' }}/>
            VDP ({hover<PC.SPLIT?'Before':'After'}): {values[hover].toFixed(2)} avg/VIN
          </div>
        </div>
      )}
    </div>
  );
}

// ── PerformanceTab
const STATS = [{ label:'Cars promoted', value:'24' }, { label:'Onsite impressions', value:'20,604' }, { label:'Offsite impressions', value:'7,897' }, { label:'Total VDP views', value:'319' }];
function PerformanceTab() {
  return (
    <div style={{ animation:'vmxFade .25s ease' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18, marginBottom:20 }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 22px' }}>
            <div style={{ fontSize:13, color:'#5e6976', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:30, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#79828d', marginTop:14 }}>Last 30 days</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'16px 24px', borderBottom:'1px solid #e8ebed', fontWeight:500, fontSize:14 }}>VINMax impact on daily VDP views</div>
        <div style={{ padding:'24px 28px 26px' }}>
          <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:26, marginBottom:4 }}>+168% lift in VDP views</div>
          <div style={{ fontSize:14, color:'#5e6976', marginBottom:22 }}>Average daily VDP views per VIN before and after VINMax activation.</div>
          <div style={{ display:'flex' }}>
            <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:11, color:'#79828d', paddingRight:6, alignSelf:'center' }}>Average daily VDP views per VIN</div>
            <div style={{ flex:1, minWidth:0 }}><PerfChart values={PERF}/></div>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:28, marginTop:14, fontSize:12, color:'#3e4b5b' }}>
            <span style={{ display:'flex', alignItems:'center', gap:7 }}><span style={{ width:11, height:11, borderRadius:'50%', background:'#f5333f', display:'inline-block' }}/>Before activation</span>
            <span style={{ display:'flex', alignItems:'center', gap:7 }}><span style={{ width:11, height:11, borderRadius:'50%', background:'#0499fd', display:'inline-block' }}/>After activation</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DrawerChart
const DC = { W:520, H:210, PL:34, PR:10, PT:12, PB:26, SPLIT:14 };
DC.PW = DC.W-DC.PL-DC.PR; DC.PH = DC.H-DC.PT-DC.PB;
function chartDate(started, i) {
  const d = new Date(started);
  d.setDate(d.getDate() + (i - DC.SPLIT));
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function DrawerChart({ vdpTotal, chartData, started, onHover }) {
  const [hover, setHover] = useState(null);
  const values = chartData || (() => {
    const pre  = [0.18,0.21,0.24,0.27,0.30,0.32,0.34,0.35].map((f) => Math.round(vdpTotal*f));
    const post = [0.35,0.41,0.50,0.60,0.71,0.82,0.92,1.0].map((f) => Math.round(vdpTotal*f));
    return pre.concat(post.slice(1));
  })();
  const n = values.length;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const rawStep = (maxVal - minVal) / 6;
  const step = Math.ceil(rawStep / 10) * 10 || 10;
  const yMin = Math.floor(minVal / step) * step;
  const yMax = Math.ceil(maxVal / step) * step || step;
  const x = (i) => DC.PL+i*(DC.PW/(n-1));
  const y = (v) => DC.PT+DC.PH*(1-(v-yMin)/(yMax-yMin));
  const barW = DC.PW/(n-1);
  const seg = (a,b) => { const p=[]; for(let i=a;i<=b;i++) p.push(x(i)+','+y(values[i])); return p.join(' '); };
  const ticks = []; for(let t=yMin;t<=yMax;t+=step) ticks.push(t);
  const handleEnter = (i) => { setHover(i); onHover && onHover(i, values); };
  const handleLeave = () => { setHover(null); onHover && onHover(null, values); };
  return (
    <div style={{ position:'relative', width:'100%', marginTop:4 }}>
      <svg viewBox={`0 0 ${DC.W} ${DC.H}`} width="100%" style={{ display:'block', overflow:'visible' }} onMouseLeave={handleLeave}>
        {ticks.map((t) => (<g key={'g'+t}><line x1={DC.PL} x2={DC.W-DC.PR} y1={y(t)} y2={y(t)} stroke={t===yMin?'#9aa3ad':'#eceff2'} strokeWidth={t===yMin?1.5:1} strokeDasharray={t===yMin?undefined:'3 3'}/><text x={DC.PL-6} y={y(t)+3} textAnchor="end" fontSize={10} fill="#9aa3ad" fontFamily="Graphik">{t}</text></g>))}
        <line x1={x(DC.SPLIT)} x2={x(DC.SPLIT)} y1={DC.PT} y2={y(yMin)} stroke="#cdd3da" strokeWidth={1.2}/>
        <polyline points={seg(0,DC.SPLIT)} fill="none" stroke="#cdd3da" strokeWidth={2} strokeLinejoin="round"/>
        <polyline points={seg(DC.SPLIT,n-1)} fill="none" stroke="#0763d3" strokeWidth={2.4} strokeLinejoin="round"/>
        <text x={DC.PL} y={DC.H-6} textAnchor="start" fontSize={10} fill="#9aa3ad" fontFamily="Graphik">{started ? chartDate(started, 0) : ''}</text>
        <text x={x(DC.SPLIT)} y={DC.H-6} textAnchor="middle" fontSize={10} fill="#9aa3ad" fontFamily="Graphik">{started ? chartDate(started, DC.SPLIT) : ''}</text>
        <text x={DC.W-DC.PR} y={DC.H-6} textAnchor="end" fontSize={10} fill="#9aa3ad" fontFamily="Graphik">{started ? chartDate(started, n-1) : ''}</text>
        {hover!=null && <>
          <circle cx={x(hover)} cy={y(values[hover])} r={5} fill="#fff" stroke={hover<DC.SPLIT?'#9aa3ad':'#0763d3'} strokeWidth={1.5}/>
          <circle cx={x(hover)} cy={y(values[hover])} r={2.5} fill={hover<DC.SPLIT?'#9aa3ad':'#0763d3'}/>
        </>}
        {values.map((_,i) => <rect key={'b'+i} x={x(i)-barW/2} y={DC.PT} width={barW} height={DC.PH} fill="transparent" onMouseEnter={() => handleEnter(i)}/>)}
      </svg>
      {hover!=null && (
        <div style={{ position:'absolute', left:(x(hover)/DC.W)*100+'%', top:(y(values[hover])/DC.H)*100+'%', transform:'translate(-50%,-130%)', background:'#fff', border:'1px solid #d8dbde', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#0d1722', whiteSpace:'nowrap', pointerEvents:'none', boxShadow:'0 2px 8px rgba(13,23,34,.12)' }}>
          <div style={{ marginBottom:2, color:'#5e6976' }}>{chartDate(started, hover)}</div>
          <div style={{ fontWeight:600 }}>{values[hover]} views</div>
        </div>
      )}
    </div>
  );
}

// ── Shared small components
function CopyIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#79828d" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;
}
function IconButton({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{ width:32, height:32, border:'1px solid #d8dbde', background:'#fff', borderRadius:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {children}
    </button>
  );
}
function PlacementChip({ label, size = 'md' }) {
  const sm = size === 'sm';
  return <span style={{ background:'#e4f5fe', color:'#054998', fontSize: sm ? 11 : 12, fontWeight:500, padding: sm ? '3px 9px' : '4px 11px', borderRadius: sm ? 5 : 6, whiteSpace:'nowrap' }}>{label}</span>;
}
function MetricRow({ label, value, first = false }) {
  return <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginTop: first ? 0 : 10 }}><span style={{ color:'#5e6976' }}>{label}</span><span style={{ fontWeight:500 }}>{value}</span></div>;
}
function VINMaxStatusCard({ vehicle, prog, channels, reason, vote, onVote, cardStyle }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 22px', ...cardStyle }}>
      <div style={{ fontWeight:500, fontSize:15, marginBottom:14 }}>VINMax Status</div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ width:13, height:13, borderRadius:'50%', background:'#0763d3', display:'inline-block' }}/>
        <span style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:20 }}>Active: {vehicle.act} days</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, margin:'12px 0' }}>
        {channels.map((c) => <PlacementChip key={c.label} label={c.label}/>)}
      </div>
      <div style={{ height:7, borderRadius:6, background:'#e8ebed', overflow:'hidden', margin:'14px 0 12px' }}>
        <div style={{ height:'100%', width:Math.round(prog*100)+'%', background:'#0763d3', borderRadius:6 }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#5e6976' }}>
        <span>Started: <span style={{ fontWeight:500, color:'#0d1722' }}>{vehicle.started}</span></span>
        <span>Next review: <span style={{ fontWeight:500, color:'#0d1722' }}>{vehicle.review}</span></span>
      </div>
      <div style={{ fontWeight:500, fontSize:14, margin:'36px 0 10px' }}>Why we picked it</div>
      <div style={{ background:'linear-gradient(115.9deg,rgb(255,226,226) 0%,rgb(228,245,254) 100%)', borderRadius:8, padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:16, lineHeight:'24px', backgroundImage:'linear-gradient(95deg,#F5333F -23.99%,#05317B 55.84%,#0763D3 105.43%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{reason.tag}</div>
        <ExpandableText text={reason.text} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:13, fontSize:13, color:'#79828d' }}>
        Do you like this pick? <VoteButtons size={16} vote={vote} onVote={onVote}/>
      </div>
    </div>
  );
}
function useChartDisplay(chartHover, chartValues, vehicle) {
  const displayTotal = (chartHover != null && chartValues) ? chartValues[chartHover] : vehicle.vdpTotal;
  const displayGain  = (chartHover != null && chartValues && chartHover >= DC.SPLIT) ? chartValues[chartHover] - chartValues[DC.SPLIT] : (chartHover != null && chartHover < DC.SPLIT) ? 0 : vehicle.gain;
  const displayPct   = (chartHover != null && chartValues && chartHover >= DC.SPLIT && chartValues[DC.SPLIT] > 0) ? Math.round((chartValues[chartHover]-chartValues[DC.SPLIT])/chartValues[DC.SPLIT]*100) : (chartHover != null && chartHover < DC.SPLIT) ? 0 : vehicle.pct;
  const displayDate  = chartHover != null ? chartDate(vehicle.started, chartHover) : 'Today';
  const isBeforeSplit = chartHover != null && chartHover < DC.SPLIT;
  const showImpact = !isBeforeSplit;
  const baselineViews = chartValues ? chartValues[DC.SPLIT] : (vehicle.chartData ? vehicle.chartData[DC.SPLIT] : null);
  const showPct = showImpact && baselineViews != null && baselineViews > 0;
  return { displayTotal, displayGain, displayPct, displayDate, showImpact, showPct };
}

// ── ActiveVehiclesTab
const AV_COLS = '2.6fr .8fr .8fr 1.5fr 2.4fr';
const AV_COLS_WIDE = '2.6fr .8fr .8fr';
function ActiveVehiclesTab({ votes, onVote, onOpenDrawer, wide, activeId }) {
  const drawerOpen = wide && !!activeId;
  const cols = drawerOpen ? AV_COLS_WIDE : AV_COLS;
  const showExtra = !drawerOpen;
  return (
    <div style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'24px 26px', animation:'vmxFade .25s ease' }}>
      <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:20 }}>Boosting {ACTIVE.length} vehicles</div>
      <div style={{ fontSize:14, color:'#5e6976', margin:'6px 0 18px' }}>VINMax reviews your inventory every 14 days and picks the cars with the most room to improve. When a car sells, it's replaced automatically.</div>
      <div style={{ display:'grid', gridTemplateColumns:cols, gap:18, padding:'0 4px 10px', borderBottom:'1px solid #e8ebed', fontSize:12, fontWeight:500, color:'#3e4b5b' }}>
        <div style={{minWidth:280}}>Vehicle</div><div>Days on lot</div><div>VDP views</div>
        {showExtra && <><div>Placement</div><div style={{ display:'flex', alignItems:'flex-start', gap:4 }}>Why we picked it <img src={"assets/AI-icon.png"} alt="" style={{width:'1em',height:'1em',objectFit:'contain',marginTop:1}}/></div></>}
      </div>
      {ACTIVE.map((v, vi) => {
        const chips = placeOrder((v.p.includes('Sponsored')?'P':'')+(v.p.includes('Social')?'S':'')+(v.p.includes('Sort boost')?'B':''));
        const isActive = wide && activeId === v.id;
        const isLast = vi === ACTIVE.length - 1;
        return (
          <div key={v.id} onClick={() => onOpenDrawer(v.id)}
            style={{ display:'grid', gridTemplateColumns:cols, gap:18, padding:'16px 4px', borderBottom: isLast ? 'none' : '1px solid #f0f2f4', alignItems:'start', cursor: 'pointer', background: isActive ? '#f0f6ff' : 'transparent', borderRadius: isActive ? 8 : 0 }}>
            <div style={{ display:'flex', gap:12, minWidth:280 }}>
              <VehicleThumb size="sm" image={v.image}/>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, lineHeight:1.3 }}>{v.title}</div>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5, fontSize:13, color:'#3e4b5b' }}>
                  <img src={v.rating===2?"assets/deal-great.png":v.rating===3?"assets/deal-fair.png":"assets/deal-good.png"} alt='' style={{width:'1em',height:'1em',objectFit:'contain'}}/>
                  ${fmt(v.price)} · {fmt(v.mi)} mi
                </div>
              </div>
            </div>
            <div style={{ fontSize:13, color:'#3e4b5b' }}>{v.days + v.act} days</div>
            <div style={{ fontSize:13, color:'#3e4b5b' }}>{v.vdpTotal}</div>
            {showExtra && <>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignContent:'flex-start' }}>
                {chips.map((c) => <PlacementChip key={c.label} label={c.label} size="sm"/>)}
              </div>
              <div>
                <div style={{ fontSize:13, color:'#0d1722' }}><span style={{ fontWeight:500 }}>{v.reason.tag}:</span> {REASON_SHORT[v.reason.tag].charAt(0).toLowerCase() + REASON_SHORT[v.reason.tag].slice(1).replace(/\.$/, '')}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:12, color:'#79828d' }}>Do you like this pick? <VoteButtons vote={votes[v.id]} onVote={(dir) => onVote(v.id, dir)}/></div>
              </div>
            </>}
          </div>
        );
      })}
    </div>
  );
}

// ── HistoryTab
const HT_COLS = '3fr 1.7fr .9fr 1.2fr';
function statusStyle(s) { return s==='Active' ? { background:'#dcf7dd', color:'#078a0b', fontSize:12, fontWeight:500, padding:'3px 12px', borderRadius:6 } : { background:'#eceff2', color:'#5e6976', fontSize:12, fontWeight:500, padding:'3px 12px', borderRadius:6 }; }
function LinkIcon() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>; }
function FilterCheckbox({ label, count, checked, onClick }) {
  return (
    <label onClick={onClick} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', fontSize:13, color:'#3e4b5b', cursor:onClick?'pointer':'default' }}>
      <span style={{ display:'flex', alignItems:'center', gap:9 }}>
        <span style={{ width:16, height:16, border:'1.5px solid '+(checked?'#0763d3':'#79828d'), background:checked?'#0763d3':'transparent', borderRadius:4, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
          {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>}
        </span>
        {label}
      </span>
      <span style={{ color:'#79828d' }}>{count}</span>
    </label>
  );
}
function HistoryTab({ soldOnly, onToggleSold, search, onSearchChange }) {
  const { rows, counts } = useMemo(() => {
    let rows = HISTORY;
    if (soldOnly) rows = rows.filter((r) => r.sold);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.vin||'').toLowerCase().includes(q) || (r.stock||'').toLowerCase().includes(q));
    }
    const counts = {
      active: rows.filter((r) => r.status==='Active').length,
      inactive: rows.filter((r) => r.status==='Inactive').length,
      social: rows.filter((r) => r.p.includes('S')).length,
      sponsored: rows.filter((r) => r.p.includes('P')).length,
      sortboost: rows.filter((r) => r.p.includes('B')).length,
      sold: rows.filter((r) => r.sold).length,
    };
    return { rows, counts };
  }, [soldOnly, search]);
  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start', animation:'vmxFade .25s ease' }}>
      <div style={{ flex:1, minWidth:0, background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'24px 26px' }}>
        <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:20 }}>Promotion history</div>
        <div style={{ fontSize:14, color:'#5e6976', margin:'6px 0 18px' }}>Every car VINMax has promoted, including active placements and sold cars.</div>
        <div style={{ display:'grid', gridTemplateColumns:HT_COLS, gap:16, padding:'0 4px 10px', borderBottom:'1px solid #e8ebed', fontSize:12, fontWeight:500, color:'#3e4b5b' }}>
          <div style={{minWidth:200}}>Vehicle</div><div>Placement</div><div>Status</div><div>Duration</div>
        </div>
        {rows.map((r, i) => {
          const chips = placeOrder(r.p);
          return (
            <div key={(r.vin||'')+i} style={{ display:'grid', gridTemplateColumns:HT_COLS, gap:16, padding:'14px 4px', borderBottom: i < rows.length-1 ? '1px solid #f0f2f4' : 'none', alignItems:'center' }}>
              <div style={{ display:'flex', gap:12, alignItems:'center', minWidth:200 }}>
                <VehicleThumb size="lg" sold={r.sold} image={r.image}/>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, lineHeight:1.3 }}>{r.title}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:4, fontSize:11, color:'#0D1722' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:3, textDecoration:'underline', textUnderlineOffset:'2px' }}>{r.vin}<LinkIcon/></span>
                    <span style={{ display:'flex', alignItems:'center', gap:3, textDecoration:'underline', textUnderlineOffset:'2px' }}>{r.stock}<LinkIcon/></span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{chips.map((c) => <PlacementChip key={c.label} label={c.label} size="sm"/>)}</div>
              <div><span style={statusStyle(r.status)}>{r.status}</span></div>
              <div style={{ fontSize:13, color:'#0d1722' }}>{r.days} days<div style={{ fontSize:12, color:'#79828d', marginTop:2 }}>{r.range}</div></div>
            </div>
          );
        })}
      </div>
      <div style={{ width:'clamp(180px,22%,264px)', flexShrink:0, background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'22px 16px 26px' }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Search</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #d8dbde', borderRadius:8, padding:'9px 11px', marginBottom:22 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#79828d" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
          <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by VIN or vehi..." style={{ border:'none', outline:'none', fontSize:13, width:'100%', color:'#0d1722', background:'transparent' }}/>
        </div>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>Placement status</div>
        <FilterCheckbox label="Active" count={counts.active}/>
        <FilterCheckbox label="Inactive" count={counts.inactive}/>
        <div style={{ fontSize:13, fontWeight:500, margin:'18px 0 8px' }}>Placement type</div>
        <FilterCheckbox label="Social" count={counts.social}/>
        <FilterCheckbox label="Sponsored" count={counts.sponsored}/>
        <FilterCheckbox label="Sort boost" count={counts.sortboost}/>
        <div style={{ fontSize:13, fontWeight:500, margin:'18px 0 8px' }}>Listing status</div>
        <FilterCheckbox label="Sold" count={counts.sold} checked={soldOnly} onClick={onToggleSold}/>
      </div>
    </div>
  );
}

// ── useWide
function useWide() {
  const [wide, setWide] = React.useState(() => window.innerWidth >= 1280);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const handler = (e) => setWide(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return wide;
}

function ExpandableText({ text }) {
  const [expanded, setExpanded] = React.useState(false);
  if (expanded) {
    return <div style={{ fontSize:14, lineHeight:'18px', color:'#0d1722' }}>{text}</div>;
  }
  return (
    <div style={{ display:'flex', alignItems:'baseline', overflow:'hidden', fontSize:14, lineHeight:'18px', color:'#0d1722' }}>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{text}</span>
      <span style={{ flexShrink:0, whiteSpace:'nowrap', marginLeft:3 }}>…{' '}
        <span onClick={(e) => { e.stopPropagation(); setExpanded(true); }} style={{ textDecoration:'underline', cursor:'pointer' }}>more</span>
      </span>
    </div>
  );
}

// ── Drawer
function startShortDate(started) { const d = new Date(started); return (d.getMonth()+1)+'/'+d.getDate()+'/'+String(d.getFullYear()).slice(2); }
function Drawer({ vehicle, full, vote, onClose, onToggleFull, onVote, inline }) {
  const channels = vehicle.p.map((p) => ({ label: chipLabel(p) }));
  const reviewDays = vehicle.review.match(/\d+/) ? Number(vehicle.review.match(/\d+/)[0]) : 4;
  const prog = Math.min(0.95, vehicle.act/(vehicle.act+reviewDays));
  const activity = vehicle.p.map((p) => ({ label: chipLabel(p), start: startShortDate(vehicle.started), days: vehicle.act }));
  const [collapsed, setCollapsed] = React.useState(false);
  const [chartHover, setChartHover] = React.useState(null);
  const [chartValues, setChartValues] = React.useState(null);
  const handleChartHover = (i, vals) => { setChartHover(i); if (vals) setChartValues(vals); };
  const { displayTotal, displayGain, displayPct, displayDate, showImpact, showPct } = useChartDisplay(chartHover, chartValues, vehicle);
  const scrollRef = React.useRef(null);
  const handleScroll = () => setCollapsed(scrollRef.current.scrollTop > 10);
  React.useEffect(() => { setCollapsed(false); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [vehicle.id]);
  const drawerStyle = inline
    ? { width:'100%', height:'100%', background:'#f4f6f9', display:'flex', flexDirection:'column', borderLeft:'1px solid #e8ebed', animation:'vmxFade .2s ease' }
    : { position:'fixed', top:40, right:0, height:'calc(100dvh - 40px)', width:full?860:540, background:'#f4f6f9', display:'flex', flexDirection:'column', boxShadow:'-12px 0 40px rgba(13,23,34,.18)', zIndex:50, animation:'vmxSlide .28s cubic-bezier(.2,.6,.2,1)' };
  const expandBtn = <IconButton onClick={onToggleFull} title="Expand"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3e4b5b" strokeWidth="1.8"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></IconButton>;
  const closeBtn  = <IconButton onClick={onClose} title="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3e4b5b" strokeWidth="1.9"><path d="M18 6 6 18M6 6l12 12"/></svg></IconButton>;
  return (
    <>
      {!inline && <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(13,23,34,.32)', animation:'vmxFade .2s ease', zIndex:40 }}/>}
      <div style={drawerStyle}>
        <div style={{ flexShrink:0, background:'#f4f6f9', borderBottom:'1px solid #d8dbde', padding:'0 20px' }}>
          <div style={{ display:'flex', gap:12, alignItems: collapsed ? 'flex-start' : 'center', padding: collapsed ? '8px 0' : '12px 0' }}>
            <div style={{ width:collapsed?64:106, height:collapsed?48:80, flex:`0 0 ${collapsed?64:106}px`, borderRadius:4, overflow:'hidden', background:'#e8ebed', transition:'width .2s,height .2s' }}>
              <img src={vehicle.image} alt="vehicle" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap: collapsed ? 4 : 8 }}>
              {!collapsed ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:20, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{vehicle.title}</div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>{expandBtn}{closeBtn}</div>
                </div>
              ) : (
                <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:16, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vehicle.title}</div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, fontWeight:collapsed?400:600, color:'#0d1722', flexWrap:'wrap' }}>
                <img src={vehicle.rating===2?"assets/deal-great.png":vehicle.rating===3?"assets/deal-fair.png":"assets/deal-good.png"} alt='' style={{width:'1em',height:'1em',objectFit:'contain'}}/>
                <span>${fmt(vehicle.price)}</span>
                <span style={{ color:'#d8dbde' }}>·</span>
                <span>{fmt(vehicle.mi)} mi</span>
                <span style={{ color:'#d8dbde' }}>·</span>
                <span>{vehicle.days + vehicle.act} days on lot</span>
              </div>
              <div style={{ display:'flex', gap:12, fontSize:12, color:'#5e6976' }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>{vehicle.vin}<CopyIcon/></span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>{vehicle.stock}<CopyIcon/></span>
              </div>
            </div>
            {collapsed && <div style={{ display:'flex', gap:8, flexShrink:0, alignSelf:'center' }}>{expandBtn}{closeBtn}</div>}
          </div>
        </div>
        <div className="vmx-scroll" ref={scrollRef} onScroll={handleScroll} style={{ flex:1, overflowY:'auto' }}>
          <div style={{ padding:'22px 26px' }}>
            <div style={{ fontWeight:500, fontSize:15, marginBottom:12 }}>Listing activity</div>
            <MetricRow label="Saves" value={vehicle.saves} first/>
            <MetricRow label="Connections" value={vehicle.conns}/>
          </div>
          <VINMaxStatusCard vehicle={vehicle} prog={prog} channels={channels} reason={vehicle.reason} vote={vote} onVote={onVote} cardStyle={{ margin:'6px 18px' }}/>
          <div style={{ margin:'14px 18px', background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 22px' }}>
            <div style={{ fontWeight:500, fontSize:15, marginBottom:4 }}>Total VDP views</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, margin:'2px 0 0' }}>
              <span style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:48, lineHeight:1 }}>{displayTotal}</span>
              {showImpact && <span style={{ display:'flex', alignItems:'center', gap:5, color:'#078a0b', fontWeight:600, fontSize:16 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17 9 11l4 4 8-8M14 6h7v7"/></svg>
                +{displayGain} views{showPct ? ` (${displayPct}%)` : ''}
              </span>}
              {showImpact && <span style={{ fontSize:16, color:'#5e6976' }}>since activated</span>}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'14px 0 8px', fontSize:14, color:'#5e6976' }}>
              <span>{displayDate}</span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="16" height="2" viewBox="0 0 16 2"><line x1="0" y1="1" x2="16" y2="1" stroke="#0763d3" strokeWidth="2"/></svg>
                VINMax in effect
              </span>
            </div>
            <DrawerChart vdpTotal={vehicle.vdpTotal} chartData={vehicle.chartData} started={vehicle.started} onHover={handleChartHover}/>
          </div>
          <div style={{ margin:'14px 18px 30px', background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 22px' }}>
            <div style={{ fontWeight:500, fontSize:15, marginBottom:14 }}>VINMax Activity</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, fontSize:12, fontWeight:500, color:'#3e4b5b', paddingBottom:10, borderBottom:'1px solid #e8ebed' }}>
              <div>Placement</div><div>Start day</div><div>Active days</div>
            </div>
            {activity.map((a, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, fontSize:13, padding:'12px 0', borderBottom: i < activity.length-1 ? '1px solid #f0f2f4' : 'none' }}>
                <div>{a.label}</div><div style={{ color:'#3e4b5b' }}>{a.start}</div><div style={{ color:'#3e4b5b' }}>{a.days}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── VehicleFullPage
function VehicleFullPage({ vehicle, vote, onBack, onVote }) {
  const channels = vehicle.p.map((p) => ({ label: chipLabel(p) }));
  const reviewDays = vehicle.review.match(/\d+/) ? Number(vehicle.review.match(/\d+/)[0]) : 4;
  const prog = Math.min(0.95, vehicle.act/(vehicle.act+reviewDays));
  const activity = vehicle.p.map((p) => ({ label: chipLabel(p), start: startShortDate(vehicle.started), days: vehicle.act }));
  const [chartHover, setChartHover] = React.useState(null);
  const [chartValues, setChartValues] = React.useState(null);
  const handleChartHover = (i, vals) => { setChartHover(i); if (vals) setChartValues(vals); };
  const { displayTotal, displayGain, displayPct, displayDate, showImpact, showPct } = useChartDisplay(chartHover, chartValues, vehicle);
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'0 24px', height:52, background:'#f4f6f9', flexShrink:0 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:14, color:'#0d1722', fontFamily:'inherit', padding:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d1722" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
      </div>
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div className="vmx-scroll" style={{ width:360, flexShrink:0, background:'#f4f6f9', overflowY:'auto', padding:'24px' }}>
          {vehicle.image
            ? <img src={vehicle.image} alt="vehicle" style={{ width:'100%', borderRadius:8, marginBottom:16, objectFit:'cover', aspectRatio:'16/9' }}/>
            : <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:8, marginBottom:16, background:'#e8ebed' }}/>
          }
          <div style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:20, lineHeight:1.25, marginBottom:8 }}>{vehicle.title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, fontWeight:500, color:'#0d1722', marginBottom:6 }}>
            <img src={vehicle.rating===2?"assets/deal-great.png":vehicle.rating===3?"assets/deal-fair.png":"assets/deal-good.png"} alt='' style={{width:'1em',height:'1em',objectFit:'contain'}}/>
            <span>${fmt(vehicle.price)}</span>
            <span style={{ color:'#d8dbde' }}>·</span>
            <span>{fmt(vehicle.mi)} mi</span>
            <span style={{ color:'#d8dbde' }}>·</span>
            <span>{vehicle.days + vehicle.act} days on lot</span>
          </div>
          <div style={{ display:'flex', gap:12, fontSize:12, color:'#5e6976', marginBottom:20 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{vehicle.vin}<CopyIcon/></span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{vehicle.stock}<CopyIcon/></span>
          </div>
          <div style={{ fontWeight:500, fontSize:14, marginBottom:10, paddingTop:16, borderTop:'1px solid #f0f2f4' }}>Listing activity</div>
          <MetricRow label="Saves" value={vehicle.saves} first/>
          <MetricRow label="Connections" value={vehicle.conns}/>
        </div>
        <div className="vmx-scroll" style={{ flex:1, overflowY:'auto', background:'#f4f6f9', padding:'24px' }}>
          <VINMaxStatusCard vehicle={vehicle} prog={prog} channels={channels} reason={vehicle.reason} vote={vote} onVote={onVote} cardStyle={{ marginBottom:16, padding:'20px 24px' }}/>
          <div style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:15, marginBottom:4 }}>Total VDP views</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, margin:'2px 0 0' }}>
              <span style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:48, lineHeight:1 }}>{displayTotal}</span>
              {showImpact && <span style={{ display:'flex', alignItems:'center', gap:5, color:'#078a0b', fontWeight:600, fontSize:16 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17 9 11l4 4 8-8M14 6h7v7"/></svg>
                +{displayGain} views{showPct ? ` (${displayPct}%)` : ''}
              </span>}
              {showImpact && <span style={{ fontSize:16, color:'#5e6976' }}>since activated</span>}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'14px 0 8px', fontSize:14, color:'#5e6976' }}>
              <span>{displayDate}</span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <svg width="16" height="2" viewBox="0 0 16 2"><line x1="0" y1="1" x2="16" y2="1" stroke="#0763d3" strokeWidth="2"/></svg>
                VINMax in effect
              </span>
            </div>
            <DrawerChart vdpTotal={vehicle.vdpTotal} chartData={vehicle.chartData} started={vehicle.started} onHover={handleChartHover}/>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e8ebed', borderRadius:12, padding:'20px 24px', marginBottom:30 }}>
            <div style={{ fontWeight:500, fontSize:15, marginBottom:14 }}>VINMax Activity</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, fontSize:12, fontWeight:500, color:'#3e4b5b', paddingBottom:10, borderBottom:'1px solid #e8ebed' }}>
              <div>Placement</div><div>Start day</div><div>Active days</div>
            </div>
            {activity.map((a, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, fontSize:13, padding:'12px 0', borderBottom: i < activity.length-1 ? '1px solid #f0f2f4' : 'none' }}>
                <div>{a.label}</div><div style={{ color:'#3e4b5b' }}>{a.start}</div><div style={{ color:'#3e4b5b' }}>{a.days}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App
function App() {
  const [tab, setTab] = React.useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return ['performance','active','history'].includes(p) ? p : 'performance';
  });
  const changeTab = React.useCallback((t) => {
    setTab(t);
    const url = new URL(window.location);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url);
  }, []);
  const [drawerId, setDrawerId] = React.useState(() => new URLSearchParams(window.location.search).get('vehicle') || null);
  const [drawerFull, setDrawerFull] = React.useState(() => new URLSearchParams(window.location.search).get('view') === 'full');
  const [votes, setVotes] = useState({});
  const [soldOnly, setSoldOnly] = React.useState(() => new URLSearchParams(window.location.search).get('sold') === '1');
  const [search, setSearch] = useState('');
  const wide = useWide();
  const syncUrl = (params) => {
    const url = new URL(window.location);
    Object.entries(params).forEach(([k, v]) => v == null ? url.searchParams.delete(k) : url.searchParams.set(k, v));
    window.history.replaceState(null, '', url);
  };
  const openDrawer = (id) => { setDrawerId(id); setDrawerFull(false); syncUrl({ vehicle: id, view: null }); };
  const closeDrawer = () => { setDrawerId(null); setDrawerFull(false); syncUrl({ vehicle: null, view: null }); };
  React.useEffect(() => { window.vmxNav = { setTab: changeTab, openDrawer, closeDrawer, setSoldOnly }; });
  const vote = (id, dir) => setVotes((v) => ({ ...v, [id]: v[id]===dir?null:dir }));
  const drawerVehicle = drawerId ? ACTIVE.find((v) => v.id===drawerId) : null;
  const showInlineDrawer = wide && tab === 'active' && drawerVehicle;
  return (
    <div style={{ display:'flex', width:'clamp(1280px,100vw,1920px)', height:'calc(100dvh - 40px)', position:'relative', fontFamily:"'Graphik',Helvetica,Arial,sans-serif" }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'#f4f6f9', height:'100%' }}>
        <Topbar/>
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {drawerFull && drawerVehicle
            ? <VehicleFullPage vehicle={drawerVehicle} vote={votes[drawerVehicle.id]} onBack={() => { setDrawerFull(false); syncUrl({ view: null }); }} onVote={(dir) => vote(drawerVehicle.id, dir)}/>
            : <>
                <div className="vmx-scroll" style={{ flex:1, overflowY:'auto', padding:showInlineDrawer?'26px 18px 60px 36px':'26px 36px 60px', minWidth:0 }}>
                  <h1 style={{ fontFamily:"'Rund Display',sans-serif", fontWeight:600, fontSize:24, letterSpacing:'.2px', margin:'0 0 18px' }}>VINMax™</h1>
                  <Tabs tab={tab} onChange={changeTab}/>
                  {tab==='performance' && <PerformanceTab/>}
                  {tab==='active' && <ActiveVehiclesTab votes={votes} onVote={vote} onOpenDrawer={openDrawer} wide={wide} activeId={drawerId}/>}
                  {tab==='history' && <HistoryTab soldOnly={soldOnly} onToggleSold={() => setSoldOnly((s) => { const next=!s; syncUrl({ sold: next?'1':null }); return next; })} search={search} onSearchChange={setSearch}/>}
                </div>
                {showInlineDrawer && (
                  <div style={{ width:'clamp(480px,36vw,680px)', flex:'0 0 clamp(480px,36vw,680px)', height:'100%', overflow:'hidden', borderLeft:'1px solid #e8ebed', background:'#f4f6f9' }}>
                    <Drawer vehicle={drawerVehicle} full={false} vote={votes[drawerVehicle.id]} onClose={closeDrawer} onToggleFull={() => { setDrawerFull(true); syncUrl({ view: 'full' }); }} onVote={(dir) => vote(drawerVehicle.id, dir)} inline={true}/>
                  </div>
                )}
              </>
          }
        </div>
      </div>
      {!wide && drawerVehicle && !drawerFull && <Drawer vehicle={drawerVehicle} full={drawerFull} vote={votes[drawerVehicle.id]} onClose={closeDrawer} onToggleFull={() => { setDrawerFull((f) => { const next=!f; syncUrl({ view: next?'full':null }); return next; }); }} onVote={(dir) => vote(drawerVehicle.id, dir)}/>}
    </div>
  );
}

async function init() {
  const rootEl = document.getElementById('root');
  rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100dvh;font-family:Graphik,sans-serif;color:#9aa3ad;font-size:14px">Loading…</div>';
  try {
    const [vehiclesCsv, vdpCsv] = await Promise.all([
      fetch('data/vehicles.csv').then(r => r.text()),
      fetch('data/vdp-data.csv').then(r => r.text()),
    ]);

    // Build VDP map: VIN → { day → daily views }
    const vdpMap = {};
    for (const row of parseCsv(vdpCsv)) {
      const vin = row.vin, day = parseInt(row.day, 10), views = parseInt(row.views, 10) || 0;
      if (!vdpMap[vin]) vdpMap[vin] = {};
      vdpMap[vin][day] = views;
    }

    // Parse vehicles and compute chartData
    const rawVehicles = parseCsv(vehiclesCsv).map(r => {
      const act = parseInt(r.act) || 0;
      const v = {
        id: r.id || r.stock,
        active: r.active === 'true',
        title: r.title,
        image: r.image_file ? IMG_BASE + r.image_file : null,
        rating: parseInt(r.rating) || 1,
        price: r.price ? parseInt(r.price) : undefined,
        mi: r.mi ? parseInt(r.mi) : undefined,
        days: parseInt(r.days) || 0,
        act,
        p: r.placements ? r.placements.split('|') : [],
        drop: r.drop === 'true',
        vdp: r.vdp_label || undefined,
        saves: r.saves ? parseInt(r.saves) : undefined,
        conns: r.conns ? parseInt(r.conns) : undefined,
        review: r.review || undefined,
        vin: r.vin,
        stock: r.stock,
        endOffset: parseInt(r.end_offset) || 0,
        range: '',
        status: r.status,
        sold: r.sold === 'true',
        reason: r.reason_tag ? { tag: r.reason_tag, text: r.reason_text, signal: r.reason_signal } : undefined,
      };
      // Compute chartData from vdpMap if VIN has data and vehicle is active with act > 0
      if (v.vin && act > 0 && vdpMap[v.vin]) {
        const dayData = vdpMap[v.vin];
        const chartData = [];
        for (let i = 0; i < 7; i++) chartData.push(0); // days -14 to -8: zeros
        let cum = 0;
        for (let d = -7; d <= 0; d++) { cum += dayData[d] || 0; chartData.push(cum); }
        for (let d = 1; d <= act; d++) { cum += dayData[d] || 0; chartData.push(cum); }
        v.chartData = chartData;
        v.vdpTotal = cum;
        const atActivation = chartData[14]; // DC.SPLIT = 14
        v.gain = cum - atActivation;
        v.pct = atActivation > 0 ? Math.round(v.gain / atActivation * 100) : null;
      }
      // Compute live dates relative to today
      const _today = new Date();
      const _endDate = new Date(_today); _endDate.setDate(_today.getDate() - v.endOffset);
      const _startDate = new Date(_endDate); _startDate.setDate(_endDate.getDate() - v.act);
      v.started = longDate(_startDate);
      v.range = v.active ? mdStr(_startDate)+' - Today' : mdStr(_startDate)+' - '+mdStr(_endDate);
      return v;
    });

    const INACTIVE_IMG_POOL = [
      IMG_BASE+"bmw-540i-black.png", IMG_BASE+"jeep-wrangler-blue.png", IMG_BASE+"volvo-xc40-yellow.png",
      IMG_BASE+"kia-telluride-2023.png", IMG_BASE+"ram-1500-crew.png",
      IMG_BASE+"audi-a4-2021.png", IMG_BASE+"ford-f150-2022.png",
    ];

    VEHICLES = rawVehicles.map(v => ({ ...v, image: v.image || IMG_PLACEHOLDER }));
    ACTIVE = VEHICLES.filter(v => v.active && v.image !== IMG_PLACEHOLDER).slice(0, 10);
    INACTIVE_UNSOLD = VEHICLES.filter(v => !v.active && !v.sold).slice(0, 7)
      .map((v, i) => ({ ...v, image: INACTIVE_IMG_POOL[i] }));
    INACTIVE_SOLD = VEHICLES.filter(v => !v.active && v.sold).slice(0, 7)
      .map(v => ({ ...v, image: null }));
    HISTORY = [
      ...ACTIVE.map(toHistoryRow),
      ...INACTIVE_UNSOLD.map(toHistoryRow),
      ...INACTIVE_SOLD.map(toHistoryRow),
    ];

    window.vmxActive = ACTIVE;
    ReactDOM.createRoot(rootEl).render(<App/>);
  } catch (err) {
    document.getElementById('root').innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#666;max-width:500px"><b style="color:#c00">Could not load data</b><br><br>${err.message}<br><br>This page must be served over HTTP. Run <code>bash start.sh</code> from the project folder, or: <code>python3 -m http.server 7432</code> then open <a href="http://localhost:7432/vinmax-demo.html">http://localhost:7432/vinmax-demo.html</a></div>`;
    console.error(err);
  }
}
init();
