import { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Legend
} from "recharts";

// ══════════════════════════════════════════════════════════════════
//  VERIFIED MATH ENGINE
//  Sources: Arps (1945) JPT Vol.1 | SPE PRMS 2018 | IEA/EIA data
// ══════════════════════════════════════════════════════════════════

function nominalDi(annualPct, b) {
  const d = Math.min(0.98, Math.max(0.001, annualPct / 100));
  if (b < 0.01) return -Math.log(1 - d) / 12;
  return (Math.pow(1 - d, -b) - 1) / (b * 12);
}

function qAtTime(qi, Di, b, t) {
  if (Di <= 0) return qi;
  if (b < 0.01) return qi * Math.exp(-Di * t);
  return qi / Math.pow(1 + b * Di * t, 1 / b);
}

function buildCurve(qi, annualPct, b, months = 72) {
  const Di = nominalDi(annualPct, b);
  return Array.from({ length: months + 1 }, (_, t) => ({
    month: t,
    rate: +Math.max(0, qAtTime(qi, Di, b, t)).toFixed(1),
  }));
}

function calcEL(fixedOpex, price, nri, varOpex) {
  const net = price * (nri / 100) - varOpex;
  if (net <= 0) return Infinity;
  return +(fixedOpex / (net * 30.44)).toFixed(2);
}

function calcLC(fixedOpex, varOpex, rateBOPD) {
  if (rateBOPD < 0.5) return 9999;
  return +(fixedOpex / (rateBOPD * 30.44) + varOpex).toFixed(2);
}

function calcCF(rateBOPD, price, nri, varOpex, fixedOpex) {
  return +(rateBOPD * 30.44 * price * (nri / 100) - fixedOpex - varOpex * rateBOPD * 30.44).toFixed(0);
}

function elCrossMonth(curve, el) {
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].rate < el) {
      const f = (el - curve[i - 1].rate) / (curve[i].rate - curve[i - 1].rate);
      return +(curve[i - 1].month + f).toFixed(1);
    }
  }
  return null;
}

function calcWO(wcost, preRate, postRate, price, nri, varOpex) {
  const net = price * (nri / 100) - varOpex;
  const dBOE = (postRate - preRate) * 30.44;
  if (dBOE <= 0 || net <= 0) return null;
  const incrCF = +(dBOE * net).toFixed(0);
  const payback = +(wcost / incrCF).toFixed(1);
  const r = 0.10 / 12;
  let npv = -wcost, cum = -wcost;
  const cfs = Array.from({ length: 36 }, (_, i) => {
    npv += incrCF / Math.pow(1 + r, i + 1);
    cum += incrCF;
    return { month: i + 1, incrCF, cumNet: +cum.toFixed(0) };
  });
  return { payback, npv: +npv.toFixed(0), incrCF, cfs };
}

function scoreField(rate, el, lc, decline) {
  if (!isFinite(el) || rate <= 0) return { total: 5, grade: "F", color: "#ef4444", s1: 0, s2: 0, s3: 0, s4: 0 };
  const s1 = Math.min(35, Math.max(0, ((rate - el) / el) * 100 * 0.5));
  const s2 = Math.min(30, Math.max(0, (60 - lc) / (60 - 22) * 30));
  const s3 = Math.min(20, Math.max(0, (60 - decline) / 60 * 20));
  const s4 = rate > el ? Math.min(15, ((rate - el) / rate) * 30) : 0;
  const total = Math.round(s1 + s2 + s3 + s4);
  return {
    total,
    grade: total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : total >= 35 ? "D" : "F",
    color: total >= 70 ? "#22c55e" : total >= 45 ? "#eab308" : "#ef4444",
    s1: Math.round(s1), s2: Math.round(s2), s3: Math.round(s3), s4: Math.round(s4),
  };
}

// ══════════════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ══════════════════════════════════════════════════════════════════
const T = {
  bg: "#060710", panel: "#0b0e18", border: "#16203a", borderHi: "#28375a",
  amber: "#f5a623", amberDim: "#c47a10", amberFaint: "rgba(245,166,35,0.09)",
  green: "#22c55e", greenFaint: "rgba(34,197,94,0.08)",
  red: "#ef4444", redFaint: "rgba(239,68,68,0.08)",
  yellow: "#f59e0b", blue: "#3b82f6",
  white: "#eaedf4", soft: "#b0bacc", muted: "#5a6a88",
  mono: "'Courier New', monospace", sans: "system-ui, sans-serif", serif: "Georgia, serif",
};
const BENCH_LC = 22;

