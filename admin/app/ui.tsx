"use client";

import * as Icons from "lucide-react";

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Comp = (Icons as unknown as Record<string, React.ElementType>)[name] || Icons.Circle;
  return <Comp size={size} />;
}

export function money(value?: number | null, currency?: string) {
  if (value === undefined || value === null) return "Hidden";
  const code = currency === "MYR" ? "RM" : currency || "";
  return `${code} ${Number(value).toLocaleString()}`.trim();
}

export function when(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function day(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function pretty(status?: string | null) {
  if (!status) return "—";
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function tone(status?: string) {
  const value = (status || "").toUpperCase();
  if (["LIVE", "ACTIVE", "PAID", "VERIFIED", "CONFIRMED", "ANSWERED", "OPERATIONAL", "APPROVED", "PASS", "READY", "PUBLISHED", "AVAILABLE", "RESPONDED", "MATCHED"].includes(value)) return "green";
  if (["SOLD", "ACKNOWLEDGED"].includes(value)) return "blue";
  if (["LET", "TRIAL", "PROCESSING"].includes(value)) return "purple";
  if (["OVERDUE", "FAILED", "REJECTED", "TAKEN_DOWN", "HIGH", "URGENT", "NO_SHOW", "DEACTIVATED", "CANCELLED", "PAST_DUE"].includes(value)) return "red";
  if (["UNDER_OFFER", "PENDING", "PENDING_REVIEW", "AWAITING", "AWAITING_CUSTOMER", "CHANGES_REQUESTED", "RESCHEDULE_PROPOSED", "DRAFT", "PARTIALLY_PAID", "INVESTIGATING", "DEGRADED", "SUBMITTED", "UNANSWERED"].includes(value)) return "amber";
  return "slate";
}

export function initials(name?: string) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function hue(name?: string) {
  const text = name || "";
  return `c${text.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6}`;
}

export function Avatar({ name, className = "" }: { name?: string; className?: string }) {
  return <span className={`ava sm ${hue(name)} ${className}`}>{initials(name)}</span>;
}

export function Who({ name, sub }: { name?: string; sub?: string }) {
  return <div className="who"><Avatar name={name} /><p><b>{name || "—"}</b>{sub && <small>{sub}</small>}</p></div>;
}

export function Thumb({ url }: { url?: string | null }) {
  return <div className="thumb" style={{ backgroundImage: url ? `url(${url})` : undefined }} />;
}

export function Badge({ children, status }: { children: React.ReactNode; status?: string }) {
  return <span className={`badge ${tone(status)}`}>{children}</span>;
}

export function Page({ code, title, sub, actions, crumb }: { code?: string; title: string; sub?: string; actions?: React.ReactNode; crumb?: React.ReactNode }) {
  return <div className="page-head"><div>{crumb}{code && <div className="crumb">{code}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="page-actions">{actions}</div></div>;
}

export function Metric({ icon, title, value, note, tone = "blue" }: { icon: string; title: string; value: React.ReactNode; note?: string; tone?: string }) {
  return <div className="stat card"><div className={`stat-icon ${tone}`}><Icon name={icon} size={22} /></div><div><span>{title}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></div>;
}

export function Metrics({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  return <div className={`stats ${cols === 5 ? "five" : cols === 6 ? "six" : cols === 3 ? "three" : ""}`}>{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="note"><Icons.Info size={16} /><span>{children}</span></div>;
}

export function Tabs({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="tabs">{items.map((item) => <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

export function Seg({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div className="seg">{items.map((item) => <button key={item.id} className={value === item.id ? "on" : ""} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}

export function Pager({ data, page, setPage }: { data: any; page: number; setPage: (n: number) => void }) {
  if (!data?.pageCount || data.pageCount <= 1) return <div className="pager"><span>{data?.total ?? 0} records</span></div>;
  return <div className="pager"><span>Showing page {data.page} of {data.pageCount} · {data.total} records</span><button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{data.page}</span><button className="btn outline sm" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>Next</button></div>;
}

export function Table({ columns, rows, onRow, active }: { columns: string[]; rows: React.ReactNode[][]; onRow?: (index: number) => void; active?: number }) {
  return <div className="card" style={{ overflowX: "auto" }}><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>
    {rows.length === 0 && <tr><td colSpan={columns.length}>No records match these filters.</td></tr>}
    {rows.map((row, index) => <tr key={index} className={`${onRow ? "clickable" : ""} ${active === index ? "on" : ""}`} onClick={() => onRow?.(index)}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
  </tbody></table></div>;
}

export function Select({ value, set, options, labels }: { value: string; set: (value: string) => void; options: string[]; labels?: string[] }) {
  return <select value={value} onChange={(event) => set(event.target.value)}>{options.map((option, index) => <option key={option || "any"} value={option}>{labels?.[index] || (option ? pretty(option) : "All")}</option>)}</select>;
}

export function Bars({ series, field = "views" }: { series: any[]; field?: string }) {
  const max = Math.max(1, ...series.map((point) => Number(point[field] || point.views || point.enquiries || 0)));
  return <div><div className="bars">{series.map((point) => <i key={point.date} title={`${point.date}: ${point[field] || point.views || point.enquiries || 0}`} style={{ height: `${Math.max(8, ((point[field] || point.views || point.enquiries || 0) / max) * 100)}%` }} />)}</div><div className="axis"><span>{series[0]?.date?.slice(5)}</span><span>{series[series.length - 1]?.date?.slice(5)}</span></div></div>;
}

export function Gate({ state, children }: { state: { loading: boolean; error: string; data: any }; children: (data: any) => React.ReactNode }) {
  if (state.loading) return <section className="card panel">Loading records…</section>;
  if (state.error) return <div className="error-box">{state.error}</div>;
  if (!state.data) return <section className="card panel empty">Nothing to show yet.</section>;
  return <>{children(state.data)}</>;
}