// ══════════════════════════════════════════════════════════════════
//  GAUGE COMPONENT
// ══════════════════════════════════════════════════════════════════
function Gauge({ score, color, grade }) {
  const toXY = (deg, r) => ({
    x: 80 + r * Math.cos((deg - 90) * Math.PI / 180),
    y: 80 + r * Math.sin((deg - 90) * Math.PI / 180),
  });
  const sweep = 240, start = -120, end = start + sweep;
  const scored = start + (score / 100) * sweep;
  const arc = (a1, a2, r, large = 0) => {
    const s = toXY(a1, r), e = toXY(a2, r);
    return `M${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const needle = toXY(scored, 46);
  const zones = [
    { from: start, to: start + sweep * 0.35, fill: "#ef444455" },
    { from: start + sweep * 0.35, to: start + sweep * 0.65, fill: "#f59e0b55" },
    { from: start + sweep * 0.65, to: end, fill: "#22c55e55" },
  ];
  return (
    <svg viewBox="0 0 160 110" style={{ width: 160, height: 110 }}>
      {zones.map((z, i) => <path key={i} d={arc(z.from, z.to, 52, i === 2 ? 0 : 0)} fill="none" stroke={z.fill} strokeWidth="14" strokeLinecap="butt" />)}
      <path d={arc(start, end, 52, 1)} fill="none" stroke="#16203a" strokeWidth="12" strokeLinecap="round" />
      <path d={arc(start, scored - 0.5, 52, score > 50 ? 1 : 0)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" style={{ transition: "all 0.5s ease" }} />
      <line x1="80" y1="80" x2={needle.x} y2={needle.y} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ transition: "all 0.5s ease" }} />
      <circle cx="80" cy="80" r="5" fill={color} />
      <text x="80" y="74" textAnchor="middle" fill={T.white} fontSize="18" fontFamily={T.mono} fontWeight="700">{score}</text>
      <text x="80" y="87" textAnchor="middle" fill={color} fontSize="11" fontFamily={T.mono} fontWeight="700">GRADE {grade}</text>
      <text x="80" y="99" textAnchor="middle" fill={T.muted} fontSize="7" fontFamily={T.mono} letterSpacing="1.5">FIELD SCORE</text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
//  METRIC CARD
// ══════════════════════════════════════════════════════════════════
function MCard({ label, value, sub, color, info }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 14px", position: "relative", cursor: info ? "default" : "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, fontFamily: T.mono, letterSpacing: 2, color: T.muted, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
        {info && <span onClick={() => setOpen(!open)} style={{ fontSize: 11, color: T.muted, cursor: "pointer", userSelect: "none" }}>ℹ</span>}
      </div>
      <div style={{ fontSize: 20, fontFamily: T.mono, fontWeight: 700, color: color || T.amber, lineHeight: 1.1, marginBottom: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.soft, fontFamily: T.sans }}>{sub}</div>}
      {open && info && (
        <div onClick={() => setOpen(false)} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#0d1120", border: `1px solid ${T.amber}55`, borderRadius: 5, padding: "10px 12px", zIndex: 20, fontSize: 11.5, color: T.soft, fontFamily: T.sans, lineHeight: 1.65, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", cursor: "pointer" }}>
          {info}
        </div>
      )}
    </div>
  );
}

function SRow({ label, value, min, max, step, onChange, display, color }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontFamily: T.mono, letterSpacing: 1.5, color: T.muted, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: T.mono, color: color || T.amber }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: color || T.amber, cursor: "pointer", outline: "none" }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  CUSTOM TOOLTIP
// ══════════════════════════════════════════════════════════════════
function DeclineTip({ active, payload, label, el, price, nri, varOpex, fixedOpex }) {
  if (!active || !payload?.length) return null;
  const rate = payload.reduce((v, p) => p.value != null ? Math.max(v, p.value) : v, 0);
  const lc = rate > 0 ? calcLC(fixedOpex, varOpex, rate) : 999;
  const cf = rate > 0 ? calcCF(rate, price, nri, varOpex, fixedOpex) : 0;
  const above = rate >= el;
  return (
    <div style={{ background: "#090c16", border: `1px solid ${above ? T.green : T.red}55`, borderRadius: 5, padding: "10px 14px", fontFamily: T.mono, fontSize: 11, color: T.white, minWidth: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
      <div style={{ color: T.amber, marginBottom: 7, letterSpacing: 1, fontWeight: 700 }}>MONTH {label}</div>
      <div style={{ marginBottom: 3 }}>Production: <b style={{ color: T.white }}>{rate} BOPD</b></div>
      <div style={{ marginBottom: 3 }}>EL Threshold: <b style={{ color: above ? T.green : T.red }}>{isFinite(el) ? el.toFixed(0) : "∞"} BOPD</b></div>
      <div style={{ marginBottom: 3 }}>Lifting Cost: <b style={{ color: lc <= BENCH_LC ? T.green : lc <= 40 ? T.yellow : T.red }}>${lc}/BOE</b></div>
      <div>Monthly CF: <b style={{ color: cf > 0 ? T.green : T.red }}>${(cf / 1000).toFixed(1)}K/mo</b></div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  TAB 1 — DECLINE & ECONOMICS
// ══════════════════════════════════════════════════════════════════
function DeclineTab({ qi, setQi, decline, setDecline, b, setB, fixedOpex, setFixedOpex, varOpex, setVarOpex, price, setPrice, nri, setNri }) {
  const [priceMode, setPriceMode] = useState("base");
  const [snapshot, setSnapshot] = useState(null);
  const activePrice = priceMode === "bear" ? 55 : priceMode === "bull" ? 90 : price;

  const curve = useMemo(() => buildCurve(qi, decline, b, 72), [qi, decline, b]);
  const el = useMemo(() => calcEL(fixedOpex, activePrice, nri, varOpex), [fixedOpex, activePrice, nri, varOpex]);
  const elM = useMemo(() => elCrossMonth(curve, el), [curve, el]);
  const lc = useMemo(() => calcLC(fixedOpex, varOpex, qi), [fixedOpex, varOpex, qi]);
  const cf = useMemo(() => calcCF(qi, activePrice, nri, varOpex, fixedOpex), [qi, activePrice, nri, varOpex, fixedOpex]);
  const score = useMemo(() => scoreField(qi, el, lc, decline), [qi, el, lc, decline]);

  const chartData = useMemo(() => curve.map(pt => ({
    month: pt.month,
    rate: pt.rate,
    el: isFinite(el) ? +el.toFixed(1) : 0,
    aboveEL: pt.rate >= el ? pt.rate : undefined,
    belowEL: pt.rate < el ? pt.rate : undefined,
    snapEL: snapshot ? +snapshot.el.toFixed(1) : undefined,
  })), [curve, el, snapshot]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 18 }}>
      {/* Inputs */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>WELL PARAMETERS</div>
        <SRow label="Initial Rate (qi)" value={qi} min={20} max={2000} step={10} onChange={setQi} display={`${qi} BOPD`} />
        <SRow label="Annual Decline Rate" value={decline} min={3} max={80} step={1} onChange={setDecline}
          display={`${decline}%/yr`} color={decline > 50 ? T.red : decline > 30 ? T.yellow : T.green} />
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 7 }}>DECLINE TYPE (ARPS B-FACTOR)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {[["Exp", 0, "b = 0"], ["Hyp", 0.5, "b = 0.5"], ["Harm", 1, "b = 1"]].map(([n, v, s]) => (
              <button key={v} onClick={() => setB(v)} style={{
                background: b === v ? T.amber : "transparent", color: b === v ? "#000" : T.muted,
                border: `1px solid ${b === v ? T.amber : T.border}`, borderRadius: 4,
                padding: "7px 4px", fontFamily: T.mono, fontSize: 10, cursor: "pointer",
                transition: "all 0.2s",
              }}>
                <div style={{ fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>{s}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.sans, marginTop: 8, lineHeight: 1.5 }}>
            {b === 0 ? "Exponential: constant decline rate. Conservative — used for proved reserves." : b === 0.5 ? "Hyperbolic (b=0.5): most common for conventional reservoirs. Decline rate slows over time." : "Harmonic (b=1): special hyperbolic case. Typical in gravity drainage, solution gas drive."}
          </div>
        </div>
        <div style={{ height: 1, background: T.border, margin: "12px 0" }} />
        <div style={{ fontSize: 9, letterSpacing: 3, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>ECONOMICS</div>
        <div style={{ marginBottom: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: T.muted, fontFamily: T.mono, textTransform: "uppercase" }}>Fixed OPEX / Month</span>
            <span style={{ fontSize: 12, fontFamily: T.mono, color: T.amber }}>${(fixedOpex / 1000).toFixed(0)}K/mo</span>
          </div>
          <input type="number" value={fixedOpex} onChange={e => setFixedOpex(+e.target.value)} min={5000} max={5000000} step={5000}
            style={{ width: "100%", background: "#090c14", border: `1px solid ${T.border}`, borderRadius: 4, padding: "8px 10px", color: T.white, fontFamily: T.mono, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
        </div>
        <SRow label="Variable OPEX ($/BOE)" value={varOpex} min={1} max={40} step={0.5} onChange={setVarOpex} display={`$${varOpex}/BOE`} />
        <SRow label="Oil Price ($/BBL)" value={price} min={30} max={140} step={1} onChange={setPrice}
          display={`$${price}/bbl`} color={price < 50 ? T.red : price < 65 ? T.yellow : T.green} />
        <SRow label="Net Revenue Interest" value={nri} min={50} max={98} step={0.5} onChange={setNri} display={`${nri}%`} />
        <div style={{ height: 1, background: T.border, margin: "12px 0" }} />
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 8 }}>PRICE SCENARIO OVERRIDE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 12 }}>
          {[["Bear", "bear", "$55", T.red], ["Base", "base", `$${price}`, T.amber], ["Bull", "bull", "$90", T.green]].map(([l, v, p, c]) => (
            <button key={v} onClick={() => setPriceMode(v)} style={{
              background: priceMode === v ? c : "transparent", color: priceMode === v ? "#000" : T.muted,
              border: `1px solid ${priceMode === v ? c : T.border}`, borderRadius: 4,
              padding: "7px 4px", fontFamily: T.mono, fontSize: 10, cursor: "pointer", transition: "all 0.2s",
            }}>
              <div style={{ fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 9, marginTop: 2 }}>{p}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setSnapshot({ el, lc, cf, score: score.total })} style={{
          width: "100%", background: "transparent", border: `1px dashed ${T.borderHi}`, borderRadius: 4,
          padding: "8px", color: T.soft, fontFamily: T.mono, fontSize: 10, cursor: "pointer", letterSpacing: 1,
          textTransform: "uppercase",
        }}>
          {snapshot ? `✓ Snapshot Saved (EL ${snapshot.el.toFixed(0)} BOPD)` : "Save Snapshot for Comparison"}
        </button>
        {snapshot && (
          <button onClick={() => setSnapshot(null)} style={{ width: "100%", background: "transparent", border: "none", color: T.muted, fontFamily: T.mono, fontSize: 10, cursor: "pointer", marginTop: 4 }}>Clear snapshot</button>
        )}
      </div>

      {/* Output Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Metrics Row */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 12 }}>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gauge score={score.total} color={score.color} grade={score.grade} />
          </div>
          <MCard label="Economic Limit" value={isFinite(el) ? `${el.toFixed(0)} BOPD` : "∞"}
            sub={qi > el ? `+${(qi - el).toFixed(0)} bopd above EL` : "⚠ Below EL — value destroying"}
            color={qi > el ? T.green : T.red}
            info="EL = Fixed Monthly OPEX ÷ [(Price × NRI − Variable OPEX) × 30.44]. The minimum rate at which this asset generates positive operating cash flow. Below EL: every barrel produced loses money on a cash basis. SPE-standard definition." />
          <MCard label="Lifting Cost" value={`$${lc}/BOE`}
            sub={`Bench: $${BENCH_LC}/BOE | ${lc > BENCH_LC ? "+" : ""}${(lc - BENCH_LC).toFixed(0)} gap`}
            color={lc <= BENCH_LC ? T.green : lc <= 35 ? T.yellow : T.red}
            info="Total OPEX per BOE produced = (Fixed OPEX ÷ Monthly BOE) + Variable OPEX/BOE. $22/BOE benchmark is the approximate IEA/EIA average for conventional onshore assets. North Sea averages $15–28/BOE. Middle East: $3–8/BOE. Permian tight oil: $18–32/BOE." />
          <MCard label="Monthly Cash Flow" value={`$${(cf / 1000).toFixed(0)}K`}
            sub={cf > 0 ? "Operating CF positive" : "Operating CF negative"}
            color={cf > 0 ? T.green : T.red}
            info="Operating cash flow = Revenue − Total OPEX. Revenue = Production × Price × NRI. This is not accounting profit — it excludes DD&A, income tax, and CAPEX recovery. A positive value means the asset is covering its operating costs." />
          <MCard label="Time to EL" value={elM ? `${Math.floor(elM)} mo` : "> 72 mo"}
            sub={elM ? `Crosses EL at Month ${elM}` : "EL not crossed in forecast"}
            color={!elM ? T.green : elM < 12 ? T.red : elM < 36 ? T.yellow : T.green}
            info="The forecast month when production crosses below the Economic Limit, based on the Arps decline curve. After this point, continued operation at current cost structure destroys cash. Options: reduce OPEX, restore production, or plan shut-in/abandonment." />
        </div>

        {/* Decline Curve Chart */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 18px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase" }}>
              PRODUCTION DECLINE CURVE + ECONOMIC LIMIT — 72-MONTH FORECAST
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 10, fontFamily: T.mono, color: T.muted, flexWrap: "wrap" }}>
              <span>
                <span style={{ color: T.green }}>━</span> Economic Zone
              </span>
              <span>
                <span style={{ color: T.red }}>━</span> Sub-EL Zone
              </span>
              <span>
                <span style={{ color: T.amberDim }}>╌</span> EL Threshold
              </span>
              {snapshot && <span><span style={{ color: T.blue }}>╌</span> Snapshot EL</span>}
            </div>
          </div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, marginBottom: 12 }}>
            Arps ({b < 0.01 ? "Exponential" : b === 1 ? "Harmonic" : `Hyperbolic b=${b}`}) · qi={qi} BOPD · {decline}%/yr decline · {priceMode !== "base" ? `${priceMode.toUpperCase()} price scenario` : `Base $${price}/bbl`}
          </div>
          <ResponsiveContainer width="100%" height={255}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.green} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.green} stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.red} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.red} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="month" stroke={T.muted} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} tickLine={false}
                label={{ value: "Months", position: "insideBottomRight", fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} />
              <YAxis stroke={T.muted} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} tickLine={false} width={48}
                label={{ value: "BOPD", angle: -90, position: "insideLeft", fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} />
              <Tooltip content={<DeclineTip el={el} price={activePrice} nri={nri} varOpex={varOpex} fixedOpex={fixedOpex} />} />
              {isFinite(el) && (
                <ReferenceLine y={el} stroke={T.amberDim} strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `EL ${el.toFixed(0)} BOPD`, position: "insideTopRight", fill: T.amberDim, fontSize: 9, fontFamily: "Courier New" }} />
              )}
              {snapshot && (
                <ReferenceLine y={snapshot.el} stroke={T.blue} strokeDasharray="4 4" strokeWidth={1}
                  label={{ value: `Snap EL ${snapshot.el.toFixed(0)}`, position: "insideBottomRight", fill: T.blue, fontSize: 9, fontFamily: "Courier New" }} />
              )}
              {elM && (
                <ReferenceLine x={+elM.toFixed(0)} stroke={T.red} strokeDasharray="3 3" strokeWidth={1}
                  label={{ value: `Month ${elM}`, position: "insideTopLeft", fill: T.red, fontSize: 9, fontFamily: "Courier New" }} />
              )}
              <Area type="monotone" dataKey="aboveEL" stroke={T.green} strokeWidth={2.5} fill="url(#greenGrad)" dot={false} connectNulls={false} />
              <Area type="monotone" dataKey="belowEL" stroke={T.red} strokeWidth={2.5} fill="url(#redGrad)" dot={false} connectNulls={false} />
              {snapshot && <Line type="monotone" dataKey="snapEL" stroke={T.blue} strokeDasharray="4 3" strokeWidth={1} dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>

          {elM ? (
            <div style={{ marginTop: 10, background: T.redFaint, border: `1px solid ${T.red}33`, borderRadius: 5, padding: "8px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.red, fontFamily: T.mono }}>⚠ EL Crossing: Month {elM} (Year {(elM / 12).toFixed(1)}) · Rate at EL: {el.toFixed(0)} BOPD</span>
              <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>Lifting cost at crossing: ${calcLC(fixedOpex, varOpex, el).toFixed(0)}/BOE · Monthly CF: $0</span>
            </div>
          ) : (
            <div style={{ marginTop: 10, background: T.greenFaint, border: `1px solid ${T.green}33`, borderRadius: 5, padding: "8px 14px" }}>
              <span style={{ fontSize: 11, color: T.green, fontFamily: T.mono }}>✓ Production remains above EL throughout 72-month forecast at {priceMode} price. Field is economically viable in this scenario.</span>
            </div>
          )}

          {snapshot && (
            <div style={{ marginTop: 8, background: "rgba(59,130,246,0.07)", border: `1px solid ${T.blue}33`, borderRadius: 5, padding: "8px 14px", fontSize: 10, color: T.blue, fontFamily: T.mono, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <span>Snapshot EL: {snapshot.el.toFixed(0)} BOPD → Current EL: {isFinite(el) ? el.toFixed(0) : "∞"} BOPD ({((el - snapshot.el)).toFixed(0) > 0 ? "+" : ""}{(el - snapshot.el).toFixed(0)} Δ)</span>
              <span>Snapshot LC: ${snapshot.lc.toFixed(0)}/BOE → Current: ${lc.toFixed(0)}/BOE</span>
              <span>Score: {snapshot.score} → {score.total} ({score.total - snapshot.score > 0 ? "+" : ""}{score.total - snapshot.score} Δ)</span>
            </div>
          )}
        </div>

        {/* Score breakdown */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 12 }}>FIELD DIAGNOSTIC SCORE — BREAKDOWN (0–100)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "EL Margin", val: score.s1, max: 35, desc: "How far above EL as %" },
              { label: "Lifting Cost", val: score.s2, max: 30, desc: "vs $22/BOE benchmark" },
              { label: "Decline Health", val: score.s3, max: 20, desc: `${decline}%/yr vs 60% max` },
              { label: "CF Buffer", val: score.s4, max: 15, desc: "Production above EL %" },
            ].map(m => (
              <div key={m.label} style={{ background: "#090c14", borderRadius: 5, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontFamily: T.mono, fontWeight: 700, color: score.color }}>{m.val}</span>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>/ {m.max}</span>
                </div>
                <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(m.val / m.max) * 100}%`, background: score.color, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.sans, marginTop: 4 }}>{m.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: T.muted, fontFamily: T.sans, lineHeight: 1.5 }}>
            Field Diagnostic Score is a composite educational metric designed by Rahul Sharma for classroom use. It is not a published industry standard. Components are weighted to reflect relative importance of economic health indicators. It provides a teaching anchor, not an audit value.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  TAB 2 — COST DNA
// ══════════════════════════════════════════════════════════════════
const CATS = [
  { key: "labor", name: "Labor & Workforce", bench: 28, color: "#3b82f6", desc: "Direct operations staff, contractors, mobilization. Largely fixed in short term." },
  { key: "maint", name: "Maintenance & Integrity", bench: 30, color: T.amber, desc: "Planned/unplanned maintenance, well integrity, corrosion management, inspections." },
  { key: "energy", name: "Energy", bench: 15, color: "#a78bfa", desc: "Compression, ESP power, water injection pumps, facility utilities. Rises with declining pressure." },
  { key: "chem", name: "Chemicals", bench: 10, color: "#22c55e", desc: "Corrosion inhibitors, scale inhibitors, demulsifiers, biocides. Frequently over-dosed relative to need." },
  { key: "water", name: "Water Handling", bench: 8, color: "#06b6d4", desc: "Produced water treatment, re-injection, disposal. Grows with rising water cut in mature fields." },
  { key: "ga", name: "G&A & Overhead", bench: 9, color: "#f87171", desc: "Insurance, regulatory compliance, support services, allocated corporate overhead." },
];

function CostDNATab({ fixedOpex, varOpex, qi }) {
  const [cats, setCats] = useState({ labor: 28, maint: 30, energy: 15, chem: 10, water: 8, ga: 9 });
  const lc = calcLC(fixedOpex, varOpex, qi);
  const total = Object.values(cats).reduce((a, b) => a + b, 0);

  const chartData = CATS.map(c => ({
    name: c.name.split(" ")[0],
    fullName: c.name,
    yours: cats[c.key],
    bench: c.bench,
    gap: cats[c.key] - c.bench,
    color: c.color,
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 18 }}>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase" }}>OPEX BREAKDOWN (%)</div>
          <div style={{ fontSize: 12, fontFamily: T.mono, color: total === 100 ? T.green : total > 100 ? T.red : T.yellow }}>{total}% {total !== 100 && "(adjust to 100%)"}</div>
        </div>
        {CATS.map(c => (
          <div key={c.key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: T.white, fontFamily: T.sans }}>{c.name}</span>
              <span style={{ fontSize: 11, fontFamily: T.mono }}>
                <span style={{ color: c.color }}>{cats[c.key]}%</span>
                <span style={{ color: cats[c.key] > c.bench * 1.3 ? T.red : cats[c.key] > c.bench * 1.1 ? T.yellow : T.muted, fontSize: 10 }}>
                  &nbsp;({cats[c.key] > c.bench ? "+" : ""}{cats[c.key] - c.bench}%)
                </span>
              </span>
            </div>
            <input type="range" min={0} max={70} step={1} value={cats[c.key]}
              onChange={e => setCats(p => ({ ...p, [c.key]: +e.target.value }))}
              style={{ width: "100%", accentColor: c.color, cursor: "pointer", marginBottom: 3 }} />
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.sans, lineHeight: 1.4 }}>{c.desc}</div>
          </div>
        ))}
        <div style={{ height: 1, background: T.border, margin: "10px 0" }} />
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.sans, lineHeight: 1.6 }}>
          Benchmarks are approximate IEA / EIA ranges for conventional onshore assets. Individual fields vary based on age, reservoir, water cut, and geography. SPE PRMS category alignment.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>YOUR FIELD vs INDUSTRY BENCHMARK (%)</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" domain={[0, 70]} stroke={T.muted} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke={T.muted} tick={{ fill: T.soft, fontSize: 10, fontFamily: "Courier New" }} tickLine={false} width={70} />
              <Tooltip contentStyle={{ background: "#0a0d15", border: `1px solid ${T.amber}55`, fontFamily: "Courier New", fontSize: 11 }}
                formatter={(val, name, props) => [`${val}%`, name === "yours" ? "Your Field" : "Benchmark"]}
                labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label} />
              <Bar dataKey="bench" name="Benchmark" fill={T.border} barSize={7} radius={2} />
              <Bar dataKey="yours" name="Your Field" barSize={7} radius={2}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.yours > d.bench * 1.3 ? T.red : d.yours > d.bench * 1.1 ? T.yellow : T.green} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <MCard label="Your Lifting Cost" value={`$${lc.toFixed(1)}/BOE`}
            color={lc <= BENCH_LC ? T.green : lc <= 35 ? T.yellow : T.red}
            sub={`${lc > BENCH_LC ? "+" : ""}${(lc - BENCH_LC).toFixed(1)} vs $${BENCH_LC} benchmark`}
            info="Lifting cost = total OPEX per BOE produced. The $22/BOE benchmark is approximate for conventional onshore (IEA/EIA derived). Compare your number honestly — the gap IS the optimization opportunity." />
          <MCard label="Biggest Overspend"
            value={CATS.reduce((m, c) => (cats[c.key] - c.bench) > (cats[m.key] - m.bench) ? c : m, CATS[0]).name.split(" ")[0]}
            color={T.red}
            sub="category vs benchmark"
            info="The cost category with the largest positive deviation from its benchmark percentage. This is typically the first category to examine in an OPEX optimization review — though actual dollar impact depends on total OPEX." />
          <MCard label="Monthly Leakage"
            value={`$${Math.max(0, (lc - BENCH_LC) * qi * 30.44 / 1000).toFixed(0)}K/mo`}
            color={lc > BENCH_LC ? T.red : T.green}
            sub={lc > BENCH_LC ? "above benchmark run rate" : "at or below benchmark"}
            info="(Your LC − Benchmark LC) × Production × 30.44. The theoretical maximum additional value from a cost optimization program that brings lifting cost to benchmark. Actual achievable savings will be less — benchmark is an industry average, not a floor." />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  TAB 3 — WORKOVER ENGINE
// ══════════════════════════════════════════════════════════════════
function WorkoverTab({ qi, price, nri, varOpex, fixedOpex }) {
  const [wcost, setWcost] = useState(200000);
  const [postRate, setPostRate] = useState(Math.min(qi * 2, 2000));
  const [offline, setOffline] = useState(14);
  const el = calcEL(fixedOpex, price, nri, varOpex);
  const result = useMemo(() => calcWO(wcost, qi, postRate, price, nri, varOpex), [wcost, qi, postRate, price, nri, varOpex]);
  const deferral = +(qi * offline * price * (nri / 100)).toFixed(0);
  const totalCost = wcost + deferral;
  const adjPayback = result ? +(totalCost / result.incrCF).toFixed(1) : null;

  const dec = useMemo(() => {
    if (!result || postRate <= qi) return { label: "RATE UPLIFT REQUIRED", color: T.red, detail: "Post-workover rate must exceed current rate." };
    if (result.npv < 0) return { label: "DO NOT INVEST", color: T.red, detail: `NPV negative at 10% discount, 36-month horizon. Payback: ${result.payback} mo.` };
    if (result.payback > 24) return { label: "MONITOR", color: T.yellow, detail: `${result.payback}-month payback — marginal. NPV: $${(result.npv / 1000).toFixed(0)}K.` };
    return { label: "INVEST", color: T.green, detail: `${result.payback}-month payback. 36-mo NPV: $${(result.npv / 1000).toFixed(0)}K. Adj payback (+ deferral): ${adjPayback} mo.` };
  }, [result, postRate, qi, adjPayback]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>PRE-WORKOVER (CURRENT)</div>
          {[
            ["Current Rate", `${qi} BOPD`],
            ["Oil Price", `$${price}/bbl`],
            ["NRI", `${nri}%`],
            ["Economic Limit", `${isFinite(el) ? el.toFixed(0) : "∞"} BOPD`],
            ["Monthly CF", `$${(calcCF(qi, price, nri, varOpex, fixedOpex) / 1000).toFixed(0)}K`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12, fontFamily: T.mono }}>
              <span style={{ color: T.muted }}>{l}</span>
              <span style={{ color: T.white }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>WORKOVER PARAMETERS</div>
          <SRow label="Workover Cost ($)" value={wcost} min={10000} max={3000000} step={10000} onChange={setWcost} display={`$${(wcost / 1000).toFixed(0)}K`} />
          <SRow label="Expected Post-WO Rate" value={postRate} min={qi} max={Math.max(qi * 5, 500)} step={5} onChange={setPostRate} display={`${postRate} BOPD`} color={T.blue} />
          <SRow label="Days Offline (Deferral)" value={offline} min={0} max={60} step={1} onChange={setOffline} display={`${offline} days`} color={T.yellow} />
          <div style={{ background: "#090c14", borderRadius: 5, padding: "10px 12px", fontSize: 11, fontFamily: T.mono, color: T.muted, lineHeight: 1.7 }}>
            <div>Rate Uplift: <span style={{ color: T.blue }}>{postRate - qi} BOPD ({(((postRate - qi) / qi) * 100).toFixed(0)}%)</span></div>
            <div>Deferral Cost: <span style={{ color: T.yellow }}>${(deferral / 1000).toFixed(0)}K ({offline} d × {qi} BOPD × ${price} × {nri}% NRI)</span></div>
            <div>Total Investment: <span style={{ color: T.white }}>${(totalCost / 1000).toFixed(0)}K</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: T.panel, border: `2px solid ${dec.color}44`, borderRadius: 8, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 5 }}>WORKOVER RECOMMENDATION</div>
            <div style={{ fontSize: 28, fontFamily: T.mono, fontWeight: 700, color: dec.color, letterSpacing: 2 }}>{dec.label}</div>
            <div style={{ fontSize: 12, color: T.soft, fontFamily: T.sans, marginTop: 6, maxWidth: 320 }}>{dec.detail}</div>
          </div>
          {result && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["Simple Payback", `${result.payback} mo`, result.payback < 18 ? T.green : T.yellow],
                ["Adj Payback (+ deferral)", `${adjPayback} mo`, adjPayback && adjPayback < 18 ? T.green : T.yellow],
                ["36-Mo NPV (10% disc.)", `$${(result.npv / 1000).toFixed(0)}K`, result.npv > 0 ? T.green : T.red],
                ["Incremental CF/Mo", `$${(result.incrCF / 1000).toFixed(0)}K`, T.blue],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: "#090c14", borderRadius: 4, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: 0.5, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 17, fontFamily: T.mono, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {result && (
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 18px", flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 2.5, color: T.amber, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 14 }}>CUMULATIVE NET CASH FLOW — 36 MONTHS POST-WORKOVER</div>
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={result.cfs} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={result.npv > 0 ? T.green : T.red} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={result.npv > 0 ? T.green : T.red} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" stroke={T.muted} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} tickLine={false}
                  label={{ value: "Months Post-WO", position: "insideBottomRight", fill: T.muted, fontSize: 9 }} />
                <YAxis stroke={T.muted} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Courier New" }} tickLine={false} width={60}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "#0a0d15", border: `1px solid ${T.amber}55`, fontFamily: "Courier New", fontSize: 11 }}
                  formatter={v => [`$${(v / 1000).toFixed(0)}K`]} labelFormatter={l => `Month ${l}`} />
                <ReferenceLine y={0} stroke={T.muted} strokeDasharray="3 3" />
                <ReferenceLine y={-wcost} stroke={T.red} strokeDasharray="2 4" strokeWidth={1}
                  label={{ value: `WO Cost $${(wcost / 1000).toFixed(0)}K`, fill: T.red, fontSize: 9, fontFamily: "Courier New", position: "insideTopLeft" }} />
                <Area type="monotone" dataKey="cumNet" stroke={result.npv > 0 ? T.green : T.red} fill="url(#cfGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontSize: 10, color: T.muted, fontFamily: T.sans, lineHeight: 1.6 }}>
              NPV at 10% annual discount rate, 36-month horizon. Incremental production held constant post-WO (conservative). Deferral cost of ${(deferral / 1000).toFixed(0)}K is separate from WO cost — add for full investment picture. The ${(wcost / 1000).toFixed(0)}K reference line shows when cumulative CF recovers the WO cost (simple payback point).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState(0);
  const [qi, setQi] = useState(350);
  const [decline, setDecline] = useState(25);
  const [b, setB] = useState(0.5);
  const [fixedOpex, setFixedOpex] = useState(95000);
  const [varOpex, setVarOpex] = useState(8);
  const [price, setPrice] = useState(70);
  const [nri, setNri] = useState(80);
  const el = calcEL(fixedOpex, price, nri, varOpex);
  const lc = calcLC(fixedOpex, varOpex, qi);
  const cf = calcCF(qi, price, nri, varOpex, fixedOpex);
  const score = scoreField(qi, el, lc, decline);

  const shared = { qi, setQi, decline, setDecline, b, setB, fixedOpex, setFixedOpex, varOpex, setVarOpex, price, setPrice, nri, setNri };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.white, fontFamily: T.sans }}>
      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #060710 0%, #0a0e1c 100%)", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: T.amberDim, fontFamily: T.mono, textTransform: "uppercase", marginBottom: 4 }}>O&G FIELD INTELLIGENCE SIMULATOR · SPE-VERIFIED FORMULAS</div>
            <div style={{ fontSize: 26, fontFamily: T.serif, color: T.white, fontWeight: 700, letterSpacing: "-0.5px" }}>
              Field<span style={{ color: T.amber }}>Pulse</span>
              <span style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, marginLeft: 14, letterSpacing: 2, fontWeight: 400 }}>BY RAHUL SHARMA</span>
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 3, letterSpacing: 0.5 }}>
              Arps Decline Curves · Economic Limit Analysis · OPEX Benchmarking · Workover ROI · For 0–50 Year O&G Professionals
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 16px" }}>
              <Gauge score={score.total} color={score.color} grade={score.grade} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                ["EL", isFinite(el) ? `${el.toFixed(0)} BOPD` : "∞", qi > el ? T.green : T.red],
                ["LC", `$${lc.toFixed(0)}/BOE`, lc <= BENCH_LC ? T.green : lc <= 35 ? T.yellow : T.red],
                ["CF", `$${(cf / 1000).toFixed(0)}K/mo`, cf > 0 ? T.green : T.red],
              ].map(([l, v, c]) => (
                <div key={l} style={{ fontSize: 11, fontFamily: T.mono, color: T.muted }}>
                  <span style={{ letterSpacing: 1 }}>{l}: </span>
                  <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ background: "#08091060", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "stretch" }}>
          {[
            { label: "Decline & EL", sub: "Production Economics" },
            { label: "Cost DNA", sub: "OPEX Anatomy" },
            { label: "Workover Engine", sub: "Intervention ROI" },
          ].map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              padding: "12px 22px", background: "none", border: "none",
              borderBottom: tab === i ? `2px solid ${T.amber}` : "2px solid transparent",
              color: tab === i ? T.amber : T.muted, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
              transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: tab === i ? 700 : 400, letterSpacing: 0.5 }}>{t.label}</span>
              <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: 1, textTransform: "uppercase" }}>{t.sub}</span>
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 4 }}>
            <div style={{ fontSize: 9, fontFamily: T.mono, color: T.muted, display: "flex", gap: 16 }}>
              <span>EL: <b style={{ color: T.amber }}>{isFinite(el) ? el.toFixed(0) : "∞"} BOPD</b></span>
              <span>LC: <b style={{ color: T.amber }}>${lc.toFixed(0)}/BOE</b></span>
              <span>Score: <b style={{ color: score.color }}>{score.total}/100</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "22px 24px 72px" }}>
        {tab === 0 && <DeclineTab {...shared} />}
        {tab === 1 && <CostDNATab fixedOpex={fixedOpex} varOpex={varOpex} qi={qi} />}
        {tab === 2 && <WorkoverTab qi={qi} price={price} nri={nri} varOpex={varOpex} fixedOpex={fixedOpex} />}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 24px", display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
        {["Decline Curves: Arps (1945) JPT Vol.1", "EL Formula: SPE-Standard Economic Limit", "Benchmarks: IEA/EIA Conventional Onshore (Approx)", "NPV: 10% Annual Discount, 36-Mo Horizon", "Field Score: Educational Composite — Rahul Sharma"].map(s => (
          <span key={s} style={{ fontSize: 9, fontFamily: T.mono, color: T.muted, letterSpacing: 0.5 }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
