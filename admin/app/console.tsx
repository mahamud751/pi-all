"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { api, downloadCsv, loadSession, saveSession, uploadFile, type Session } from "./lib/api";
import { Avatar, Badge, Bars, Gate, Icon, Metric, Metrics, Note, Page, Pager, Select, Table, Tabs, Thumb, Who, day, money, pretty, tone, when } from "./ui";

import { routeFor, viewForPath, type View } from "./lib/routes";

type QueryState = { loading: boolean; error: string; data: any };
type Go = (view: View, id?: string) => void;

const agencyNav = [
  { label: "Dashboard", view: "dashboard", icon: "LayoutDashboard" },
  { label: "Properties", view: "properties", icon: "House" },
  { label: "Reels", view: "reels", icon: "Clapperboard" },
  { label: "Projects", view: "projects", icon: "BriefcaseBusiness" },
  { label: "Enquiries", view: "enquiries", icon: "MessageSquareText" },
  { label: "Appointments", view: "appointments", icon: "CalendarDays" },
  { label: "Insights", view: "insights", icon: "ChartNoAxesCombined" },
  { label: "Audience", view: "audience", icon: "Users" },
  { label: "Team", view: "team", icon: "UserRoundCog" },
  { label: "Approvals", view: "approvals", icon: "BadgeCheck" },
  { label: "Settings", view: "settings", icon: "Settings" },
] as const;

const officeNav = [
  { label: "Dashboard", view: "dashboard", icon: "LayoutDashboard" },
  { label: "Agencies", view: "agencies", icon: "Building2", section: "AGENCIES" },
  { label: "Agents", view: "agents", icon: "Users" },
  { label: "Properties", view: "properties", icon: "House" },
  { label: "Reported outcomes", view: "outcomes", icon: "ChartNoAxesCombined" },
  { label: "Media", view: "reels", icon: "Image" },
  { label: "Moderation", view: "approvals", icon: "ShieldCheck" },
  { label: "Users", view: "users", icon: "UsersRound", section: "FREE USERS" },
  { label: "Buyer activity", view: "offers", icon: "Activity" },
  { label: "Connections", view: "enquiries", icon: "Share2" },
  { label: "Appointments", view: "appointments", icon: "CalendarDays" },
  { label: "App analytics", view: "analytics", icon: "ChartNoAxesCombined" },
  { label: "Countries", view: "countries", icon: "Globe2" },
  { label: "Subscriptions", view: "subscriptions", icon: "CreditCard", section: "OPERATIONS" },
  { label: "Payments", view: "invoices", icon: "Coins" },
  { label: "Support", view: "tickets", icon: "LifeBuoy" },
  { label: "Staff & access", view: "staff", icon: "UserCog" },
  { label: "Settings", view: "settings", icon: "Settings" },
  { label: "Notifications", view: "notifications", icon: "Bell" },
  { label: "Platform health", view: "health", icon: "HeartPulse" },
] as const;

const screens: { id: string; view: View; office: boolean; label: string }[] = [
  ["A01 Dashboard", "dashboard", false], ["A02 Properties directory", "properties", false], ["A03 Add property — Details", "wizard", false],
  ["A04 Add property — Location", "wizard", false], ["A05 Add property — Media", "wizard", false], ["A06 Add property — Review", "wizard", false],
  ["A07 Property workspace", "property", false], ["A08 Reels library", "reels", false], ["A09 Upload reel", "upload", false],
  ["A10 Projects directory", "projects", false], ["A11 Project workspace", "project", false], ["A12 Team directory", "team", false],
  ["A13 Agent profile & permissions", "agent", false], ["A14 Enquiries", "enquiries", false], ["A15 Approval queue", "approvals", false],
  ["A16 Agency settings", "settings", false], ["A17 Sign in", "dashboard", false], ["A18 Password recovery", "dashboard", false], ["A19 Accept invitation", "dashboard", false],
  ["A20 Appointments", "appointments", false], ["A21 Performance analytics", "insights", false],
  ["A22 Audience & engagement", "audience", false],
  ["H01 Platform overview", "dashboard", true], ["H02 Agencies directory", "agencies", true], ["H03 Agency profile", "agency", true],
  ["H04 Agents directory", "agents", true], ["H05 Agent profile", "agent", true], ["H06 Properties directory", "properties", true],
  ["H07 Property details & activity", "property", true], ["H08 Reported outcomes", "outcomes", true], ["H09 Reels and videos", "reels", true],
  ["H10 Approvals and moderation", "approvals", true], ["H11 Free users directory", "users", true], ["H12 User profile", "user", true],
  ["H13 Buyer activity and offers", "offers", true], ["H14 Enquiries and connections", "enquiries", true], ["H15 Appointments overview", "appointments", true],
  ["H16 App analytics", "analytics", true], ["H17 Country performance", "countries", true], ["H18 Subscriptions", "subscriptions", true],
  ["H19 Payments and overdue", "invoices", true], ["H20 Support tickets", "tickets", true], ["H21 Staff and audit", "staff", true],
  ["H22 Platform settings", "settings", true], ["H23 Notifications", "notifications", true], ["H24 Platform health", "health", true],
].map(([id, view, office]) => ({ id: String(id), view: view as View, office: Boolean(office), label: String(id) }));



function useQuery(path: string | null) {
  const [state, setState] = useState<QueryState & { path: string | null }>({ loading: Boolean(path), error: "", data: null, path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((current) => ({ ...current, loading: true, error: "", path }));
    api(path).then((data) => { if (live) setState({ loading: false, error: "", data, path }); })
      .catch((error: Error) => { if (live) setState({ loading: false, error: error.message, data: null, path }); });
    return () => { live = false; };
  }, [path, tick]);
  const ready = state.path === path ? state : { loading: Boolean(path), error: "", data: null };
  return { loading: ready.loading, error: ready.error, data: ready.data, reload: () => setTick((value) => value + 1) };
}

function Head({ code, title, sub, children, crumb }: { code?: string; title: string; sub?: string; children?: React.ReactNode; crumb?: React.ReactNode }) {
  return <Page code={code} title={title} sub={sub} actions={children} crumb={crumb} />;
}

function Auth({ onSession, initialMode = "sign" }: { onSession: (session: Session) => void; initialMode?: "sign" | "recover" | "invite" }) {
  const router = useRouter();
  const mode = initialMode;
  function setMode(next: "sign" | "recover" | "invite") {
    router.push(next === "recover" ? "/password-recovery" : next === "invite" ? "/accept-invitation" : "/sign-in");
  }
  const [email, setEmail] = useState("ahad@placein.com");
  const [password, setPassword] = useState("PlaceIn2026!");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState(initialMode === "invite" ? "invite-aisyah-demo" : "");
  const [name, setName] = useState("Aisyah Rahman");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      if (mode === "sign") onSession(await api("/api/auth/login", { method: "POST", body: { email, password, otp: otp || undefined } }));
      if (mode === "recover" && !token) {
        const result = await api("/api/auth/forgot-password", { method: "POST", body: { email } });
        setToken(result.resetToken || "");
        setInfo(result.resetToken ? "Local reset token is ready. Choose a new password." : result.message);
      } else if (mode === "recover") {
        await api("/api/auth/reset-password", { method: "POST", body: { token, password } });
        setMode("sign");
        setInfo("Password updated. Sign in with the new password.");
      }
      if (mode === "invite") onSession(await api("/api/auth/accept-invite", { method: "POST", body: { token: token || "invite-aisyah-demo", name, password } }));
    } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); }
  }
  return <div className="auth-screen"><div className="auth-art" style={{ backgroundImage: "linear-gradient(#0b1039cc,#0b1039e6),url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80)" }}><div className="logo"><Icons.MapPin size={34} /><b>Place<span>In</span></b></div><h1>{mode === "invite" ? "Join Amina Properties\non PlaceIn" : "One workspace.\nEvery property.\nYour whole team."}</h1><div>{mode === "invite" && <><div className="feature"><Icons.House /><span><b>Work together</b>Access shared projects and listings</span></div><div className="feature"><Icons.Users /><span><b>Streamlined collaboration</b>Keep your team and clients aligned</span></div><div className="feature"><Icons.ChartNoAxesCombined /><span><b>Achieve more</b>Turn opportunities into results</span></div></>}</div></div>
    <form className="auth-form" onSubmit={submit}>{mode === "invite" && <small>YOU&apos;RE INVITED</small>}<h1>{mode === "sign" ? "Sign in to PlaceIn" : mode === "recover" ? "Reset your password" : "Accept your invitation"}</h1>
      <p>{mode === "invite" ? "Use the invitation token from your agency. The seeded token is invite-aisyah-demo." : "Head office and agency accounts use the same sign-in. The API chooses the portal from the role."}</p>
      {error && <div className="error-box">{error}</div>}{info && <div className="notice">{info}</div>}
      {mode !== "invite" && <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      {mode === "invite" && <div className="invite-info"><span>Invited email<b>aisyah@example.com</b><small>Set by owner</small></span><span>Role<b>Agent</b><small>Set by owner</small></span><span>Assigned projects<b>From the invitation</b><small>Set by owner</small></span></div>}
      {mode === "invite" && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} /></label>}
      {(mode === "invite" || mode === "recover") && <label>Invitation or reset token<input value={token} placeholder="invite-aisyah-demo" onChange={(event) => setToken(event.target.value)} /></label>}
      <label>{mode === "recover" && !token ? "Account email is enough for the first step" : "Password"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {mode === "sign" && <label>Two-factor code, if enabled<input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Leave blank when 2FA is off" /></label>}
      {mode === "invite" && <div className="expiry"><Icons.Clock3 /><p>This invitation expires in 6 days<small>If it expires, ask the agency owner for a new invite.</small></p></div>}
      <button className="btn gold" type="submit">{mode === "sign" ? "Sign in" : mode === "invite" ? "Accept invitation" : token ? "Update password" : "Send reset token"} <Icons.ArrowRight size={16} /></button>
      <div className="inline-actions"><button type="button" className="btn outline" onClick={() => setMode("sign")}>Sign in</button><button type="button" className="btn outline" onClick={() => setMode("recover")}>Password recovery</button><button type="button" className="btn outline" onClick={() => { setMode("invite"); setToken("invite-aisyah-demo"); }}>Accept invitation</button></div>
      <div className="demo-grid">{[["ahad@placein.com", "Super admin"], ["support@placein.com", "Admin / support"], ["tech@placein.com", "Maintenance"], ["sarah@aminaproperties.my", "Agency owner"]].map(([value, label]) => <button type="button" key={value} onClick={() => { setMode("sign"); setEmail(value); }}><b>{label}</b><small>{value}</small></button>)}</div>
    </form></div>;
}

const ConsoleContext = createContext<React.ComponentProps<typeof Screen> | null>(null);

export function ConsolePage({ view }: { view: View }) {
  const context = useContext(ConsoleContext);
  const params = useParams<{ id?: string }>();
  if (!context) return null;
  return <Screen {...context} view={view} id={params.id === "preview" ? "" : params.id || ""} />;
}

export default function Console({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const authMode = pathname === "/password-recovery" ? "recover" : pathname === "/accept-invitation" ? "invite" : "sign";
  const authPage = ["/sign-in", "/password-recovery", "/accept-invitation"].includes(pathname);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [country, setCountry] = useState("");
  const [wizardStep, setWizardStep] = useState(1);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<any>(null);
  useEffect(() => { setSession(loadSession()); setReady(true); }, []);
  const screenBoot = useRef(false);
  useEffect(() => {
    if (!ready || screenBoot.current) return;
    const requested = new URLSearchParams(window.location.search).get("screen");
    if (!requested) return;
    const screen = screens.find((item) => item.id === requested);
    if (!screen) return;
    screenBoot.current = true;
    if (screen.id.startsWith("A17") || screen.id.startsWith("A18") || screen.id.startsWith("A19")) {
      saveSession(null);
      router.replace(screen.id.startsWith("A18") ? "/password-recovery" : screen.id.startsWith("A19") ? "/accept-invitation" : "/sign-in");
      setSession(null);
      return;
    }
    const email = screen.office ? "ahad@placein.com" : "sarah@aminaproperties.my";
    api("/api/auth/login", { method: "POST", body: { email, password: "PlaceIn2026!" } }).then((next) => {
      saveSession(next);
      setSession(next);
      router.replace(routeFor(screen.view));
      setNotice("");
      if (screen.id.includes("Add property")) setWizardStep(Number(screen.id.slice(1, 3)) - 2);
    }).catch((error: Error) => setNotice(error.message));
  }, [ready]);
  useEffect(() => {
    if (!query.trim() || !session) { setHits(null); return; }
    const timer = setTimeout(() => { api(`/api/platform/search?q=${encodeURIComponent(query)}`).then(setHits).catch(() => setHits(null)); }, 250);
    return () => clearTimeout(timer);
  }, [query, session]);
  function enter(next: Session) { saveSession(next); setSession(next); if (authPage) router.replace("/dashboard"); setNotice(""); }
  function go(next: View, id = "") { router.push(routeFor(next, id)); setNotice(""); if (next === "wizard") setWizardStep(1); }
  async function leave(mode: "sign" | "recover" | "invite") {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    saveSession(null);
    router.push(mode === "recover" ? "/password-recovery" : mode === "invite" ? "/accept-invitation" : "/sign-in");
    setSession(null);
  }
  async function openScreen(screenId: string) {
    const screen = screens.find((item) => item.id === screenId);
    if (!screen || !session) return;
    if (screen.id.startsWith("A17")) { await leave("sign"); return; }
    if (screen.id.startsWith("A18")) { await leave("recover"); return; }
    if (screen.id.startsWith("A19")) { await leave("invite"); return; }
    const wantsStaff = screen.office;
    const signedInStaff = session.user.kind === "staff";
    if (wantsStaff !== signedInStaff) {
      try {
        await api("/api/auth/logout", { method: "POST" }).catch(() => null);
        const next = await api("/api/auth/login", { method: "POST", body: { email: wantsStaff ? "ahad@placein.com" : "sarah@aminaproperties.my", password: "PlaceIn2026!" } });
        saveSession(next);
        setSession(next);
        setNotice(`${screen.id} opened as ${next.user.name}.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not open that screen");
        return;
      }
    } else setNotice("");
    router.push(routeFor(screen.view));
    if (screen.id.includes("Add property")) setWizardStep(Number(screen.id.slice(1, 3)) - 2);
  }
  if (!ready) return null;
  if (!session || authPage) return <Auth key={authMode} initialMode={authMode} onSession={enter} />;
  const staff = session.user.kind === "staff";
  const nav = staff ? officeNav : agencyNav;
  const countryQuery = country ? `country=${encodeURIComponent(country)}` : "";
  const roleNames: Record<string, string> = { SUPER_ADMIN: "Super admin", ADMIN_SUPPORT: "Admin support", MAINTENANCE: "Maintenance", OWNER: "Agency owner" };
  const roleLabel = roleNames[session.user.role] || pretty(session.user.role);
  return <div className="app"><aside className="sidebar"><div className="logo"><Icons.MapPin size={30} /><b>Place<span>In</span></b></div><nav>{nav.map((item) => <div key={item.label}>{"section" in item && item.section && <div className="section">{item.section}</div>}<Link href={routeFor(item.view)} className={pathname === routeFor(item.view) || (item.view !== "dashboard" && pathname.startsWith(`${routeFor(item.view)}/`)) ? "active" : ""} onClick={() => setNotice("")}><Icon name={item.icon} /><span>{item.label}</span>{item.view === "health" && <i />}</Link></div>)}</nav>
    <div className="side-foot"><select value="" onChange={(event) => { if (event.target.value) openScreen(event.target.value); }}><option value="">Open a design screen</option><optgroup label="Agency portal">{screens.filter((item) => !item.office).map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</optgroup><optgroup label="Head office">{screens.filter((item) => item.office).map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</optgroup></select></div></aside>
    <div className="workspace"><header className="topbar"><div className="switcher"><Icons.Building2 size={16} /><b>{staff ? "Head Office" : session.user.agencyName || "Agency"}</b></div>
      {staff ? <CountrySelect value={country} setValue={setCountry} /> : <div className="country"><Icons.Globe2 size={15} /> Malaysia</div>}
      <div className="head-search search-wrap"><Icons.Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={staff ? "Search agencies, agents, properties..." : "Search properties, projects, people..."} />{hits && <div className="search-pop">{[["agencies", "agency"], ["agents", "agent"], ["properties", "property"], ["users", "user"]].map(([key, target]) => (hits[key] || []).map((hit: any) => <button key={hit.id} onClick={() => { go(target as View, hit.id); setQuery(""); setHits(null); }}><b>{hit.name || hit.title}</b><small>{hit.email || hit.reference || hit.code || hit.city || ""}</small></button>))}{!hits.agencies?.length && !hits.agents?.length && !hits.properties?.length && !hits.users?.length && <div className="empty">No matches.</div>}</div>}</div>
      <button className="icon-btn" onClick={() => go(staff ? "notifications" : "appointments")}><Icons.Bell /><i /></button>
      <button className="profile" onClick={() => leave("sign")}><Avatar name={session.user.name} /><b>{session.user.name}<small>{staff ? roleLabel : roleLabel}</small></b><Icons.ChevronDown size={16} /></button>
    </header><main>{notice && <div className="banner">{notice}</div>}<ConsoleContext.Provider value={{ session, view, go, id: "", countryQuery, wizardStep, setWizardStep, notify: setNotice }}>{children}</ConsoleContext.Provider></main></div></div>;
}

function CountrySelect({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  const state = useQuery("/api/platform/countries");
  const rows = state.data || [];
  return <div className="country"><Icons.Globe2 size={16} /><select value={value} onChange={(event) => setValue(event.target.value)}><option value="">All countries</option>{rows.map((row: any) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></div>;
}

function Screen(props: { session: Session; view: View; go: Go; id: string; countryQuery: string; wizardStep: number; setWizardStep: (n: number) => void; notify: (s: string) => void }) {
  const { view, session } = props;
  const staff = session.user.kind === "staff";
  if (!staff && ["agencies", "users", "user", "analytics", "countries", "subscriptions", "staff", "notifications", "health", "audit"].includes(view)) return <Denied text="This screen is part of the head-office portal." />;
  if (staff && view === "insights") return <Denied text="Performance analytics belongs to an agency. Choose A21 in the screen list to open it as Amina Properties." />;
  if (view === "dashboard") return staff ? <OfficeHome {...props} /> : <AgencyHome {...props} />;
  if (view === "properties") return <Properties {...props} />;
  if (view === "wizard") return <Wizard {...props} />;
  if (view === "property") return <PropertyDetail {...props} />;
  if (view === "reels") return <Reels {...props} />;
  if (view === "upload") return <UploadReel {...props} />;
  if (view === "projects") return <Projects {...props} />;
  if (view === "project") return <ProjectDetail {...props} />;
  if (view === "team" || view === "agents") return <People {...props} team={view === "team"} />;
  if (view === "agent") return <AgentDetail {...props} />;
  if (view === "enquiries") return <Enquiries {...props} />;
  if (view === "appointments") return <Appointments {...props} />;
  if (view === "offers") return <Offers {...props} />;
  if (view === "outcomes") return <Outcomes {...props} />;
  if (view === "approvals") return <Moderation {...props} />;
  if (view === "agencies") return <Agencies {...props} />;
  if (view === "agency") return <AgencyDetail {...props} />;
  if (view === "users") return <Users {...props} />;
  if (view === "user") return <UserDetail {...props} />;
  if (view === "analytics" || view === "insights" || view === "audience") return <Analytics {...props} />;
  if (view === "countries") return <Countries {...props} />;
  if (view === "subscriptions") return <Subscriptions {...props} />;
  if (view === "invoices") return <Invoices {...props} />;
  if (view === "tickets") return <Tickets {...props} />;
  if (view === "staff") return <Staff {...props} />;
  if (view === "settings") return staff ? <PlatformSettings {...props} /> : <AgencySettings {...props} />;
  if (view === "notifications") return <Notifications {...props} />;
  if (view === "health") return <Health {...props} />;
  return <Audit {...props} />;
}
function Denied({ text }: { text: string }) { return <section className="card panel denied"><h1>Permission denied</h1><p>{text}</p></section>; }

function OfficeHome({ go, countryQuery }: { go: Go; countryQuery: string }) {
  const state = useQuery(`/api/dashboard/office${countryQuery ? `?${countryQuery}` : ""}`);
  return <Gate state={state}>{(data) => <>
    <Head code="01 / 24" title="Platform overview" sub={`${data.scope}. Paying agencies and free property seekers are counted separately. Updated ${when(data.updatedAt)}.`}><button className="btn outline" onClick={() => downloadCsv("agencies").catch((error) => alert(error.message))}><Icons.Download size={16} /> Export agencies</button></Head>
    <Metrics><Stat icon="Building2" title="Active agencies" value={data.agencies.active} note={`${data.agencies.joinedThisMonth} joined this month`} /><Stat icon="Users" title="Agent accounts" value={data.agents} note="Active memberships" tone="purple" /><Stat icon="House" title="Available listings" value={data.liveProperties} note="Live and available" tone="green" /><Stat icon="KeyRound" title="Reported sold or let" value={data.reportedSoldOrLet} note="This month, agency reported" tone="orange" /></Metrics>
    <Metrics><Stat icon="Download" title="Downloads" value={data.downloads.toLocaleString()} note="Store reports, not accounts" tone="blue" /><Stat icon="UserRound" title="Registered users" value={data.freeUsers.registered.toLocaleString()} note={`${data.freeUsers.newThisMonth} new this month`} tone="purple" /><Stat icon="MessageSquareText" title="Enquiries" value={data.enquiries} note={`${data.offers} offers · ${data.appointments} appointments`} tone="pink" /><Stat icon="CircleDollarSign" title="Paid invoices" value={data.finance ? `£${data.finance.paidInvoicesGbp.toLocaleString()}` : "Hidden"} note={data.finance ? "GBP reporting currency" : "Finance access required"} tone="green" /></Metrics>
    {!data.finance && <div className="banner">Subscription revenue, overdue balances and failed payments are hidden for this role.</div>}
    {data.finance && <Metrics cols={3}><Stat icon="Coins" title="Outstanding" value={`£${data.finance.outstandingGbp.toLocaleString()}`} note="Converted to GBP" /><Stat icon="TriangleAlert" title="Overdue" value={`£${data.finance.overdueGbp.toLocaleString()}`} note="Still unpaid after the due date" tone="red" /><Stat icon="CircleX" title="Failed attempts" value={data.finance.failedAttempts} note="From payment-provider records" tone="orange" /></Metrics>}
    <div className="grid two">
      <Series series={data.series} label="Property views" />
      <section className="card panel"><h2>Needs attention</h2>{data.attention.map((item: any) => <button className="list-row" key={item.label} onClick={() => go(item.label.includes("Agency") ? "agencies" : "approvals")}><b>{item.label}</b><Badge status={item.count ? "HIGH" : "ACTIVE"}>{item.count}</Badge><span>Open</span></button>)}</section>
    </div>
    <Table columns={["Agency", "Country", "Agents", "Status", ""]} rows={data.latestAgencies.map((row: any) => [<Who key={row.id} name={row.name} sub="Latest agency" />, row.country, row.agents, <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>, <button key="v" className="btn outline sm">View</button>])} onRow={(index) => go("agency", data.latestAgencies[index].id)} />
  </>}</Gate>;
}
function AgencyHome({ go }: { go: Go }) {
  const state = useQuery("/api/dashboard/agency");
  return <Gate state={state}>{(data) => <>
    <Head title="Dashboard" sub="Today’s listings, enquiries, appointments and reel plays for your agency."><button className="btn gold" onClick={() => go("wizard")}><Icons.Plus size={16} /> Add property</button></Head>
    <Metrics><Stat icon="House" title="Available properties" value={data.available} note="Live listings" tone="green" /><Stat icon="MessageSquareText" title="Open enquiries" value={data.openEnquiries} note={`${data.enquiriesThisMonth} this month`} tone="pink" /><Stat icon="CalendarCheck" title="Upcoming appointments" value={data.upcomingAppointments} note={`${data.appointments.length} today`} tone="purple" /><Stat icon="CirclePlay" title="Reel plays" value={data.reelPlays.toLocaleString()} note="Across your reels" tone="orange" /></Metrics>
    <div className="grid two"><section className="card panel"><div className="panel-head"><h2>Today’s appointments</h2><button className="btn ghost sm" onClick={() => go("appointments")}>View calendar</button></div>{data.appointments.map((row: any) => <div className="list-row" key={row.id}><b>{new Date(row.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b><Who name={row.customer} sub={row.property} /><Badge status={row.status}>{pretty(row.status)}</Badge></div>)}{!data.appointments.length && <div className="empty">No appointments today.</div>}</section>
      <section className="card panel"><h2>Quick actions</h2><div className="quick"><button onClick={() => go("wizard")}><Icons.Plus /><span>Add property</span></button><button onClick={() => go("upload")}><Icons.Video /><span>Upload reel</span></button><button onClick={() => go("team")}><Icons.UserPlus /><span>Invite agent</span></button><button onClick={() => go("projects")}><Icons.FolderPlus /><span>Projects</span></button></div></section></div>
    <div className="grid two"><section className="card panel"><h2>Recent enquiries</h2><Table columns={["Customer", "Property", "Status"]} rows={data.recentEnquiries.map((row: any) => [<Who key={row.id} name={row.customer} sub={row.summary} />, row.property || "—", <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>])} onRow={() => go("enquiries")} /></section>
      <section className="card panel"><h2>Latest listings</h2>{(data.properties || []).slice(0, 4).map((row: any) => <button key={row.id} className="list-row" onClick={() => go("property", row.id)}><Thumb url={row.coverUrl} /><span className="stack-name"><b>{row.title}</b><small>{money(row.price, row.currency)}</small></span><Badge status={row.publication === "LIVE" ? "LIVE" : row.status}>{pretty(row.publication === "LIVE" ? "LIVE" : row.status)}</Badge></button>)}</section></div>
  </>}</Gate>;
}
function Stat(props: { icon: string; title: string; value: React.ReactNode; note?: string; tone?: string }) {
  return <Metric {...props} />;
}
function Series({ series, label }: { series: any[]; label: string }) {
  return <section className="card panel"><h2>{label}</h2><Bars series={series} /></section>;
}

function Properties({ go, countryQuery, session }: { go: Go; countryQuery: string; session: Session }) {
  const staff = session.user.kind === "staff";
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [publication, setPublication] = useState("");
  const [listingType, setListingType] = useState("");
  const [picked, setPicked] = useState(0);
  const path = `/api/properties?page=${page}&pageSize=8&q=${encodeURIComponent(q)}&status=${status}&publication=${publication}&listingType=${listingType}${countryQuery ? `&${countryQuery}` : ""}`;
  const state = useQuery(path);
  const tabs = [["", "All"], ["LIVE", "Live"], ["DRAFT", "Draft"], ["PENDING_REVIEW", "Pending approval"], ["CHANGES_REQUESTED", "Needs changes"], ["SOLD", "Sold"], ["LET", "Let"]];
  return <><Head code={staff ? "06 / 24" : undefined} title={staff ? "Properties directory" : "Properties"} sub={staff ? "All agency listings across PlaceIn. Publication and outcome are tracked separately." : "Manage all your property listings. Add, edit and track the status of your properties."}>
    {staff && <button className="btn outline" onClick={() => go("approvals")}><Icons.Flag size={16} /> Review flagged</button>}
    <button className="btn gold" onClick={() => staff ? downloadCsv("properties").catch((error) => alert(error.message)) : go("wizard")}>{staff ? <><Icons.Download size={16} /> Export</> : <><Icons.Plus size={16} /> Add property</>}</button>
  </Head>
    <section className="card panel" style={{ marginBottom: 12 }}><div className="filters" style={{ margin: 0 }}>
      <input value={q} placeholder="Search by reference, title or location" onChange={(event) => { setQ(event.target.value); setPage(1); }} />
      <Select value={listingType} set={(value) => { setListingType(value); setPage(1); }} options={["", "SALE", "RENT"]} labels={["Sale or rent", "Sale", "Rent"]} />
      {staff && <Select value={publication} set={(value) => { setPublication(value); setPage(1); }} options={["", "DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "LIVE", "UNPUBLISHED", "REJECTED"]} labels={["Publication", "Draft", "Pending review", "Needs changes", "Published", "Unpublished", "Rejected"]} />}
      <Select value={status} set={(value) => { setStatus(value); setPage(1); }} options={["", "AVAILABLE", "UNDER_OFFER", "SOLD", "LET", "WITHDRAWN", "EXPIRED"]} labels={["Property status", "Available", "Under offer", "Sold", "Let", "Withdrawn", "Expired"]} />
    </div></section>
    {!staff && <div className="seg">{tabs.map(([id, label]) => <button key={label} className={(id === "SOLD" || id === "LET" ? status === id : publication === id) ? "on" : ""} onClick={() => { if (id === "SOLD" || id === "LET") { setStatus(id); setPublication(""); } else { setPublication(id); setStatus(""); } setPage(1); }}>{label}</button>)}</div>}
    <Gate state={state}>{(data) => {
      const current = data.data[picked] || data.data[0];
      return staff ? <div className="split"><div><Table active={picked} columns={["Property", "Agency / agent", "Country", "Sale / rent", "Status", "Publication", "Quality", ""]} rows={data.data.map((row: any) => [
        <div className="who" key={row.id}><Thumb url={row.coverUrl} /><p><b>{row.title}</b><small>{row.reference} · {money(row.price, row.currency)}</small></p></div>,
        <span key="a" className="stack-name"><b>{row.agency?.name}</b><small>{row.agent?.name || "Unassigned"}</small></span>,
        row.countryName, pretty(row.listingType), <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>, <Badge key="p" status={row.publication}>{pretty(row.publication)}</Badge>, <Badge key="q" status={row.mediaQuality === "PASS" || row.mediaQuality === "READY" ? "PASS" : "FAILED"}>{pretty(row.mediaQuality)}</Badge>,
        <button key="v" className="btn outline sm">View</button>,
      ])} onRow={setPicked} /><Pager data={data} page={page} setPage={setPage} /></div>
        {current && <aside className="card rail"><div className="project-img" style={{ backgroundImage: `url(${current.coverUrl})`, borderRadius: 12 }}><Badge status={current.status}>{pretty(current.status)}</Badge><Badge status={current.publication}>{pretty(current.publication)}</Badge></div><h2>{current.title}</h2><p className="muted">{current.reference}</p><div className="kv"><span>Agency</span><b>{current.agency?.name}</b><span>Agent</span><b>{current.agent?.name || "Unassigned"}</b><span>Location</span><b>{current.area}, {current.city}</b><span>Views</span><b>{current.views}</b><span>Saves</span><b>{current.saves}</b></div><button className="btn gold" onClick={() => go("property", current.id)}>Open property</button></aside>}
      </div> : <><Table columns={["Property", "Reference", "Project", "Agent", "Price", "Status", "Updated", ""]} rows={data.data.map((row: any) => [
        <div className="who" key={row.id}><Thumb url={row.coverUrl} /><p><b>{row.title}</b><small>{row.beds} beds · {row.baths} baths · {Number(row.sizeSqft || 0).toLocaleString()} sq ft</small></p></div>,
        row.reference, row.project?.name || "—", <Who key="ag" name={row.agent?.name || "Unassigned"} />, money(row.price, row.currency),
        <Badge key="s" status={row.publication === "LIVE" ? "LIVE" : row.publication === "DRAFT" ? "DRAFT" : row.status}>{pretty(row.publication === "LIVE" ? "Live" : row.publication === "CHANGES_REQUESTED" ? "Needs changes" : row.publication === "PENDING_REVIEW" ? "Pending approval" : row.status)}</Badge>,
        day(row.uploadedAt), <span key="act" className="inline-actions"><button className="btn outline sm" onClick={(event) => { event.stopPropagation(); go("property", row.id); }}>View</button><button className="btn gold sm" onClick={(event) => { event.stopPropagation(); go("property", row.id); }}>Edit</button></span>,
      ])} onRow={(index) => go("property", data.data[index].id)} /><Pager data={data} page={page} setPage={setPage} /></>;
    }}</Gate></>;
}


function PropertyDetail({ id, go, notify }: { id: string; go: Go; notify: (s: string) => void }) {
  const state = useQuery(id ? `/api/properties/${id}` : null);
  const [reason, setReason] = useState("Owner confirmed the change.");
  const [status, setStatus] = useState("SOLD");
  const [lead, setLead] = useState("unknown");
  async function act(path: string, body: unknown) {
    try { await api(path, { method: "POST", body }); notify("Saved. The activity history has a new entry."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not save"); }
  }
  if (!id) return <PickFirst path="/api/properties?pageSize=1" go={(value) => go("property", value)} label="property" />;
  const photos = (rowPhotos: any[]) => rowPhotos || [];
  return <Gate state={state}>{(row) => {
    const gallery = photos(row.photos);
    const cover = row.coverUrl || gallery[0]?.url;
    return <>
    <Head code="07 / 24" title="Property details and activity" sub="Manage property information, media, status and activity." crumb={<div className="crumb"><button onClick={() => go("properties")}>Properties</button> · {row.title}</div>}>
      <Badge status={row.status}>{pretty(row.status)}</Badge><Badge status={row.publication}>{pretty(row.publication)}</Badge>
      <button className="btn outline" onClick={() => act(`/api/properties/${row.id}/publication`, { publication: row.publication === "LIVE" ? "UNPUBLISHED" : "LIVE", reason })}>{row.publication === "LIVE" ? "Unpublish" : "Publish"}</button>
      <button className="btn gold" onClick={() => act(`/api/properties/${row.id}/status`, { status, reason, leadAttributedToPlaceIn: lead === "unknown" ? undefined : lead === "yes" })}>Request correction</button>
    </Head>
    <div className="grid two">
      <div className="hero-gallery"><div className="main" style={{ backgroundImage: `url(${cover})` }} /><div className="side">{gallery.slice(1, 5).map((photo: any) => <i key={photo.id} style={{ backgroundImage: `url(${photo.url})` }} />)}{gallery.length < 2 && <i style={{ backgroundImage: `url(${cover})` }} />}</div></div>
      <section className="card panel"><div className="panel-head"><h2>{row.title}</h2><Badge status={row.listingType}>{row.listingType === "RENT" ? "For rent" : "For sale"}</Badge></div><p className="muted">{row.reference} · {row.area}, {row.city}, {row.countryName}</p><h1 style={{ margin: "8px 0" }}>{money(row.price, row.currency)}</h1><div className="kv"><span>Type</span><b>{row.propertyType}</b><span>Bedrooms</span><b>{row.beds}</b><span>Bathrooms</span><b>{row.baths}</b><span>Floor area</span><b>{Number(row.sizeSqft || 0).toLocaleString()} sq ft</b><span>Agency</span><b>{row.agency?.name}</b><span>Agent</span><b>{row.agent?.name || "Unassigned"}</b><span>Project</span><b>{row.project?.name || "—"}</b><span>Private address</span><b>{row.addressPrivate || "—"}</b></div></section>
    </div>
    <Metrics cols={4}><Stat icon="Eye" title="Property views" value={row.views} note="Recorded views" /><Stat icon="Users" title="Unique viewers" value={row.uniqueViewers} note="Deduplicated" tone="purple" /><Stat icon="Bookmark" title="Saves" value={row.saves} note="On this listing" tone="pink" /><Stat icon="MessageSquareText" title="Enquiries" value={row.enquiries?.length || 0} note={`${row.offers?.length || 0} offers`} tone="green" /></Metrics>
    <div className="grid three"><section className="card panel"><h2>Media quality</h2>{gallery.map((photo: any) => <p key={photo.id} className="ready" style={{ display: "flex", gap: 8, alignItems: "center" }}><Icons.Image size={16} /> {photo.width}×{photo.height} <Badge status={photo.quality === "READY" || photo.quality === "PASS" ? "PASS" : "FAILED"}>{pretty(photo.quality)}</Badge></p>)}<p className="muted">{row.note}</p></section>
      <section className="card panel"><h2>Recent enquiries and offers</h2>{(row.enquiries || []).slice(0, 4).map((item: any) => <div key={item.id} className="list-row"><Who name={item.freeUser?.name} sub={item.summary} /><Badge status={item.status}>{pretty(item.status)}</Badge></div>)}{(row.offers || []).slice(0, 3).map((item: any) => <div key={item.id} className="list-row"><Who name={item.freeUser?.name || "Offer"} sub={money(item.amount, item.currency)} /><Badge status={item.status}>{pretty(item.status)}</Badge></div>)}</section>
      <section className="card panel"><h2>Report an outcome</h2><p className="muted">Sold, let and withdrawn are agency reports. An accepted offer does not sell the property.</p><div className="stack"><Select value={status} set={setStatus} options={["AVAILABLE", "UNDER_OFFER", "SOLD", "LET", "WITHDRAWN", "EXPIRED"]} /><select value={lead} onChange={(event) => setLead(event.target.value)}><option value="unknown">Lead source unknown</option><option value="yes">Lead came through PlaceIn</option><option value="no">Lead did not come through PlaceIn</option></select><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><button className="btn gold" onClick={() => act(`/api/properties/${row.id}/status`, { status, reason, leadAttributedToPlaceIn: lead === "unknown" ? undefined : lead === "yes" })}>Save outcome</button></div></section></div>
    <Table columns={["When", "Actor", "Change", "Reason"]} rows={(row.events || []).map((event: any) => [when(event.createdAt), event.actorName, [event.fromStatus, event.toStatus, event.publication].filter(Boolean).join(" → "), event.reason])} />
  </>;
  }}</Gate>;
}
function PickFirst({ path, go, label }: { path: string; go: (id: string) => void; label: string }) {
  const state = useQuery(path);
  useEffect(() => { const id = state.data?.data?.[0]?.id || state.data?.id; if (id) go(id); }, [state.data, go]);
  return <Gate state={state}>{() => <section className="card panel">Opening the first {label}…</section>}</Gate>;
}

function Wizard({ wizardStep, setWizardStep, notify, go, session }: { wizardStep: number; setWizardStep: (n: number) => void; notify: (s: string) => void; go: Go; session: Session }) {
  const projects = useQuery("/api/projects?pageSize=20");
  const agencies = useQuery(session.user.kind === "staff" ? "/api/agencies?pageSize=30" : null);
  const [id, setId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [form, setForm] = useState({ title: "Villa Mont Kiara", listingType: "SALE", propertyType: "Bungalow", price: "2800000", currency: "MYR", beds: "5", baths: "6", sizeSqft: "7200", description: "An exceptional contemporary villa in Mont Kiara, with expansive living spaces and a private pool.", countryName: "Malaysia", city: "Kuala Lumpur", area: "Mont Kiara", postcode: "50480", addressPrivate: "Jalan Kiara 3, Mont Kiara" });
  const [photo, setPhoto] = useState({ url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80", width: "1920", height: "1280" });
  const photoPasses = Number(photo.width) >= 1600 && Number(photo.height) >= 1200;
  function set(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function saveDetails() {
    if (session.user.kind === "staff" && !agencyId) throw new Error("Choose the agency that owns this listing.");
    const body = { ...form, projectId: projectId || undefined, agencyId: agencyId || undefined, price: Number(form.price), beds: Number(form.beds), baths: Number(form.baths), sizeSqft: Number(form.sizeSqft) };
    const row = id ? await api(`/api/properties/${id}`, { method: "PATCH", body }) : await api("/api/properties", { method: "POST", body });
    setId(row.id);
    return row.id as string;
  }
  async function next() {
    try {
      const propertyId = id || await saveDetails();
      if (!id) setId(propertyId);
      if (wizardStep === 1) { setWizardStep(2); }
      else if (wizardStep === 2) { await api(`/api/properties/${propertyId}`, { method: "PATCH", body: { countryName: form.countryName, city: form.city, area: form.area, postcode: form.postcode, addressPrivate: form.addressPrivate, projectId: projectId || undefined } }); setWizardStep(3); }
      else if (wizardStep === 3) { await api(`/api/properties/${propertyId}/photos`, { method: "POST", body: { photos: [{ ...photo, width: Number(photo.width), height: Number(photo.height), isCover: true }] } }); setWizardStep(4); }
      else { const row = await api(`/api/properties/${propertyId}/submit`, { method: "POST", body: {} }); notify(`${row.reference} is now ${row.publication}.`); go("property", row.id); }
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save the listing"); }
  }
  const labels = ["Details", "Location", "Photos & video", "Review"];
  return <><Head title="Add property" sub="Each step is saved. A photo below 1600×1200 cannot be published." crumb={<button className="btn ghost sm" onClick={() => go("properties")}><Icons.ArrowLeft size={14} /> Back to properties</button>} />
    <div className="steps">{labels.map((label, index) => <div key={label} className={index + 1 === wizardStep ? "current" : index + 1 < wizardStep ? "done" : ""}><b>{index + 1 < wizardStep ? "✓" : index + 1}</b><span>{label}</span></div>)}</div>
    <div className="editor-layout">
      <section className="card panel">
        <h2>{labels[wizardStep - 1]}</h2>
        {wizardStep === 1 && <div className="form">
          {session.user.kind === "staff" && <label className="full">Agency<select value={agencyId} onChange={(event) => setAgencyId(event.target.value)}><option value="">Choose an agency</option>{(agencies.data?.data || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
          <label className="full">Property title<input value={form.title} onChange={(event) => set("title", event.target.value)} /></label>
          <label>Listing type<select value={form.listingType} onChange={(event) => set("listingType", event.target.value)}><option value="SALE">For sale</option><option value="RENT">For rent</option></select></label>
          <label>Property type<input value={form.propertyType} onChange={(event) => set("propertyType", event.target.value)} /></label>
          <label>Price<input value={form.price} onChange={(event) => set("price", event.target.value)} /></label>
          <label>Currency<input value={form.currency} onChange={(event) => set("currency", event.target.value)} /></label>
          <label>Bedrooms<input value={form.beds} onChange={(event) => set("beds", event.target.value)} /></label>
          <label>Bathrooms<input value={form.baths} onChange={(event) => set("baths", event.target.value)} /></label>
          <label className="full">Size (sq ft)<input value={form.sizeSqft} onChange={(event) => set("sizeSqft", event.target.value)} /></label>
          <label className="full">Description<textarea value={form.description} onChange={(event) => set("description", event.target.value)} /></label>
        </div>}
        {wizardStep === 2 && <div className="form">
          <label>Country<input value={form.countryName} onChange={(event) => set("countryName", event.target.value)} /></label>
          <label>City<input value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
          <label>Area<input value={form.area} onChange={(event) => set("area", event.target.value)} /></label>
          <label>Postcode<input value={form.postcode} onChange={(event) => set("postcode", event.target.value)} /></label>
          <label className="full">Private address<input value={form.addressPrivate} onChange={(event) => set("addressPrivate", event.target.value)} /></label>
          <label className="full">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">No project</option>{(projects.data?.data || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        </div>}
        {wizardStep === 3 && <div className="form">
          <label className="full">Cover photo URL<input value={photo.url} onChange={(event) => setPhoto({ ...photo, url: event.target.value })} /></label>
          <label>Width in pixels<input value={photo.width} onChange={(event) => setPhoto({ ...photo, width: event.target.value })} /></label>
          <label>Height in pixels<input value={photo.height} onChange={(event) => setPhoto({ ...photo, height: event.target.value })} /></label>
          <div className="full inline-actions"><button type="button" className="btn outline" onClick={() => setPhoto({ ...photo, width: "800", height: "600" })}>Use a too-small example</button><button type="button" className="btn outline" onClick={() => setPhoto({ ...photo, width: "1920", height: "1280" })}>Use a passing size</button></div>
          <p className="full">{photoPasses ? "This photo meets the 1600×1200 minimum." : "This photo is below 1600×1200. Submission will be blocked."}</p>
        </div>}
        {wizardStep === 4 && <div className="ready">
          <p><Icons.CircleCheck /> {form.title}</p>
          <p><Icons.CircleCheck /> {form.listingType === "SALE" ? "For sale" : "For rent"} · {form.currency} {Number(form.price).toLocaleString()}</p>
          <p><Icons.CircleCheck /> {form.area}, {form.city}</p>
          <p>{photoPasses ? <Icons.CircleCheck /> : <Icons.TriangleAlert />} Photo {photo.width}×{photo.height}</p>
          <p>Submit publishes the listing, or sends it for approval when the agency requires it.</p>
        </div>}
        <div className="flow-actions"><button className="btn outline" onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}><Icons.ArrowLeft size={16} /> Back</button><span /><button className="btn outline" onClick={() => notify("Draft stays on this step until you continue.")}>Save draft</button><button className="btn gold" onClick={next}>{wizardStep === 4 ? "Submit for approval" : "Continue"} <Icons.ArrowRight size={16} /></button></div>
      </section>
      <aside className="card panel property-preview">
        {wizardStep === 2 ? <div className="map-card"><iframe title="Approximate location" src={`https://www.openstreetmap.org/export/embed.html?bbox=101.63%2C3.15%2C101.68%2C3.19&layer=mapnik&marker=3.172%2C101.652`} /></div> : <><h2>Listing preview</h2><div className="shot" style={{ backgroundImage: `url(${photo.url})` }} /><h3>{form.title || "Untitled property"}</h3><p>{form.propertyType} · {form.beds} beds · {form.baths} baths · {Number(form.sizeSqft || 0).toLocaleString()} sq ft</p><p><b>{money(Number(form.price || 0), form.currency)}</b></p><p>{form.area}{form.city ? `, ${form.city}` : ""}</p><Badge status={photoPasses ? "PASS" : "FAILED"}>{photoPasses ? "Photo passes" : "Photo too small"}</Badge></>}
        {wizardStep === 2 && <Note>The full address stays private. Only the general area is shown on public listings.</Note>}
      </aside>
    </div></>;
}

function Reels({ go, session }: { go: Go; session: Session }) {
  const staff = session.user.kind === "staff";
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const state = useQuery(`/api/reels?page=${page}&pageSize=${staff ? 6 : 12}&q=${encodeURIComponent(q)}`);
  return <><Head code={staff ? "09 / 24" : undefined} title={staff ? "Reels and videos" : "Reels library"} sub={staff ? "Oversee agency media, quality and audience engagement. Editing stays in the mobile app." : "Manage finished reels. Create and edit them in the PlaceIn mobile app, then upload here."}>
    {!staff && <div className="note" style={{ margin: 0 }}><Icons.Smartphone size={16} /> Editing stays in the mobile app</div>}
    {staff && <button className="btn outline" onClick={() => go("approvals")}>Review flagged media</button>}
    {!staff && <button className="btn gold" onClick={() => go("upload")}><Icons.Plus size={16} /> Upload reel</button>}
  </Head>
    <div className="filters"><input value={q} placeholder="Search by caption, property or agent" onChange={(event) => { setQ(event.target.value); setPage(1); }} /></div>
    <Gate state={state}>{(data) => <><div className="reel-grid">{data.data.map((row: any) => <article className="card reel-card" key={row.id}><div className="reel-cover" style={{ backgroundImage: `url(${row.coverUrl})` }}><button className="play"><Icons.Play size={16} /></button><Badge status={row.publication}>{pretty(row.publication)}</Badge></div><div className="pad"><h3>{row.caption}</h3><p>{row.property?.title || "No property"} · {row.agency?.name}</p><div className="media-metrics"><span><b>{Number(row.plays || 0).toLocaleString()}</b> Plays</span><span><b>{row.likes}</b> Likes</span><span><b>{row.saves}</b> Saves</span><span><b>{row.completionRate == null ? "—" : `${Math.round(Number(row.completionRate) <= 1 ? Number(row.completionRate) * 100 : Number(row.completionRate))}%`}</b> Completion</span><span><b>{row.watchTimeSec ? `${Math.round(Number(row.watchTimeSec) / 60)}m` : "—"}</b> Watch</span><span><b>{row.enquiries || 0}</b> Enquiries</span></div><div className="inline-actions"><Who name={row.agent?.name || row.agency?.name} /><Badge status={row.processing}>{pretty(row.processing)}</Badge></div>{staff && row.processing !== "READY" && row.processing !== "COMPLETE" && <div className="warning"><Icons.TriangleAlert size={16} /><span>Check resolution and quality before this can be published.</span></div>}</div></article>)}</div><Pager data={data} page={page} setPage={setPage} /></>}</Gate></>;
}
function bytesLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reelClock(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function readVideoFile(file: File) {
  return new Promise<{ width: number; height: number; duration: number; url: string }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, url });
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video could not be read.")); };
    video.src = url;
  });
}

function UploadReel({ notify, go }: { notify: (s: string) => void; go: Go }) {
  const properties = useQuery("/api/properties?pageSize=100");
  const agents = useQuery("/api/agents?pageSize=100");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef("");
  const [caption, setCaption] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [openProperties, setOpenProperties] = useState(false);
  const [openAgents, setOpenAgents] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [frames, setFrames] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [checks, setChecks] = useState({ formatOk: false, sizeOk: false, width: 0, height: 0, duration: Number.NaN, read: false });
  const [saved, setSaved] = useState<{ id: string; signature: string } | null>(null);
  const detail = useQuery(propertyId ? `/api/properties/${propertyId}` : null);
  const rows = properties.data?.data || [];
  const property = rows.find((row: any) => row.id === propertyId);
  const agentRows = agents.data?.data || [];
  const agent = agentRows.find((row: any) => row.id === agentId);
  const photos = detail.data?.id === propertyId ? [...(detail.data.photos || [])].sort((a: any, b: any) => Number(b.isCover) - Number(a.isCover)) : [];
  const covers = [...frames.map((url) => ({ url, key: url })), ...photos.map((photo: any) => ({ url: photo.url, key: photo.id }))];
  const resolutionOk = checks.width >= 1080 && checks.height >= 1920;
  const durationOk = Number.isFinite(checks.duration) && checks.duration > 0 && checks.duration <= 90;
  const chosen = Boolean(fileName);
  const passes = chosen && checks.formatOk && checks.sizeOk && checks.read && resolutionOk && durationOk;
  const signature = JSON.stringify({ caption: caption.trim(), propertyId, agentId, videoUrl, coverUrl });

  useEffect(() => { previewRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  useEffect(() => { setAgentId(property?.agent?.id || ""); }, [propertyId, property?.agent?.id]);

  async function onFile(file?: File) {
    if (!file) return;
    setVideoUrl("");
    setProgress(0);
    setPlaying(false);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const formatOk = /^(video\/mp4|video\/quicktime|video\/webm)$/.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
    const sizeOk = file.size <= 200 * 1024 * 1024;
    setFileName(file.name);
    setFileSize(file.size);
    let meta: { width: number; height: number; duration: number; url: string };
    try {
      meta = await readVideoFile(file);
    } catch (error) {
      setPreviewUrl("");
      setChecks({ formatOk, sizeOk, width: 0, height: 0, duration: Number.NaN, read: false });
      notify(error instanceof Error ? error.message : "This video could not be read.");
      return;
    }
    setPreviewUrl(meta.url);
    setChecks({ formatOk, sizeOk, width: meta.width, height: meta.height, duration: meta.duration, read: true });
    const meetsRules = formatOk && sizeOk && meta.width >= 1080 && meta.height >= 1920 && meta.duration > 0 && meta.duration <= 90;
    if (!meetsRules) {
      notify("This video does not meet the reel rules, so it was not stored.");
      return;
    }
    setUploading(true);
    try {
      const stored = await uploadFile(file, setProgress);
      setVideoUrl(stored.url);
      setFileName(stored.originalName || file.name);
      setFileSize(stored.size || file.size);
      setProgress(1);
      notify("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function useFrame() {
    const node = videoRef.current;
    if (!node || !node.videoWidth) {
      notify("Wait until the preview is ready, then use the current frame.");
      return;
    }
    setCapturing(true);
    try {
      if (node.readyState < 2 || node.currentTime === 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error("Could not read this frame.")), 2500);
          node.addEventListener("seeked", () => { window.clearTimeout(timer); resolve(); }, { once: true });
          node.currentTime = Math.min(0.12, Math.max((node.duration || 1) / 2, 0));
        });
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = node.videoWidth;
        canvas.height = node.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) { reject(new Error("Could not read this frame.")); return; }
        context.drawImage(node, 0, 0);
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not read this frame.")), "image/jpeg", 0.92);
      });
      const stored = await uploadFile(new File([blob], "reel-cover.jpg", { type: "image/jpeg" }));
      setFrames((current) => [stored.url, ...current.filter((url) => url !== stored.url)]);
      setCoverUrl(stored.url);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not use this frame");
    } finally {
      setCapturing(false);
    }
  }

  function togglePlay() {
    const node = videoRef.current;
    if (!node) return;
    if (node.paused) node.play().then(() => setPlaying(true)).catch(() => notify("This preview could not play in the browser."));
    else { node.pause(); setPlaying(false); }
  }

  async function save(submit: boolean) {
    if (caption.trim().length < 3) return notify("Add a caption of at least 3 characters.");
    if (caption.length > 500) return notify("Caption must be 500 characters or fewer.");
    if (!propertyId) return notify("Link this reel to a property.");
    if (uploading) return notify("Wait for the video upload to finish.");
    if (submit && !videoUrl) return notify("Upload a finished vertical video before submitting.");
    if (submit && !passes) return notify("Resolve the format, resolution, duration and file size before submitting.");
    if (submit && !coverUrl) return notify("Choose a cover image.");
    setBusy(true);
    try {
      let id = saved && saved.signature === signature ? saved.id : "";
      if (!id) {
        const created = await api("/api/reels", {
          method: "POST",
          body: {
            caption: caption.trim(), propertyId, agencyId: property?.agency?.id, agentId: agentId || undefined,
            videoUrl: videoUrl || undefined, coverUrl: coverUrl || undefined, kind: "REEL",
          },
        });
        id = created.id;
        setSaved({ id, signature });
      }
      if (!submit) {
        notify("Draft saved. Editing stays in the PlaceIn mobile app.");
        return;
      }
      const submitted = await api(`/api/reels/${id}/submit`, { method: "POST", body: {} });
      go("reels");
      notify(`Reel is ${pretty(submitted.publication)}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function mark(ok: boolean, known = true) {
    if (!chosen) return "wait";
    if (!known) return "fail";
    return ok ? "pass" : "fail";
  }
  const rules = [
    { title: "Format", standard: "MP4, MOV or WebM", detail: "Use MP4, MOV or WebM", state: mark(checks.formatOk) },
    { title: "Resolution", standard: "1080 × 1920 (9:16 portrait)", detail: chosen && checks.read ? `${checks.width} × ${checks.height}` : "Size could not be read", state: mark(resolutionOk, checks.read) },
    { title: "Duration", standard: "Up to 90 seconds", detail: chosen && checks.read && Number.isFinite(checks.duration) ? reelClock(checks.duration) : "Length could not be read", state: mark(durationOk, checks.read && Number.isFinite(checks.duration)) },
    { title: "File size", standard: "Up to 200\u00a0MB", detail: chosen ? bytesLabel(fileSize) : "Size could not be read", state: mark(checks.sizeOk) },
  ];

  return <>
    <div className="page-head"><div>
      <h1 className="with-back"><button type="button" onClick={() => go("reels")} aria-label="Back to reels"><Icons.ArrowLeft size={22} /></button>Upload reel</h1>
      <p>Upload your finished property reel. Add details, link to a property and submit for approval.</p>
    </div></div>
    <input ref={fileRef} hidden type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; onFile(file); }} />
    <div className="upload-layout">
      <section className="card panel">
        <h2>Video upload</h2>
        <p className="lead">Upload a finished vertical video. No editing here — use the PlaceIn mobile app to edit.</p>
        {previewUrl ? <div className={`reel-stage${over ? " over" : ""}`} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); onFile(event.dataTransfer.files?.[0]); }}><div className="reel-preview">
          <video ref={videoRef} src={previewUrl} playsInline onEnded={() => setPlaying(false)} onClick={togglePlay} />
          <button type="button" className="play" onClick={togglePlay} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? <Icons.Pause size={20} fill="currentColor" /> : <Icons.Play size={20} fill="currentColor" />}</button>
          {Number.isFinite(checks.duration) && <span className="time">{reelClock(checks.duration)}</span>}
        </div></div> : <label className={`drop reel-drop${over ? " over" : ""}`} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); onFile(event.dataTransfer.files?.[0]); }}>
          <Icons.Clapperboard size={28} />
          <b>Drag and drop a video here or <span>choose file</span></b>
          <small>MP4, MOV or WebM · Up to 200 MB · 9:16, at least 1080 × 1920 · Up to 90 seconds</small>
          <input hidden type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; onFile(file); }} />
        </label>}
        {(uploading || videoUrl) && <div className="upload-ok"><div className="ok-top"><Icons.CircleCheck size={18} /><div><b>{uploading ? "Uploading video" : "Video uploaded successfully"}</b><small>{fileName}{!uploading && <button type="button" className="text-replace" onClick={() => fileRef.current?.click()}>Replace</button>}</small></div><em>{bytesLabel(fileSize)}</em></div><div className="bar-line"><span className="progress"><i style={{ width: `${Math.round((uploading ? progress : 1) * 100)}%` }} /></span><em>{Math.round((uploading ? progress : 1) * 100)}%</em></div></div>}
        {chosen && !videoUrl && !uploading && <div className="inline-actions"><button type="button" className="btn outline sm" onClick={() => fileRef.current?.click()}>Replace video</button></div>}
        <div className="req-row">{rules.map((rule) => <article key={rule.title}>{rule.state === "fail" ? <Icons.CircleX className="fail" size={16} /> : rule.title === "Format" ? <Icons.FileText className={rule.state} size={16} /> : <Icons.CircleCheck className={rule.state} size={16} />}<span><b>{rule.title}</b><small>{rule.state === "fail" ? rule.detail : rule.standard}</small></span></article>)}</div>
        <div className="note edit-note"><Icons.Smartphone size={16} /><span><b>Need to edit your reel?</b>Open this draft in the PlaceIn mobile app to make edits with our video editor.</span><button type="button" className="btn outline sm" onClick={() => notify("Editing stays in the PlaceIn mobile app. This portal stores the finished upload and does not open an editor.")}><Icons.ExternalLink size={14} /> Open draft in app</button></div>
      </section>
      <section className="card panel">
        <h2>Reel details</h2>
        <label><span>Caption <span className="req-star">*</span></span><div className="caption-box"><textarea maxLength={500} value={caption} placeholder="Write the caption buyers will see." onChange={(event) => setCaption(event.target.value)} /><span>{caption.length} / 500</span></div></label>
        <label><span>Link to property <span className="req-star">*</span></span>
          <div className="picker">
            <button type="button" className={property ? "choice" : "choice plain"} onClick={() => { setOpenProperties((open) => !open); setOpenAgents(false); }}>
              {property ? <Thumb url={property.coverUrl} /> : <Icons.House size={18} />}
              <span><b>{property ? property.title : "Choose a property"}</b><small>{property ? `${property.project?.name ? `${property.project.name} · ` : ""}${property.area}, ${property.city}` : "Required before approval"}</small>{property && <small>{property.beds} beds · {property.baths} baths · {Number(property.sizeSqft || 0).toLocaleString()} sq ft · {money(property.price, property.currency)}</small>}</span>
              <Icons.ChevronDown size={16} />
            </button>
            {openProperties && <div className="menu">{rows.length === 0 && <p className="muted">No properties to link yet.</p>}{rows.map((row: any) => <button type="button" className="choice" key={row.id} onClick={() => { setPropertyId(row.id); setCoverUrl(""); setOpenProperties(false); }}><Thumb url={row.coverUrl} /><span><b>{row.title}</b><small>{row.project?.name ? `${row.project.name} · ` : ""}{row.area}, {row.city}</small><small>{row.beds} beds · {row.baths} baths · {Number(row.sizeSqft || 0).toLocaleString()} sq ft · {money(row.price, row.currency)}</small></span></button>)}</div>}
          </div>
        </label>
        <div className="pair-fields">
          <label>Project (inherited)<div className="choice plain inherited"><Icons.Folder size={16} /><b>{property?.project?.name || (property ? "No project on this listing" : "Choose a property first")}</b><Icons.ChevronDown size={16} /></div></label>
          <label>Assigned agent
            <div className="picker">
              <button type="button" className="choice plain" onClick={() => { setOpenAgents((open) => !open); setOpenProperties(false); }}>
                {agent ? <Avatar name={agent.name} /> : <Icons.UserRound size={18} />}
                <span><b>{agent ? agent.name : "Choose an agent"}</b><small>{agent ? pretty(agent.role) : "Uses your account if left empty"}</small></span>
                <Icons.ChevronDown size={16} />
              </button>
              {openAgents && <div className="menu">{agentRows.map((row: any) => <button type="button" className="choice plain" key={row.id} onClick={() => { setAgentId(row.id); setOpenAgents(false); }}><Avatar name={row.name} /><span><b>{row.name}</b><small>{pretty(row.role)}</small></span></button>)}</div>}
            </div>
          </label>
        </div>
        <div className="panel-head"><h3>Cover image <span className="req-star">*</span></h3><button type="button" className="linkish" disabled={!previewUrl || capturing || uploading} onClick={useFrame}><Icons.Crop size={15} />{capturing ? "Reading frame…" : "Use current frame"}</button></div>
        <p className="lead">Choose a cover image that will be shown before the reel plays.</p>
        {covers.length > 0 ? <div className="cover-row">{covers.map((cover) => <button type="button" key={cover.key} className={coverUrl === cover.url ? "on" : ""} style={{ backgroundImage: `url(${cover.url})` }} onClick={() => setCoverUrl(cover.url)} aria-label="Use this cover"><i><Icons.Check size={12} /></i></button>)}</div> : <p className="muted">{propertyId ? "This property has no photos yet. Use the current frame once the video preview is ready." : "Link a property to use its photos, or capture the current video frame."}</p>}
        <div className="upload-actions"><button type="button" className="btn outline" disabled={busy || uploading} onClick={() => save(false)}>Save draft</button><button type="button" className="btn gold" disabled={busy || uploading} onClick={() => save(true)}>Submit for approval <Icons.ArrowRight size={16} /></button></div>
      </section>
    </div>
  </>;
}

function Projects({ go }: { go: Go }) {
  const state = useQuery("/api/projects?pageSize=12");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "Lakeview Residences", city: "Kuala Lumpur", area: "Desa ParkCity", description: "A new project for the agency team.", units: "24" });
  async function create() {
    const row = await api("/api/projects", { method: "POST", body: { ...form, units: Number(form.units), propertyTypes: 2 } });
    go("project", row.id);
  }
  return <><Head title="Projects" sub="Organise your properties into projects and control team access."><button className="btn gold" onClick={() => setOpen(true)}><Icons.Plus size={16} /> Create project</button></Head>
    {open && <section className="card panel stack"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label>Area<input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="btn gold" onClick={() => create().catch((error) => alert(error.message))}>Save project</button></section>}
    <Gate state={state}>{(data) => <><p className="muted">{data.data.length} projects</p><div className="project-grid">{data.data.map((row: any) => <article className="project card" key={row.id}><div className="project-img" style={{ backgroundImage: `url(${row.imageUrl || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"})` }}><Badge status="ACTIVE">{pretty(row.status || "Active")}</Badge></div><div><h2>{row.name}</h2><p><Icons.MapPin size={14} /> {row.area}, {row.city}</p><p>{row.description}</p><div className="project-meta"><b><Icons.House size={16} /> {row.listings} listings</b><b><Icons.Users size={16} /> {row.assignedAgents} agents</b></div><button className="btn gold" onClick={() => go("project", row.id)}>View project <Icons.ArrowRight size={16} /></button></div></article>)}</div></>}</Gate></>;
}
function ProjectDetail({ id, go }: { id: string; go: Go }) {
  const state = useQuery(id ? `/api/projects/${id}` : null);
  if (!id) return <PickFirst path="/api/projects?pageSize=1" go={(value) => go("project", value)} label="project" />;
  return <Gate state={state}>{(row) => <><Head title={row.name} sub={`${row.area}, ${row.city} · ${row.units} units · ${row.agency.name}`} /><section className="card panel"><p>{row.description}</p><h3>Assigned agents</h3>{row.agents.map((agent: any) => <button key={agent.id} className="btn outline" onClick={() => go("agent", agent.id)}>{agent.name}</button>)}<h3>Properties</h3><Table columns={["Reference", "Title", "Status"]} rows={row.properties.map((property: any) => [property.reference, property.title, property.status])} onRow={(index) => go("property", row.properties[index].id)} /></section></>}</Gate>;
}

function People({ team, go, countryQuery }: { team: boolean; go: Go; countryQuery: string }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const state = useQuery(`/api/agents?page=${page}&pageSize=10&q=${encodeURIComponent(q)}&status=${status}${countryQuery ? `&${countryQuery}` : ""}`);
  const [picked, setPicked] = useState(0);
  return <><Head code={team ? undefined : "04 / 24"} title={team ? "Team" : "Agents directory"} sub={team ? "People in your agency. Passwords are never shown." : "Individual agent accounts across all agencies. Access stays inside each agency membership."} />
    <div className="filters"><input value={q} placeholder="Search agent name or email" onChange={(event) => { setQ(event.target.value); setPage(1); }} /><Select value={status} set={setStatus} options={["", "ACTIVE", "INVITED", "RESTRICTED", "DEACTIVATED", "REVIEW"]} labels={["Account status", "Active", "Invited", "Restricted", "Deactivated", "Review"]} /></div>
    <Gate state={state}>{(data) => {
      const current = data.data[picked] || data.data[0];
      return <div className="split"><div><Table active={picked} columns={["Agent", "Agency", "Role", "Listings", "Status", "Last active", ""]} rows={data.data.map((row: any) => [<Who key={row.id} name={row.name} sub={row.email} />, row.agency.name, pretty(row.role), row.propertyCount, <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>, day(row.lastActivityAt), <button key="v" className="btn outline sm">View</button>])} onRow={setPicked} /><Pager data={data} page={page} setPage={setPage} /></div>
        {current && <aside className="card rail"><Avatar name={current.name} /><h2>{current.name}</h2><p className="muted">{current.agency.name} · {pretty(current.role)}</p><div className="kv"><span>Listings</span><b>{current.propertyCount}</b><span>Projects</span><b>{current.projectCount}</b><span>Status</span><b>{pretty(current.status)}</b><span>Last active</span><b>{when(current.lastActivityAt)}</b></div><button className="btn gold" onClick={() => go("agent", current.id)}>Open agent profile</button><Note>There is no individual agent invoice. Accounts sit inside the agency monthly plan.</Note></aside>}
      </div>;
    }}</Gate></>;
}
function AgentDetail({ id, go, notify }: { id: string; go: Go; notify: (s: string) => void }) {
  const state = useQuery(id ? `/api/agents/${id}` : null);
  const colleagues = useQuery(id ? null : null);
  const [flags, setFlags] = useState<any>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("Agent left the agency.");
  useEffect(() => { if (state.data) setFlags(state.data); }, [state.data]);
  if (!id) return <PickFirst path="/api/agents?pageSize=1&status=ACTIVE" go={(value) => go("agent", value)} label="agent" />;
  async function save() {
    await api(`/api/agents/${id}`, { method: "PATCH", body: { canCreateListings: flags.canCreateListings, canUploadReels: flags.canUploadReels, canManageEnquiries: flags.canManageEnquiries, canViewProjects: flags.canViewProjects, publishRequiresApproval: flags.publishRequiresApproval } });
    notify("Permissions saved.");
    state.reload();
  }
  async function reassign() {
    try { await api(`/api/agents/${id}/reassign`, { method: "POST", body: { toAgentId: target, reason, deactivate: true } }); notify("Open work moved. The departing account is deactivated."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not reassign"); }
  }
  const permissionCopy: Record<string, [string, string]> = {
    canCreateListings: ["Create and edit assigned listings", "Allow the agent to create and edit listings assigned to them."],
    canUploadReels: ["Upload reels", "Allow the agent to upload finished property reels."],
    canManageEnquiries: ["Manage assigned enquiries and appointments", "Allow the agent to handle enquiries and appointments for assigned work."],
    canViewProjects: ["View projects", "Allow the agent to open projects in this agency."],
    publishRequiresApproval: ["Publish without approval", "When off, a manager must approve before content goes live."],
  };
  return <Gate state={state}>{(row) => <>
    <Head code="05 / 24" title={row.name} sub={`${pretty(row.role)} at ${row.agency.name} · ${row.email}`} crumb={<button className="btn ghost sm" onClick={() => go("agents")}><Icons.ArrowLeft size={14} /> Back to agents</button>}><Badge status={row.status}>{pretty(row.status)}</Badge><button className="btn gold" onClick={() => save().catch((error) => notify(error.message))}>Save changes</button></Head>
    <div className="who" style={{ marginBottom: 14 }}><Avatar name={row.name} /><p><b>{row.name}</b><small>{row.agency.name} · {row.agency.country}</small></p></div>
    <Metrics><Stat icon="House" title="Available listings" value={row.properties.length} note="Assigned now" tone="green" /><Stat icon="MessageSquareText" title="Recent enquiries" value={row.enquiries.length} note={row.medianResponseMinutes ? `${row.medianResponseMinutes} min median response` : "No answered enquiries yet"} tone="pink" /><Stat icon="CalendarDays" title="Appointments" value={row.appointments.length} note="Latest records" tone="purple" /><Stat icon="Shield" title="Password" value="Hashed" note="Never returned by the API" /></Metrics>
    <div className="grid three"><section className="card panel"><h2>Basic information</h2><div className="kv"><span>Full name</span><b>{row.name}</b><span>Role</span><b>{pretty(row.role)}</b><span>Email</span><b>{row.email}</b><span>Status</span><b>{pretty(row.status)}</b><span>Agency</span><b>{row.agency.name}</b></div></section>
      <section className="card panel"><h2>Permissions</h2><p className="muted">Changes apply inside this agency only.</p>{flags && Object.keys(permissionCopy).map((key) => <button key={key} className="toggle-row" onClick={() => setFlags({ ...flags, [key]: !flags[key] })}><span>{permissionCopy[key][0]}<small>{permissionCopy[key][1]}</small></span><i className={flags[key] ? "on" : ""}><b /></i></button>)}</section>
      <div><section className="card panel"><h2>Assigned projects</h2>{row.projects.map((project: any) => <button key={project.id} className="list-row" onClick={() => go("project", project.id)}><Thumb url={project.imageUrl} /><span className="stack-name"><b>{project.name}</b><small>{project.city}</small></span></button>)}{!row.projects.length && <div className="empty">No projects assigned.</div>}</section><ReassignBox agencyId={row.agencyId} self={row.id} target={target} setTarget={setTarget} reason={reason} setReason={setReason} onSave={reassign} /></div></div>
    <Table columns={["Property", "Reference", "Publication", "Status"]} rows={row.properties.map((property: any) => [<div className="who" key={property.id}><Thumb url={property.coverUrl} /><b>{property.title}</b></div>, property.reference, <Badge key="p" status={property.publication}>{pretty(property.publication)}</Badge>, <Badge key="s" status={property.status}>{pretty(property.status)}</Badge>])} onRow={(index) => go("property", row.properties[index].id)} />
  </>}</Gate>;
}
function ReassignBox({ agencyId, self, target, setTarget, reason, setReason, onSave }: { agencyId: string; self: string; target: string; setTarget: (v: string) => void; reason: string; setReason: (v: string) => void; onSave: () => void }) {
  const state = useQuery(`/api/agents?pageSize=50&agencyId=${agencyId}`);
  return <section className="card panel stack"><h2>When this agent leaves</h2><p>Open listings, enquiries, future appointments and projects move to another person in the same agency.</p><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Choose a colleague</option>{(state.data?.data || []).filter((row: any) => row.id !== self && row.status === "ACTIVE").map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><button className="btn outline" onClick={onSave}>Reassign and deactivate</button></section>;
}

function medianOf(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}
function clock(seconds?: number | null) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}
function sameCurrency(rows: any[], amount: (row: any) => number) {
  const codes = [...new Set(rows.map((row) => row.currency).filter(Boolean))];
  if (codes.length !== 1) return null;
  return money(rows.reduce((sum, row) => sum + amount(row), 0), codes[0]);
}

function Enquiries({ countryQuery, session, go }: { countryQuery: string; session: Session; go: Go }) {
  const staff = session.user.kind === "staff";
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [unassigned, setUnassigned] = useState("");
  const [picked, setPicked] = useState(0);
  const state = useQuery(`/api/enquiries?page=${page}&pageSize=8&status=${status}&channel=${channel}&unassigned=${unassigned}${countryQuery ? `&${countryQuery}` : ""}`);
  async function update(id: string, body: unknown) { await api(`/api/enquiries/${id}`, { method: "PATCH", body }); state.reload(); }
  return <><Head code={staff ? "14 / 24" : undefined} title={staff ? "Enquiries and connections" : "Enquiries"} sub={staff ? "Monitor leads, agency responses and follow-up. Contact taps, requests and conversations are separate. Private message text is not stored." : "Leads for your agency. Private message text is not stored."} />
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      const answered = rows.filter((row: any) => row.status === "ANSWERED").length;
      const waiting = rows.filter((row: any) => row.responseMinutes == null).length;
      const unassignedCount = rows.filter((row: any) => !row.agent).length;
      const med = medianOf(rows.map((row: any) => row.responseMinutes));
      return <>
        <Metrics cols={5}><Stat icon="MessageSquareText" title="Enquiries" value={data.total} note="Matching these filters" /><Stat icon="Users" title="On this page" value={rows.length} note={`${answered} answered`} tone="purple" /><Stat icon="Clock" title="Median first response" value={med == null ? "—" : `${med} min`} note="Calculated on this page" tone="orange" /><Stat icon="TriangleAlert" title="Waiting" value={waiting} note="No response time yet" tone="red" /><Stat icon="UserRound" title="Unassigned" value={unassignedCount} note="On this page" /></Metrics>
        <Note>Contact taps, call requests and conversations are separate measures. A call-button tap does not confirm a completed call. Conversation content stays private.</Note>
        <div className="filters"><Select value={status} set={setStatus} options={["", "NEW", "ASSIGNED", "ANSWERED", "UNANSWERED", "CLOSED"]} labels={["All statuses", "New", "Assigned", "Answered", "Unanswered", "Closed"]} /><Select value={channel} set={setChannel} options={["", "IN_APP", "CALL_REQUEST", "CONTACT_TAP", "CONVERSATION"]} labels={["All sources", "PlaceIn message", "Call request", "Contact tap", "Conversation"]} /><Select value={unassigned} set={setUnassigned} options={["", "true"]} labels={["All assignments", "Unassigned only"]} /></div>
        <div className="split"><div>
          <Table active={picked} columns={["User", "Property", "Agency / agent", "Channel", "Response", "Status"]} rows={rows.map((row: any) => [<Who key={row.id} name={row.customer?.name} sub={row.summary} />, <span key="p" className="stack-name"><b>{row.property?.title || "—"}</b><small>{row.property?.reference}</small></span>, <span key="a" className="stack-name"><b>{row.agency?.name || "—"}</b><small>{row.agent?.name || "Unassigned"}</small></span>, pretty(row.channel), row.responseMinutes == null ? "Waiting" : `${row.responseMinutes} min`, <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>])} onRow={setPicked} />
          <Pager data={data} page={page} setPage={setPage} />
        </div>
          <aside className="card rail">{current ? <>
            <div className="panel-head"><Avatar name={current.customer?.name} /><div><h2>{current.customer?.name}</h2><p className="muted">{current.customer?.countryName || "Free user"}</p></div><Badge status={current.status}>{pretty(current.status)}</Badge></div>
            <div className="kv"><span>Property</span><b>{current.property?.title || "—"}</b><span>Reference</span><b>{current.property?.reference || "—"}</b><span>Agency</span><b>{current.agency?.name || "—"}</b><span>Agent</span><b>{current.agent?.name || "Unassigned"}</b><span>Channel</span><b>{pretty(current.channel)}</b><span>Created</span><b>{when(current.createdAt)}</b><span>First response</span><b>{current.responseMinutes == null ? "Waiting" : `${current.responseMinutes} min`}</b></div>
            <Note>{current.privateMessage || "Private message text is not stored."}</Note>
            <div className="stack">{current.property?.id && <button className="btn outline" onClick={() => go("property", current.property.id)}>View property</button>}{staff && current.agency?.id && <button className="btn outline" onClick={() => go("agency", current.agency.id)}>View agency</button>}{staff && current.customer?.id && <button className="btn outline" onClick={() => go("user", current.customer.id)}>View user</button>}<button className="btn gold" onClick={() => update(current.id, { status: "ANSWERED" }).catch((error) => alert(error.message))}>Mark answered</button></div>
          </> : <p>No enquiry matches these filters.</p>}</aside></div>
        <div className="follow"><section className="card panel"><h3>Waiting on this page</h3><strong>{waiting}</strong><p className="muted">No first response recorded yet.</p></section><section className="card panel"><h3>Unassigned</h3><strong>{unassignedCount}</strong><p className="muted">Leads with no agent on this page.</p></section><section className="card panel"><h3>Answered</h3><strong>{answered}</strong><p className="muted">Marked answered on this page.</p></section></div>
      </>;
    }}</Gate></>;
}
function Appointments({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const staff = session.user.kind === "staff";
  const state = useQuery("/api/appointments?pageSize=50");
  const users = useQuery("/api/users?pageSize=20");
  const properties = useQuery("/api/properties?pageSize=20");
  const [form, setForm] = useState({ kind: "VIEWING", freeUserId: "", propertyId: "", startsAt: "", timezone: "Asia/Kuala_Lumpur" });
  const [showForm, setShowForm] = useState(false);
  const [picked, setPicked] = useState(0);
  const [mode, setMode] = useState(staff ? "list" : "week");
  async function create() {
    try { await api("/api/appointments", { method: "POST", body: { ...form, status: "CONFIRMED" } }); notify("Appointment booked. A clash within the same hour is rejected."); setShowForm(false); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not book"); }
  }
  async function setStatus(id: string, status: string) {
    try { await api(`/api/appointments/${id}`, { method: "PATCH", body: { status, reason: `Marked ${status}` } }); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not update"); }
  }
  return <><Head code={staff ? "15 / 24" : undefined} title={staff ? "Appointments overview" : "Appointments"} sub="Viewings, video calls and office visits. Times keep the property timezone. Confirmed bookings cannot overlap the same agent."><button className="btn gold" onClick={() => setShowForm((open) => !open)}><Icons.Plus size={16} /> New appointment</button></Head>
    {showForm && <section className="card panel stack"><h2>New appointment</h2><div className="filters"><Select value={form.kind} set={(kind) => setForm({ ...form, kind })} options={["VIEWING", "VIDEO_CALL", "OFFICE"]} /><select value={form.freeUserId} onChange={(event) => setForm({ ...form, freeUserId: event.target.value })}><option value="">Customer</option>{(users.data?.data || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><select value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })}><option value="">Property</option>{(properties.data?.data || []).map((row: any) => <option key={row.id} value={row.id}>{row.title}</option>)}</select><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /><button className="btn gold" onClick={create}>Book</button></div><p>The appointment is attached to the property’s agency. Two confirmed bookings for the same agent inside one hour are rejected.</p></section>}
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      const count = (status: string) => rows.filter((row: any) => row.status === status).length;
      const anchor = rows[0] ? new Date(rows[0].startsAt) : new Date();
      const start = new Date(anchor);
      const offset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
      const onDay = (date: Date) => rows.filter((row: any) => new Date(row.startsAt).toDateString() === date.toDateString());
      return <>
        <Metrics cols={5}><Stat icon="CalendarDays" title="Requested" value={count("REQUESTED")} note="Loaded bookings" /><Stat icon="CircleCheck" title="Confirmed" value={count("CONFIRMED")} note="Loaded bookings" tone="green" /><Stat icon="CalendarCheck" title="Completed" value={count("COMPLETED")} note="A viewing is not a purchase" tone="purple" /><Stat icon="CircleX" title="Cancelled" value={count("CANCELLED")} note="Loaded bookings" tone="red" /><Stat icon="TriangleAlert" title="No-shows" value={count("NO_SHOW")} note="Loaded bookings" tone="orange" /></Metrics>
        <div className="filters"><span className="muted">Times use each booking’s own timezone.</span><button className={`btn sm ${mode === "list" ? "gold" : "outline"}`} onClick={() => setMode("list")}>List</button><button className={`btn sm ${mode === "week" ? "gold" : "outline"}`} onClick={() => setMode("week")}>Week</button></div>
        <div className="split"><div>
          {mode === "week" ? <div className="cal"><b /><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b><b>Sat</b><b>Sun</b><span>Week of {day(start.toISOString())}</span>{days.map((date) => <span className="slot" key={date.toISOString()}>{date.getDate()}{onDay(date).map((row: any) => { const index = rows.indexOf(row); return <button key={row.id} className={`event ${tone(row.status)}`} onClick={() => setPicked(index)}>{new Date(row.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {row.customer?.name}</button>; })}{!onDay(date).length && <em> </em>}</span>)}</div> : <Table active={picked} columns={["When", "Property", "Agency / agent", "Customer", "Type", "Status"]} rows={rows.map((row: any) => [when(row.startsAt), row.property?.title || "—", <span key="a" className="stack-name"><b>{row.agency?.name || "—"}</b><small>{row.agent?.name || "Unassigned"}</small></span>, row.customer?.name, pretty(row.kind), <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>])} onRow={setPicked} />}
          <Pager data={data} page={1} setPage={() => undefined} />
        </div>
          <aside className="card rail">{current ? <>
            <div className="panel-head"><div><h2>{current.property?.title || "Appointment"}</h2><p className="muted">{pretty(current.kind)} · {current.timezone}</p></div><Badge status={current.status}>{pretty(current.status)}</Badge></div>
            <div className="kv"><span>When</span><b>{when(current.startsAt)}</b><span>Timezone</span><b>{current.timezone}</b><span>Customer</span><b>{current.customer?.name}</b><span>Agency</span><b>{current.agency?.name || "—"}</b><span>Agent</span><b>{current.agent?.name || "—"}</b></div>
            <div className="inline-actions"><button className="btn gold" onClick={() => setStatus(current.id, "CONFIRMED")}>Confirm</button><button className="btn outline" onClick={() => setStatus(current.id, "RESCHEDULE_PROPOSED")}>Suggest new time</button><button className="btn danger" onClick={() => setStatus(current.id, "CANCELLED")}>Decline</button></div>
            <div className="stack" style={{ marginTop: 10 }}>{current.property?.id && <button className="btn outline" onClick={() => go("property", current.property.id)}>View property</button>}{staff && current.agency?.id && <button className="btn outline" onClick={() => go("agency", current.agency.id)}>View agency</button>}{staff && current.customer?.id && <button className="btn outline" onClick={() => go("user", current.customer.id)}>View user</button>}</div>
            <p className="muted">A completed viewing does not confirm a property purchase.</p>
          </> : <p>No appointments yet.</p>}</aside></div>
      </>;
    }}</Gate></>;
}
function Offers({ notify, go }: { notify: (s: string) => void; go: Go }) {
  const state = useQuery("/api/offers?pageSize=50");
  const [picked, setPicked] = useState(0);
  async function setStatus(id: string, status: string) {
    const result = await api(`/api/offers/${id}`, { method: "PATCH", body: { status, reason: `Marked ${status}` } });
    notify(result.note || "Offer updated.");
    state.reload();
  }
  return <><Head code="13 / 24" title="Buyer activity and offers" sub="Track property-seeker actions and agency responses. An accepted offer does not mark the property sold." />
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      const count = (status: string) => rows.filter((row: any) => row.status === status).length;
      return <>
        <Metrics><Stat icon="FileText" title="Offers" value={data.total} note="Loaded records" /><Stat icon="Clock" title="Submitted" value={count("SUBMITTED")} note="Waiting for the agency" tone="orange" /><Stat icon="CircleCheck" title="Acknowledged" value={count("ACKNOWLEDGED")} note="Agency has seen the offer" tone="green" /><Stat icon="BadgeCheck" title="Accepted" value={count("ACCEPTED")} note="Does not mark the home sold" tone="purple" /></Metrics>
        <Note>{current?.rule || "Accepting an offer does not mark the property sold. PlaceIn does not complete the purchase."}</Note>
        <div className="split"><div><Table active={picked} columns={["User", "Property", "Amount", "Property status", "Offer"]} rows={rows.map((row: any) => [<Who key={row.id} name={row.user?.name} />, <span key="p" className="stack-name"><b>{row.property?.title}</b><small>{row.property?.reference}</small></span>, money(row.amount, row.currency), <Badge key="ps" status={row.property?.status}>{pretty(row.property?.status)}</Badge>, <Badge key="os" status={row.status}>{pretty(row.status)}</Badge>])} onRow={setPicked} /></div>
          <aside className="card rail">{current ? <>
            <div className="panel-head"><Avatar name={current.user?.name} /><div><h2>{current.user?.name}</h2><p className="muted">Free account</p></div><Badge status={current.status}>{pretty(current.status)}</Badge></div>
            <div className="kv"><span>Property</span><b>{current.property?.title}</b><span>Reference</span><b>{current.property?.reference || "—"}</b><span>Offer</span><b>{money(current.amount, current.currency)}</b><span>Property status</span><b>{pretty(current.property?.status)}</b><span>Submitted</span><b>{when(current.createdAt)}</b></div>
            <label>Offer status<select value={current.status} onChange={(event) => setStatus(current.id, event.target.value).catch((error) => notify(error.message))}>{["SUBMITTED", "ACKNOWLEDGED", "ACCEPTED", "DECLINED", "WITHDRAWN"].map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label>
            <div className="stack" style={{ marginTop: 10 }}><button className="btn outline" onClick={() => go("user", current.user.id)}>View user</button><button className="btn outline" onClick={() => go("property", current.property.id)}>View property</button></div>
            <Note>No completed purchase is recorded here. An accepted offer is not a sold property.</Note>
          </> : <p>No offers yet.</p>}</aside></div>
        <div className="follow"><section className="card panel"><h3>Awaiting response</h3><strong>{count("SUBMITTED")}</strong><p className="muted">Offers still marked submitted.</p></section><section className="card panel"><h3>Declined or withdrawn</h3><strong>{count("DECLINED") + count("WITHDRAWN")}</strong><p className="muted">Closed without acceptance.</p></section><section className="card panel"><h3>Accepted, still listed</h3><strong>{rows.filter((row: any) => row.status === "ACCEPTED" && row.property?.status !== "SOLD").length}</strong><p className="muted">Acceptance does not change the listing to sold.</p></section></div>
      </>;
    }}</Gate></>;
}
function Outcomes({ notify, go }: { notify: (s: string) => void; go: Go }) {
  const state = useQuery("/api/outcomes?pageSize=50");
  const [reason, setReason] = useState("Corrected after the agency checked the file.");
  const [picked, setPicked] = useState(0);
  const [nextOutcome, setNextOutcome] = useState("WITHDRAWN");
  async function correct(id: string) {
    await api(`/api/outcomes/${id}/correct`, { method: "POST", body: { outcome: nextOutcome, reason } });
    notify("Correction stored. The previous outcome is kept.");
    state.reload();
  }
  return <><Head code="08 / 24" title="Reported property outcomes" sub="Outcomes are reported by agencies. Property transactions happen outside PlaceIn. These are not commission records." />
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      return <><Metrics><Stat icon="House" title="Sold" value={data.summary.sold} note="Agency reported" /><Stat icon="KeyRound" title="Let" value={data.summary.let} note="Agency reported" tone="purple" /><Stat icon="Ban" title="Withdrawn" value={data.summary.withdrawn} note="Agency reported" tone="orange" /><Stat icon="Clock" title="Median days" value={data.summary.medianDaysAdvertised ?? "—"} note="Days advertised" /></Metrics>
        <Note>{data.notice}</Note>
        <div className="split"><div><Table active={picked} columns={["Property", "Agency", "Outcome", "Days advertised", "PlaceIn lead"]} rows={rows.map((row: any) => [<span key={row.id} className="stack-name"><b>{row.property.title}</b><small>{row.property.reference}</small></span>, row.agency.name, <Badge key="o" status={row.outcome}>{pretty(row.outcome)}</Badge>, row.advertisedDays, row.leadAttributedToPlaceIn == null ? "Unknown" : row.leadAttributedToPlaceIn ? "Yes" : "No"])} onRow={setPicked} /></div>
          <aside className="card rail">{current ? <>
            <div className="panel-head"><div><h2>{current.property.title}</h2><p className="muted">{current.property.reference} · {current.agency.name}</p></div><Badge status={current.outcome}>{pretty(current.outcome)}</Badge></div>
            <div className="kv"><span>Reported</span><b>{day(current.statusDate)}</b><span>Days advertised</span><b>{current.advertisedDays}</b><span>PlaceIn lead</span><b>{current.leadAttributedToPlaceIn == null ? "Unknown" : current.leadAttributedToPlaceIn ? "Yes" : "No"}</b><span>Previous</span><b>{current.correctedFrom || "—"}</b></div>
            <p>{current.note || "No note on this report."}</p>
            <div className="stack"><Select value={nextOutcome} set={setNextOutcome} options={["SOLD", "LET", "WITHDRAWN"]} /><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><button className="btn gold" onClick={() => correct(current.id).catch((error) => notify(error.message))}>Save correction</button><button className="btn outline" onClick={() => go("property", current.property.id)}>View property</button></div>
          </> : <p>No reported outcomes yet.</p>}</aside></div>
      </>;
    }}</Gate></>;
}

function Moderation({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const staff = session.user.kind === "staff";
  const [queue, setQueue] = useState(staff ? "CONTENT_REVIEW" : "");
  const state = useQuery("/api/moderation?pageSize=50&decision=PENDING");
  const [reason, setReason] = useState("Checked against the listing rules.");
  const [current, setCurrent] = useState<any>(null);
  async function decide(id: string, decision: string) {
    try { await api(`/api/moderation/${id}/decide`, { method: "POST", body: { decision, reason } }); notify(`${pretty(decision)} recorded.`); setCurrent(null); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Decision failed"); }
  }
  const queueCount = (name: string) => state.data?.queues?.find((row: any) => row.queue === name)?.count ?? 0;
  const blocked = current?.queue === "QUALITY_FAILURE";
  return <><Head code={staff ? "10 / 24" : undefined} title={staff ? "Approvals and moderation" : "Approval queue"} sub="Review agency verification, content quality and reported issues. A quality failure cannot be approved." />
    <Metrics><Stat icon="Users" title="Agency applications" value={queueCount("AGENCY_VERIFICATION")} note="Pending queue" tone="purple" /><Stat icon="Image" title="Content awaiting review" value={queueCount("CONTENT_REVIEW")} note="Pending queue" /><Stat icon="TriangleAlert" title="Quality failures" value={queueCount("QUALITY_FAILURE")} note="Hard fails block publish" tone="red" /><Stat icon="Flag" title="Reports and appeals" value={queueCount("USER_REPORT") + queueCount("APPEAL")} note="Open queues" tone="orange" /></Metrics>
    <div className="tabs">{[["", "All queues"], ["AGENCY_VERIFICATION", "Agency verification"], ["CONTENT_REVIEW", "Content review"], ["QUALITY_FAILURE", "Quality failures"], ["USER_REPORT", "Reported content"], ["APPEAL", "Appeals"]].map(([item, label]) => <button key={label} className={queue === item ? "selected" : ""} onClick={() => { setQueue(item); setCurrent(null); }}>{label}</button>)}</div>
    <Gate state={state}>{(data) => {
      const visible = queue ? data.data.filter((row: any) => row.queue === queue) : data.data;
      return <div className="approval"><section className="review-list card">{visible.map((row: any) => <button key={row.id} className={current?.id === row.id ? "selected-item" : ""} onClick={() => setCurrent(row)}><p><b>{row.subject}</b><small>{pretty(row.queue)} · {row.reason}</small></p><Badge status={row.priority === "High" ? "HIGH" : "ACTIVE"}>{row.priority}</Badge></button>)}{!visible.length && <div className="empty">This queue is clear.</div>}</section>
      <section className="review-detail card">{current && (!queue || current.queue === queue) ? <><h2>{current.subject}</h2><div className="kv"><span>Queue</span><b>{pretty(current.queue)}</b><span>Agency</span><b>{current.agency?.name || "—"}</b><span>Reason</span><b>{current.reason}</b><span>Priority</span><b>{current.priority}</b></div>{blocked && <div className="error-box">Publication blocked. A quality failure cannot be approved until the file is replaced.</div>}<textarea value={reason} onChange={(event) => setReason(event.target.value)} /><div className="inline-actions"><button className="btn gold" disabled={blocked} onClick={() => decide(current.id, "APPROVED")}>Approve</button><button className="btn outline" onClick={() => decide(current.id, "CHANGES_REQUESTED")}>Request changes</button><button className="btn outline" onClick={() => decide(current.id, "REJECTED")}>Reject</button><button className="btn danger" onClick={() => decide(current.id, "TAKEN_DOWN")}>Take down</button>{current.agency?.id && <button className="btn outline" onClick={() => go("agency", current.agency.id)}>View agency</button>}</div><p className="muted">The decision, reviewer and reason are stored. The draft stays available for a replacement.</p></> : <p>Select an item. The decision, reviewer and reason are stored.</p>}</section></div>;
    }}</Gate></>;
}

function Agencies({ go, countryQuery, session, notify }: { go: Go; countryQuery: string; session: Session; notify: (s: string) => void }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const state = useQuery(`/api/agencies?page=${page}&pageSize=8&q=${encodeURIComponent(q)}&status=${status}&payment=${payment}${countryQuery ? `&${countryQuery}` : ""}`);
  const [form, setForm] = useState({ name: "New Agency", countryCode: "MY", city: "Penang", address: "1 Beach Street", email: "new.agency@placein.test", phone: "+60 4 000 0000" });
  async function create() {
    try { const row = await api("/api/agencies", { method: "POST", body: form }); notify(`${row.name} is in verification.`); go("agency", row.id); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not create"); }
  }
  const [picked, setPicked] = useState(0);
  const [showForm, setShowForm] = useState(false);
  return <><Head code="02 / 24" title="Agencies directory" sub="Manage agency accounts, listings and monthly fee payments.">
    {session.user.role !== "MAINTENANCE" && <button className="btn gold" onClick={() => setShowForm((open) => !open)}><Icons.Plus size={16} /> Invite agency</button>}
    <button className="btn outline" onClick={() => downloadCsv("agencies").catch((error) => notify(error.message))}><Icons.Download size={16} /> Export</button>
  </Head>
    {showForm && <section className="card panel"><div className="filters">{Object.entries(form).map(([key, value]) => <input key={key} value={value} placeholder={pretty(key)} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}<button className="btn gold" onClick={create}>Create agency</button></div></section>}
    <div className="filters"><input value={q} placeholder="Search agency name or reference" onChange={(event) => { setQ(event.target.value); setPage(1); }} /><Select value={status} set={setStatus} options={["", "ACTIVE", "REVIEW", "RESTRICTED", "SUSPENDED"]} labels={["Account status", "Active", "Review", "Restricted", "Suspended"]} /><Select value={payment} set={setPayment} options={["", "ACTIVE", "TRIAL", "PAST_DUE", "OVERDUE"]} labels={["Payment status", "Active", "Trial", "Past due", "Overdue"]} /></div>
    <Gate state={state}>{(data) => {
      const current = data.data[picked] || data.data[0];
      return <div className="split"><div><Table active={picked} columns={["Agency", "Country", "Agents", "Live homes", "Plan", "Payment", "Account", ""]} rows={data.data.map((row: any) => [<Who key={row.id} name={row.name} sub={row.code} />, row.country, row.agentCount, row.availableProperties, row.plan || "Hidden", <Badge key="pay" status={row.paymentStatus || "ACTIVE"}>{pretty(row.paymentStatus || "Hidden")}</Badge>, <Badge key="st" status={row.status}>{pretty(row.status)}</Badge>, <button key="v" className="btn outline sm">View</button>])} onRow={setPicked} /><Pager data={data} page={page} setPage={setPage} /></div>
        {current && <aside className="card rail"><Avatar name={current.name} /><h2>{current.name}</h2><p className="muted">{current.country} · {current.code}</p><div className="kv"><span>Agents</span><b>{current.agentCount}</b><span>Live homes</span><b>{current.availableProperties}</b><span>Plan</span><b>{current.plan || "Hidden"}</b><span>Payment</span><b>{pretty(current.paymentStatus || "Hidden")}</b><span>Joined</span><b>{day(current.joinedAt)}</b></div><button className="btn gold" onClick={() => go("agency", current.id)}>Open agency profile</button></aside>}
      </div>;
    }}</Gate></>;
}
function AgencyDetail({ id, go, notify, session }: { id: string; go: Go; notify: (s: string) => void; session: Session }) {
  const state = useQuery(id ? `/api/agencies/${id}` : null);
  const [tab, setTab] = useState("Overview");
  const [reason, setReason] = useState("Verification documents checked.");
  if (!id) return <PickFirst path="/api/agencies?pageSize=1" go={(value) => go("agency", value)} label="agency" />;
  async function status(next: string) {
    try { await api(`/api/agencies/${id}/status`, { method: "POST", body: { status: next, reason } }); notify(`Status set to ${next}.`); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not change status"); }
  }
  return <Gate state={state}>{(row) => <>
    <Head code="03 / 24" title={row.name} sub={`${row.code} · ${row.city}, ${row.country} · Owner contact ${row.email} · Joined ${day(row.joinedAt)}`} crumb={<div className="crumb"><button onClick={() => go("agencies")}>Agencies</button> · {row.name}</div>}><Badge status={row.verification}>{pretty(row.verification)}</Badge><Badge status={row.status}>{pretty(row.status)}</Badge></Head>
    {row.financeHidden && <div className="banner">Subscription fees and invoices are hidden for this role.</div>}
    <div className="tabs">{["Overview", "Agents", "Projects", "Properties", "Media", "Leads", "Appointments", "Outcomes", "Subscription", "Invoices", "Activity"].map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === "Overview" && <><Metrics><Stat icon="Users" title="Agent accounts" value={row.agentCount} note={`Allowance ${row.agentAllowance}`} /><Stat icon="House" title="Available properties" value={row.availableProperties} note={`Listing allowance ${row.listingAllowance}`} tone="purple" /><Stat icon="MessageSquareText" title="Leads on file" value={row.leads.length} note="Latest page" tone="pink" /><Stat icon="CalendarCheck" title="Appointments" value={row.appointments.length} note="Latest page" tone="green" /></Metrics><div className="grid two"><section className="card panel"><h2>Agency contact</h2><div className="kv"><span>Email</span><b>{row.email}</b><span>Phone</span><b>{row.phone}</b><span>Website</span><b>{row.website || "—"}</b><span>Address</span><b>{row.address}</b><span>Last activity</span><b>{when(row.lastActivityAt)}</b></div><p>{row.description}</p>{session.user.role !== "MAINTENANCE" && session.user.kind === "staff" && <div className="stack"><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><div className="inline-actions"><button className="btn gold" onClick={() => status("ACTIVE")}>Activate</button><button className="btn outline" onClick={() => status("RESTRICTED")}>Restrict</button><button className="btn danger" onClick={() => status("SUSPENDED")}>Suspend</button></div></div>}</section><section className="card panel"><h2>Subscription and payments</h2>{row.subscription ? <div className="kv"><span>Plan</span><b>{row.subscription.plan}</b><span>Status</span><b>{pretty(row.subscription.status)}</b><span>Fee</span><b>{money(row.subscription.monthlyFee, row.subscription.currency)}</b><span>Renews</span><b>{day(row.subscription.renewsAt)}</b></div> : <p>No subscription is visible for this role.</p>}<div className="inline-actions"><button className="btn gold" onClick={() => setTab("Invoices")}>View invoices</button><button className="btn outline" onClick={() => setTab("Subscription")}>Manage subscription</button></div></section></div>
      <div className="grid two"><section className="card panel"><h2>Projects</h2><div className="project-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>{row.projects.slice(0, 3).map((project: any) => <button key={project.id} className="card" style={{ textAlign: "left", padding: 0, overflow: "hidden" }} onClick={() => go("project", project.id)}><div className="project-img" style={{ height: 90, backgroundImage: `url(${project.imageUrl || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=70"})` }} /><div style={{ padding: 10 }}><b>{project.name}</b><p className="muted">{project.city}</p></div></button>)}</div></section><section className="card panel"><h2>Recent activity</h2>{row.activity.slice(0, 5).map((item: any) => <p key={item.id}><b>{item.action}</b><br /><span className="muted">{item.actorName} · {when(item.createdAt)}</span></p>)}</section></div></>}
    {tab === "Agents" && <Table columns={["Name", "Role", "Status"]} rows={row.agents.map((agent: any) => [agent.name, agent.role, agent.status])} onRow={(index) => go("agent", row.agents[index].id)} />}
    {tab === "Projects" && <Table columns={["Project", "City"]} rows={row.projects.map((project: any) => [project.name, project.city])} onRow={(index) => go("project", row.projects[index].id)} />}
    {tab === "Properties" && <Table columns={["Reference", "Title", "Status"]} rows={row.properties.map((property: any) => [property.reference, property.title, property.status])} onRow={(index) => go("property", row.properties[index].id)} />}
    {tab === "Media" && <Table columns={["Caption", "Plays", "Publication"]} rows={row.media.map((reel: any) => [reel.caption, reel.plays, reel.publication])} />}
    {tab === "Leads" && <Table columns={["Customer", "Summary", "Status"]} rows={row.leads.map((lead: any) => [lead.freeUser.name, lead.summary, lead.status])} />}
    {tab === "Appointments" && <Table columns={["When", "Status"]} rows={row.appointments.map((item: any) => [when(item.startsAt), item.status])} />}
    {tab === "Outcomes" && <Table columns={["Outcome", "Days", "Note"]} rows={row.outcomes.map((item: any) => [item.outcome, item.advertisedDays, item.note])} />}
    {tab === "Subscription" && <section className="card panel">{row.subscription ? <div className="kv"><span>Plan</span><b>{row.subscription.plan}</b><span>Status</span><b>{row.subscription.status}</b><span>Fee</span><b>{money(row.subscription.monthlyFee, row.subscription.currency)}</b><span>Renews</span><b>{when(row.subscription.renewsAt)}</b></div> : <p>No subscription is visible for this role.</p>}</section>}
    {tab === "Invoices" && <Table columns={["Number", "Amount", "Paid", "Status"]} rows={(row.invoices || []).map((invoice: any) => [invoice.number, money(invoice.amount, invoice.currency), money(invoice.amountPaid, invoice.currency), invoice.status])} />}
    {tab === "Activity" && <Table columns={["When", "Actor", "Action", "Detail"]} rows={row.activity.map((item: any) => [when(item.createdAt), item.actorName, item.action, item.detail])} />}
  </>}</Gate>;
}

function Users({ go, countryQuery }: { go: Go; countryQuery: string }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const state = useQuery(`/api/users?page=${page}&pageSize=8&q=${encodeURIComponent(q)}&status=${status}${countryQuery ? `&${countryQuery}` : ""}`);
  const [picked, setPicked] = useState(0);
  return <><Head code="11 / 24" title="Free users directory" sub="Property seekers using PlaceIn — separate from agencies and agents."><span className="badge slate">Free accounts · No billing</span></Head>
    <Note>This directory lists registered accounts. Guest usage appears in app analytics. Search, filters and pages run on the server.</Note>
    <div className="filters"><input value={q} placeholder="Search by name or email" onChange={(event) => { setQ(event.target.value); setPage(1); }} /><Select value={status} set={setStatus} options={["", "ACTIVE", "DELETION_REQUESTED", "DEACTIVATED"]} labels={["Account status", "Active", "Deletion requested", "Deactivated"]} /></div>
    <Gate state={state}>{(data) => {
      const current = data.data[picked] || data.data[0];
      return <><Metrics><Stat icon="Users" title="Registered users" value={data.registeredUsers} note="Current accounts" /><Stat icon="Filter" title="Matching filter" value={data.filteredCount} note="This search" tone="purple" /><Stat icon="UserPlus" title="On this page" value={data.data.length} note={`Page ${data.page}`} tone="green" /><Stat icon="Shield" title="Deletion requests" value={data.data.filter((row: any) => row.status === "DELETION_REQUESTED").length} note="On this page" tone="orange" /></Metrics>
        <div className="split"><div><Table active={picked} columns={["User", "Country", "Enquiries", "Offers", "Appointments", "Last active", "Status"]} rows={data.data.map((row: any) => [<Who key={row.id} name={row.name} sub={row.email} />, row.countryName, row._count.enquiries, row._count.offers, row._count.appointments, day(row.lastActivityAt), <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>])} onRow={setPicked} /><Pager data={data} page={page} setPage={setPage} /></div>
          {current && <aside className="card rail"><Avatar name={current.name} /><h2>{current.name}</h2><p className="muted">{current.email} · {current.countryName}</p><div className="kv"><span>Enquiries</span><b>{current._count.enquiries}</b><span>Offers</span><b>{current._count.offers}</b><span>Appointments</span><b>{current._count.appointments}</b><span>Status</span><b>{pretty(current.status)}</b></div><button className="btn gold" onClick={() => go("user", current.id)}>Open user profile</button><button className="btn outline" onClick={() => go("offers")}>View buyer activity</button></aside>}
        </div></>;
    }}</Gate></>;
}
function UserDetail({ id, go, notify }: { id: string; go: Go; notify: (s: string) => void }) {
  const state = useQuery(id ? `/api/users/${id}` : null);
  const [reason, setReason] = useState("User asked for the account to be removed.");
  if (!id) return <PickFirst path="/api/users?pageSize=1" go={(value) => go("user", value)} label="user" />;
  async function act(path: string) {
    try { await api(path, { method: "POST", body: { reason } }); notify("Saved."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not save"); }
  }
  return <Gate state={state}>{(row) => {
    const latestOffer = row.offers?.[0];
    return <><Head code="12 / 24" title="User profile and activity" sub="Free property seekers are not billed." crumb={<div className="crumb"><button onClick={() => go("users")}>Users</button> · {row.name}</div>}><span className="badge slate">Free account · No billing</span><button className="btn gold" onClick={() => go("offers")}>View buyer activity</button></Head>
      <section className="card profile-strip"><Avatar name={row.name} className="lg" /><div><h2 style={{ margin: 0 }}>{row.name}</h2><p className="muted">{row.email}</p></div><div className="profile-meta"><div><span>Country</span><b>{row.countryName}</b></div><div><span>Registered</span><b>{day(row.registeredAt)}</b></div><div><span>Last active</span><b>{when(row.lastActivityAt)}</b></div><div><span>Account</span><Badge status={row.status}>{pretty(row.status)}</Badge></div></div></section>
      <Note>{row.privacy}</Note>
      <Metrics><Stat icon="MessageSquareText" title="Enquiries" value={row.enquiries.length} note="On this profile" /><Stat icon="FileText" title="Offers" value={row.offers.length} note="An accepted offer is not a purchase" tone="purple" /><Stat icon="CalendarCheck" title="Appointments" value={row.appointments.length} note="Including past bookings" tone="green" /><Stat icon="Shield" title="Privacy requests" value={row.deletionRequestedAt ? "Open" : "None"} note={row.deletionConfirmedAt ? "Anonymised" : "Deletion state"} tone="orange" /></Metrics>
      <div className="grid two"><section className="card panel"><h2>Recent enquiries</h2><Table columns={["When", "Property", "Agency", "Status"]} rows={row.enquiries.map((item: any) => [when(item.createdAt), item.property, item.agency, <Badge key={item.id} status={item.status}>{pretty(item.status)}</Badge>])} /></section>
        <section className="card panel"><h2>Latest offer</h2>{latestOffer ? <div className="kv"><span>Amount</span><b>{money(latestOffer.amount, latestOffer.currency)}</b><span>Status</span><b>{pretty(latestOffer.status)}</b><span>Property</span><b>{latestOffer.property?.title || latestOffer.property || "—"}</b></div> : <p>No offer is on file. An accepted offer is not a completed purchase.</p>}<button className="btn outline" onClick={() => go("offers")}>View buyer activity</button></section></div>
      <div className="grid two"><section className="card panel"><h2>Appointments</h2><Table columns={["When", "Property", "Agency", "Status"]} rows={row.appointments.map((item: any) => [when(item.startsAt), item.property?.title || "—", item.agency?.name || "—", <Badge key={item.id} status={item.status}>{pretty(item.status)}</Badge>])} /></section>
        <section className="card panel stack"><h2>Support and privacy</h2><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><div className="inline-actions"><button className="btn gold" onClick={() => act(`/api/users/${row.id}/support`)}>Open support ticket</button><button className="btn outline" onClick={() => act(`/api/users/${row.id}/deletion-request`)}>Request deletion</button><button className="btn danger" onClick={() => act(`/api/users/${row.id}/confirm-deletion`)}>Anonymise</button></div></section></div>
    </>;
  }}</Gate>;
}

function Analytics({ view, countryQuery }: { view: View; countryQuery: string }) {
  const staff = view === "analytics";
  const state = useQuery(staff || view === "insights" ? (staff ? `/api/platform/analytics${countryQuery ? `?${countryQuery}` : ""}` : "/api/dashboard/agency") : "/api/reels?pageSize=20");
  if (view === "audience") return <Gate state={state}>{(data) => <><Head title="Audience and engagement" sub="Grow your audience and see which content performs." /><Table columns={["Content", "Plays", "Watch sec", "Completion", "Likes", "Saves"]} rows={data.data.map((row: any) => [<div className="who" key={row.id}><Thumb url={row.coverUrl} /><b>{row.caption}</b></div>, row.plays, row.watchTimeSec, row.completionRate, row.likes, row.saves])} /></>}</Gate>;
  if (view === "insights") return <Gate state={state}>{(data) => <><Head title="Performance analytics" sub="Track how your properties and content are performing across PlaceIn." /><Metrics><Stat icon="House" title="Available properties" value={data.available} note="Live listings" tone="green" /><Stat icon="MessageSquareText" title="Open enquiries" value={data.openEnquiries} note={`${data.enquiriesThisMonth} this month`} tone="pink" /><Stat icon="CalendarCheck" title="Appointments" value={data.upcomingAppointments} note="Upcoming" tone="purple" /><Stat icon="CirclePlay" title="Reel plays" value={Number(data.reelPlays || 0).toLocaleString()} note="Published reels" /></Metrics><Series series={data.series} label="Enquiries trend" /></>}</Gate>;
  return <Gate state={state}>{(data) => <><Head code="16 / 24" title="App usage and audience analytics" sub={`Period ${day(data.period.from)} to ${day(data.period.to)}. Last metric day ${day(data.sourceUpdatedAt)}.`} />
    <Note>{data.note} Downloads, accounts, login events and active users are separate measures. Comparison with a previous month is not shown because this feed has period totals only.</Note>
    <Metrics><Stat icon="Download" title="App downloads" value={(data.downloads.ios + data.downloads.android).toLocaleString()} note={`iOS ${data.downloads.ios.toLocaleString()} · Android ${data.downloads.android.toLocaleString()}`} /><Stat icon="UserPlus" title="Registrations" value={data.registrations.toLocaleString()} note="New accounts in the period" tone="purple" /><Stat icon="Activity" title="Active user days" value={data.activeUsers.toLocaleString()} note={`${data.guestUsers.toLocaleString()} estimated guest events`} tone="green" /><Stat icon="Clock" title="Avg session" value={clock(data.averageSessionSec)} note={`${data.logins.toLocaleString()} login events are separate`} tone="orange" /></Metrics>
    <Metrics><Stat icon="Eye" title="Property views" value={data.propertyViews.toLocaleString()} note="Thresholded, deduplicated" /><Stat icon="CirclePlay" title="Reel plays" value={data.reelPlays.toLocaleString()} note={`${data.completions.toLocaleString()} completions`} tone="purple" /><Stat icon="Heart" title="Likes" value={data.likes.toLocaleString()} note={`${data.saves.toLocaleString()} saves`} tone="pink" /><Stat icon="Timer" title="Watch time" value={clock(data.watchTimeSec)} note="Total across plays" /></Metrics>
    <Metrics><Stat icon="MessageSquareText" title="Enquiries" value={data.enquiries.toLocaleString()} note="From the app" tone="pink" /><Stat icon="FileText" title="Offers" value={data.offers.toLocaleString()} note="Submissions" tone="purple" /><Stat icon="CalendarCheck" title="Bookings" value={data.bookings.toLocaleString()} note="Appointment records" tone="green" /><Stat icon="Search" title="Searches" value={data.searches.toLocaleString()} note="Known automated traffic excluded" /></Metrics>
    <section className="card panel"><h2>Metric definitions</h2><Table columns={["Metric", "Definition", "Source"]} rows={data.definitions.map((row: any) => [row.title, row.definition, row.source])} /></section>
  </>}</Gate>;
}
function Countries({ notify, session }: { notify: (s: string) => void; session: Session }) {
  const state = useQuery("/api/platform/countries");
  const [reason, setReason] = useState("Country configuration updated.");
  async function toggle(row: any) {
    try { await api(`/api/platform/countries/${row.id}`, { method: "PATCH", body: { active: !row.active, reason } }); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not update"); }
  }
  const [picked, setPicked] = useState(0);
  return <><Head code="17 / 24" title="Country and regional performance" sub="Compare audience activity, property demand and agency performance. User country and property country are different bases." />
    <Note>These figures follow each country’s stored audience record. They are not the same base as the property’s listing country.</Note>
    <Gate state={state}>{(rows) => {
      const list = rows as any[];
      const current = list[picked] || list[0];
      const users = list.reduce((sum, row) => sum + Number(row.activeUsers || 0), 0);
      const income = list.every((row) => row.subscriptionIncomeGbp === undefined) ? null : list.reduce((sum, row) => sum + Number(row.subscriptionIncomeGbp || 0), 0);
      const maxEnquiries = Math.max(1, ...list.map((row) => Number(row.enquiries || 0)));
      return <>
        <Metrics><Stat icon="Globe2" title="Active countries" value={list.filter((row) => row.active).length} note={`${list.length} configured`} /><Stat icon="Building2" title="Countries with agencies" value={list.filter((row) => row.agencies > 0).length} note="At least one agency" tone="purple" /><Stat icon="Users" title="Active users" value={users.toLocaleString()} note="Sum of country records" tone="orange" /><Stat icon="Coins" title="Subscription income" value={income == null ? "Hidden" : `£${Math.round(income).toLocaleString()}`} note={session.user.financeAccess ? "GBP reporting currency" : "Finance access required"} tone="green" /></Metrics>
        <div className="split"><div>
          <Table active={picked} columns={["Country", "Active users", "Agencies", "Views", "Enquiries", "Income"]} rows={list.map((row) => [row.name, Number(row.activeUsers || 0).toLocaleString(), row.agencies, Number(row.propertyViews || 0).toLocaleString(), row.enquiries, row.subscriptionIncomeGbp === undefined ? "Hidden" : `£${Math.round(row.subscriptionIncomeGbp)}`])} onRow={setPicked} />
          <section className="card panel"><h2>Property demand by recorded enquiries</h2>{list.map((row) => <div className="meter" key={row.id}><span style={{ width: 140 }}>{row.name}</span><i style={{ width: `${(Number(row.enquiries || 0) / maxEnquiries) * 100}%` }} /><b>{row.enquiries}</b></div>)}</section>
        </div>
          <aside className="card rail">{current && <>
            <h2>{current.name}</h2><Badge status={current.active ? "ACTIVE" : "DEACTIVATED"}>{current.active ? "Active" : "Off"}</Badge>
            <div className="kv"><span>Currency</span><b>{current.currency}</b><span>Timezone</span><b>{current.timezone}</b><span>Language</span><b>{current.language}</b><span>Agencies</span><b>{current.agencies}</b><span>Active users</span><b>{Number(current.activeUsers || 0).toLocaleString()}</b><span>Views</span><b>{Number(current.propertyViews || 0).toLocaleString()}</b><span>Enquiries</span><b>{current.enquiries}</b><span>Offers</span><b>{current.offers}</b><span>Bookings</span><b>{current.bookings}</b><span>Income</span><b>{current.subscriptionIncomeGbp === undefined ? "Hidden" : `£${Math.round(current.subscriptionIncomeGbp)}`}</b></div>
            {session.user.financeAccess && session.user.role !== "MAINTENANCE" && <div className="stack"><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><button className="btn outline" onClick={() => toggle(current)}>{current.active ? "Turn country off" : "Turn country on"}</button></div>}
          </>}</aside></div>
      </>;
    }}</Gate></>;
}

function Subscriptions({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const state = useQuery("/api/subscriptions?pageSize=50");
  const [plan, setPlan] = useState("GROWTH");
  const [effectiveOn, setEffectiveOn] = useState("2026-11-01");
  const [reason, setReason] = useState("Agency asked to change allowance.");
  const [picked, setPicked] = useState(0);
  async function change(id: string) {
    try { await api(`/api/subscriptions/${id}/plan`, { method: "POST", body: { plan, effectiveOn, reason } }); notify("Plan change recorded with an effective date."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not change plan"); }
  }
  return <><Head code="18 / 24" title="Agency subscription management" sub="Manage agency monthly plans, trials and account allowances. Free users stay outside this billing system."><button className="btn outline" onClick={() => go("invoices")}>View payments</button></Head>
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      const count = (status: string) => rows.filter((row: any) => row.status === status).length;
      return <>
        <Metrics><Stat icon="Users" title="Active paid" value={count("ACTIVE")} note={`${rows.length} loaded of ${data.total}`} tone="green" /><Stat icon="FlaskConical" title="Trial agencies" value={count("TRIAL")} note="Trial is not a free-user account" tone="purple" /><Stat icon="Clock" title="Trials ending" value={data.trialsEnding} note="Within 7 days" tone="red" /><Stat icon="CircleX" title="Past due or cancelled" value={count("PAST_DUE") + count("CANCELLED")} note="Loaded records" tone="orange" /></Metrics>
        <Note>{data.rules.trial} {data.rules.overdue} {data.rules.commission}</Note>
        <div className="split"><div>
          <Table active={picked} columns={["Agency", "Plan", "Allowance", "Status", "Fee", "Next billing"]} rows={rows.map((row: any) => [<Who key={row.id} name={row.agency.name} sub={row.agency.country} />, pretty(row.plan), `${row.agency.agentAllowance} agents · ${row.agency.listingAllowance} listings`, <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>, data.financeHidden ? "Hidden" : money(row.monthlyFee, row.currency), day(row.renewsAt)])} onRow={setPicked} />
        </div>
          <aside className="card rail">{current && <>
            <div className="panel-head"><Avatar name={current.agency.name} /><div><h2>{current.agency.name}</h2><p className="muted">{current.agency.country}</p></div><Badge status={current.status}>{pretty(current.status)}</Badge></div>
            <div className="kv"><span>Plan</span><b>{pretty(current.plan)}</b><span>Monthly fee</span><b>{data.financeHidden ? "Hidden" : money(current.monthlyFee, current.currency)}</b><span>Renews</span><b>{day(current.renewsAt)}</b><span>Trial ends</span><b>{day(current.trialEndsAt)}</b><span>Agents</span><b>{current.agency.agentAllowance}</b><span>Listings</span><b>{current.agency.listingAllowance}</b></div>
            {session.user.financeAccess && <div className="stack"><Select value={plan} set={setPlan} options={["STARTER", "GROWTH", "PROFESSIONAL", "ENTERPRISE"]} /><input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><textarea value={reason} onChange={(event) => setReason(event.target.value)} /><button className="btn gold" onClick={() => change(current.id)}>Schedule plan change</button></div>}
            <div className="inline-actions"><button className="btn outline" onClick={() => go("agency", current.agency.id)}>View agency</button><button className="btn outline" onClick={() => go("invoices")}>View invoices</button></div>
            {(current.changes || []).length > 0 && <div className="stack"><h3>Scheduled changes</h3>{current.changes.map((change: any) => <p key={change.id || change.effectiveOn}><b>{pretty(change.plan || change.toPlan || "Change")}</b><br /><span className="muted">{day(change.effectiveOn)} · {change.reason}</span></p>)}</div>}
          </>}</aside></div>
      </>;
    }}</Gate></>;
}
function Invoices({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const [status, setStatus] = useState("");
  const [picked, setPicked] = useState(0);
  const state = useQuery(`/api/invoices?pageSize=50&status=${status}`);
  async function act(id: string, path: string, body?: unknown) {
    try { await api(`/api/invoices/${id}/${path}`, { method: "POST", body: body || {} }); notify("Invoice updated from the payment record."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not update invoice"); }
  }
  return <><Head code="19 / 24" title="Monthly payments and overdue accounts" sub="Track monthly agency fees, invoices and payment collection. Property seekers are not charged."><button className="btn gold" onClick={() => downloadCsv("invoices").catch((error) => notify(error.message))}><Icons.Download size={16} /> Export invoices</button></Head>
    <Note>Agency subscription fees only. Property seekers are not charged. Payment status comes from the stored payment record.</Note>
    <div className="filters"><Select value={status} set={setStatus} options={["", "PAID", "UNPAID", "PARTIALLY_PAID", "OVERDUE", "VOID", "REFUNDED"]} labels={["All statuses", "Paid", "Unpaid", "Partially paid", "Overdue", "Void", "Refunded"]} /></div>
    <Gate state={state}>{(data) => {
      const rows = data.data || [];
      const current = rows[picked] || rows[0];
      const count = (name: string) => rows.filter((row: any) => row.status === name).length;
      const outstanding = sameCurrency(rows, (row) => Math.max(0, row.amount - row.amountPaid));
      const failed = rows.reduce((sum: number, row: any) => sum + (row.attempts || []).filter((attempt: any) => attempt.status === "FAILED").length, 0);
      return <>
        <Metrics><Stat icon="CircleCheck" title="Paid invoices" value={`${count("PAID")} / ${rows.length}`} note={rows.length === data.total ? "All loaded invoices" : "This page"} tone="green" /><Stat icon="Clock" title="Overdue" value={count("OVERDUE")} note="Still unpaid after the due date" tone="red" /><Stat icon="Coins" title="Outstanding" value={outstanding || "Mixed currencies"} note="Loaded invoices" tone="purple" /><Stat icon="TriangleAlert" title="Failed attempts" value={failed} note="On loaded invoices" tone="orange" /></Metrics>
        <div className="split"><div><Table active={picked} columns={["Invoice / agency", "Month", "Amount", "Paid", "Outstanding", "Status"]} rows={rows.map((row: any) => [<span key={row.id} className="stack-name"><b>{row.number}</b><small>{row.agency.name}</small></span>, row.billingMonth, money(row.amount, row.currency), money(row.amountPaid, row.currency), money(Math.max(0, row.amount - row.amountPaid), row.currency), <Badge key="s" status={row.status}>{pretty(row.status)}</Badge>])} onRow={setPicked} /></div>
          <aside className="card rail">{current ? <>
            <div className="panel-head"><Avatar name={current.agency.name} /><div><h2>{current.agency.name}</h2><p className="muted">{current.number} · {current.agency.country || current.agency.city}</p></div><Badge status={current.status}>{pretty(current.status)}</Badge></div>
            <div className="kv"><span>Billing month</span><b>{current.billingMonth}</b><span>Amount</span><b>{money(current.amount, current.currency)}</b><span>Paid</span><b>{money(current.amountPaid, current.currency)}</b><span>Outstanding</span><b>{money(Math.max(0, current.amount - current.amountPaid), current.currency)}</b><span>Due</span><b>{day(current.dueDate)}</b><span>Plan</span><b>{pretty(current.agency.plan)}</b></div>
            <h3>Payment attempts</h3>{(current.attempts || []).length ? current.attempts.map((attempt: any) => <p key={attempt.id}><Badge status={attempt.status}>{pretty(attempt.status)}</Badge> {money(attempt.amount, current.currency)} · {attempt.providerRef}{attempt.failureReason ? ` · ${attempt.failureReason}` : ""}</p>) : <p className="muted">No payment attempt is stored on this invoice.</p>}
            <div className="inline-actions">{session.user.financeAccess && current.status !== "PAID" && <button className="btn gold" onClick={() => act(current.id, "payments", { providerRef: `pay_${Date.now()}`, status: "SUCCESS", amount: Math.max(0, current.amount - current.amountPaid) })}>Record payment</button>}<button className="btn outline" onClick={() => act(current.id, "remind")}>Prepare reminder</button><button className="btn outline" onClick={() => go("agency", current.agency.id)}>View agency</button></div>
          </> : <p>No invoices match this filter.</p>}</aside></div>
      </>;
    }}</Gate></>;
}

function Tickets({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const [current, setCurrent] = useState("");
  const [tab, setTab] = useState("");
  const [composer, setComposer] = useState("reply");
  const list = useQuery("/api/tickets?pageSize=50");
  const detail = useQuery(current ? `/api/tickets/${current}` : null);
  const [body, setBody] = useState("We are checking this and will update you.");
  const [note, setNote] = useState("Internal: queue checked. Do not send this to the customer.");
  async function send(path: string, text: string) {
    try { await api(`/api/tickets/${current}/${path}`, { method: "POST", body: { body: text } }); notify(path === "notes" ? "Internal note saved. It is not sent to the customer." : "Reply saved."); detail.reload(); list.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not save"); }
  }
  const allTickets = list.data?.data || [];
  const rows = tab ? allTickets.filter((row: any) => row.status === tab) : allTickets;
  const open = allTickets.filter((row: any) => !["RESOLVED", "CLOSED"].includes(row.status)).length;
  const waiting = allTickets.filter((row: any) => row.status === "AWAITING_CUSTOMER").length;
  const technical = allTickets.filter((row: any) => /tech|upload|bug/i.test(`${row.category} ${row.subject}`)).length;
  const high = allTickets.filter((row: any) => row.priority === "HIGH").length;
  return <><Head code="20 / 24" title="Support tickets" sub={session.user.role === "MAINTENANCE" ? "Technical cases only. Internal notes stay off the customer thread." : "Support agencies and free users, with clear ownership and case history."} />
    <Metrics><Stat icon="MessageSquareText" title="Open on this page" value={open} note={`${list.data?.total ?? "—"} matching`} /><Stat icon="Clock" title="Awaiting customer" value={waiting} note="On this page" tone="orange" /><Stat icon="Wrench" title="Technical wording" value={technical} note="Category or subject" tone="purple" /><Stat icon="TriangleAlert" title="High priority" value={high} note="On this page" tone="red" /></Metrics>
    <div className="tabs">{[["", "All tickets"], ["OPEN", "Open"], ["ASSIGNED", "Assigned"], ["AWAITING_CUSTOMER", "Waiting"], ["RESOLVED", "Resolved"]].map(([item, label]) => <button key={label} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{label}</button>)}</div>
    <div className="list-layout"><section className="card list">{rows.map((row: any) => <button key={row.id} className={current === row.id ? "selected-item list-row compact" : "list-row compact"} onClick={() => setCurrent(row.id)}><Avatar name={row.agency?.name || row.user?.name} /><div><b>{row.number} · {row.subject}</b><small>{row.agency?.name || row.user?.name || "User"} · {row.category} · {row.assignee?.name || "Unassigned"}</small></div><Badge status={row.status}>{pretty(row.status)}</Badge></button>)}{list.loading && <p>Loading records…</p>}{list.error && <div className="error-box">{list.error}</div>}{!list.loading && !rows.length && <div className="empty">No tickets in this view.</div>}</section>
      <section className="card panel">{detail.data ? <>
        <div className="panel-head"><div><h2>{detail.data.number} — {detail.data.subject}</h2><p className="muted">{detail.data.agency?.name || detail.data.freeUser?.name || "User"} · {detail.data.category} · {detail.data.assignee?.name || "Unassigned"}</p></div><span className="inline-actions"><Badge status={detail.data.status}>{pretty(detail.data.status)}</Badge><Badge status={detail.data.priority}>{pretty(detail.data.priority)}</Badge></span></div>
        <div className="thread">{detail.data.messages.map((message: any) => <div className="bubble" key={message.id}><b>{message.authorName}</b> <small>{when(message.createdAt)}</small><p>{message.body}</p></div>)}{(detail.data.notes || []).map((item: any) => <div className="bubble internal" key={item.id}><b>{item.authorName}</b> <small>Internal note — not visible to the customer · {when(item.createdAt)}</small><p>{item.body}</p></div>)}</div>
        <div className="tabs"><button className={composer === "reply" ? "selected" : ""} onClick={() => setComposer("reply")}>Customer reply</button>{session.user.kind === "staff" && <button className={composer === "note" ? "selected" : ""} onClick={() => setComposer("note")}>Internal note</button>}</div>
        {composer === "reply" ? <div className="stack"><textarea value={body} onChange={(event) => setBody(event.target.value)} /><button className="btn gold" onClick={() => send("messages", body)}>Send reply</button></div> : <div className="stack"><textarea value={note} onChange={(event) => setNote(event.target.value)} /><button className="btn outline" onClick={() => send("notes", note)}>Save internal note</button></div>}
        <div className="inline-actions">{detail.data.agency?.id && <button className="btn outline" onClick={() => go("agency", detail.data.agency.id)}>View agency</button>}<button className="btn outline" onClick={() => go("health")}>Open platform health</button></div>
      </> : <p>Select a ticket. Internal notes stay off the customer thread.</p>}</section></div>
    <Note>Internal notes are separate from customer replies. Technical staff only see the cases their role allows.</Note></>;
}

function Staff({ notify, session }: { notify: (s: string) => void; session: Session }) {
  const state = useQuery("/api/staff");
  const audit = useQuery("/api/platform/audit?pageSize=8");
  const [form, setForm] = useState({ name: "Lina Rahman", email: "lina@placein.com", role: "ADMIN_SUPPORT", password: "PlaceIn2026!", financeAccess: false });
  async function create() {
    try { await api("/api/staff", { method: "POST", body: form }); notify("Staff account created."); state.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not create staff"); }
  }
  async function revoke(id: string) { await api(`/api/staff/${id}/revoke-sessions`, { method: "POST", body: {} }); notify("Sessions revoked."); state.reload(); }
  async function twoFactor(row: any) {
    const result = await api(`/api/staff/${row.id}`, { method: "PATCH", body: { twoFactor: !row.twoFactor } });
    notify(result.twoFactorCode ? `Two-factor code (shown once): ${result.twoFactorCode}` : "Two-factor turned off.");
    state.reload();
  }
  return <><Head code="21 / 24" title="Staff access and audit history" sub="Three roles. Super admin controls finance access, two-factor authentication and session revocation. Sensitive actions are audited." />
    <Gate state={state}>{(rows) => <Metrics><Stat icon="UserCog" title="Staff accounts" value={rows.length} note="Active directory" /><Stat icon="Shield" title="Two-factor on" value={rows.filter((row: any) => row.twoFactor).length} note="Individual accounts" tone="green" /><Stat icon="KeyRound" title="Open sessions" value={rows.reduce((sum: number, row: any) => sum + Number(row.openSessions || 0), 0)} note="Can be revoked" tone="orange" /><Stat icon="Coins" title="Finance access" value={rows.filter((row: any) => row.financeAccess).length} note="Super admin only" tone="purple" /></Metrics>}</Gate>
    {session.user.role === "SUPER_ADMIN" && <section className="card panel"><h2>Add a staff account</h2><div className="filters"><input value={form.name} placeholder="Name" onChange={(event) => setForm({ ...form, name: event.target.value })} /><input value={form.email} placeholder="Email" onChange={(event) => setForm({ ...form, email: event.target.value })} /><Select value={form.role} set={(role) => setForm({ ...form, role })} options={["ADMIN_SUPPORT", "MAINTENANCE", "SUPER_ADMIN"]} /><button className="btn gold" onClick={create}>Create staff</button></div></section>}
    <Gate state={state}>{(rows) => <div className="split"><div><Table columns={["Person", "Role", "Finance", "2FA", "Sessions", "Last login"]} rows={rows.map((row: any) => [<Who key={row.id} name={row.name} sub={row.email} />, pretty(row.role), row.financeAccess ? "Yes" : "No", <Badge key="f" status={row.twoFactor ? "ACTIVE" : "PENDING"}>{row.twoFactor ? "On" : "Off"}</Badge>, row.openSessions, when(row.lastLoginAt)])} /></div>
      <aside className="card rail"><h2>Account actions</h2><p className="muted">Revoke ends open sessions. Two-factor is per account. A one-time code is shown only when it is turned on.</p>{rows.map((row: any) => <div className="list-row pair" key={row.id}><Who name={row.name} sub={pretty(row.role)} /><span className="inline-actions"><button className="btn outline sm" onClick={() => revoke(row.id).catch((error) => notify(error.message))}>Revoke</button>{session.user.role === "SUPER_ADMIN" && <button className="btn outline sm" onClick={() => twoFactor(row).catch((error) => notify(error.message))}>{row.twoFactor ? "2FA off" : "2FA on"}</button>}</span></div>)}</aside></div>}</Gate>
    <section className="card panel"><h2>Audit history</h2><Gate state={audit}>{(data) => <Table columns={["When", "Actor", "Action", "Detail"]} rows={data.data.map((row: any) => [when(row.createdAt), `${row.actorName} (${pretty(row.actorRole)})`, pretty(row.action), row.detail])} />}</Gate></section></>;
}
function Audit(props: { notify: (s: string) => void; session: Session }) { return <Staff {...props} />; }

function AgencySettings({ notify }: { notify: (s: string) => void }) {
  const state = useQuery("/api/auth/me");
  const agency = useQuery(state.data?.agencyId ? `/api/agencies/${state.data.agencyId}` : null);
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (agency.data && !form) setForm({ name: agency.data.name, email: agency.data.email, phone: agency.data.phone, description: agency.data.description || "", city: agency.data.city, address: agency.data.address, ...agency.data.settings }); }, [agency.data, form]);
  async function save() {
    try { await api(`/api/agencies/${agency.data.id}`, { method: "PATCH", body: form }); notify("Agency settings saved."); agency.reload(); }
    catch (error) { notify(error instanceof Error ? error.message : "Could not save"); }
  }
  return <><Head title="Agency settings" sub="Manage your agency profile, defaults and preferences." />
    <Gate state={agency}>{(row) => form && <div className="settings-layout"><section className="card panel stack"><h2>Agency profile</h2><div className="field-grid"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>City<input value={form.city || ""} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label>Address<input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="btn gold" onClick={save}>Save settings</button>{row.financeHidden ? <p className="muted">Subscription invoices are hidden for this login.</p> : <p className="muted">This agency sees only its own records. Head office keeps the billing ledger.</p>}</section>
      <section className="card panel stack"><h2>Preferences</h2>{([["requireApproval", "Require manager approval before publishing", "Listings and reels must be approved by a manager."], ["enforceImageQuality", "Enforce photo quality", "Photos must meet 1600×1200 before they can be published."], ["notifyEnquiries", "New enquiries", "Get notified when someone enquires about a property."], ["notifyAppointments", "Appointment bookings", "Get notified about new and updated appointments."], ["notifyTeam", "Team activity", "Get notified about key team actions."], ["twoFactorRequired", "Two-factor authentication", "Add an extra check when the team signs in."]] as const).map(([key, label, help]) => <button key={key} className="toggle-row" onClick={() => setForm({ ...form, [key]: !form[key] })}><span>{label}<small>{help}</small></span><i className={form[key] ? "on" : ""}><b /></i></button>)}</section></div>}</Gate></>;
}
function PlatformSettings({ notify, session, go }: { notify: (s: string) => void; session: Session; go: Go }) {
  const state = useQuery("/api/platform/settings");
  const [tab, setTab] = useState("Media quality");
  const [reason, setReason] = useState("Raise the published media standard.");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [video, setVideo] = useState("");
  useEffect(() => {
    if (!state.data) return;
    setWidth(String(state.data.mediaMinWidth ?? ""));
    setHeight(String(state.data.mediaMinHeight ?? ""));
    setVideo(String(state.data.maxVideoMb ?? ""));
  }, [state.data]);
  async function save() {
    try {
      await api("/api/platform/settings", { method: "PATCH", body: { mediaMinWidth: Number(width), mediaMinHeight: Number(height), maxVideoMb: Number(video), reason, effectiveOn: new Date().toISOString().slice(0, 10) } });
      notify("Settings saved. Existing content stays published.");
      state.reload();
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save"); }
  }
  return <><Head code="22 / 24" title="Platform settings" sub="Configure localisation, media standards and platform rules. Policy changes do not remove existing content." />
    {session.user.role === "SUPER_ADMIN" && <div className="banner">Super admin access. Billing rules stay hidden from roles without finance access.</div>}
    <Tabs items={["General", "Media quality", "Privacy", "Billing", "Integrations"]} value={tab} onChange={setTab} />
    <Gate state={state}>{(row) => <div className="settings-layout"><div>
      {tab === "General" && <section className="card panel"><h2>Localisation</h2><div className="kv"><span>Reporting currency</span><b>{row.reportingCurrency}</b><span>Effective</span><b>{day(row.effectiveOn)}</b><span>Updated</span><b>{when(row.updatedAt)}</b><span>Privacy version</span><b>{row.privacyPolicyVersion}</b></div>{row.fxRates && <div className="kv">{Object.entries(row.fxRates).flatMap(([code, rate]) => [<span key={code}>{code}</span>, <b key={`${code}-rate`}>{String(rate)}</b>])}</div>}</section>}
      {tab === "Media quality" && <section className="card panel stack"><h2>Listing photos</h2><p className="muted">Resolution is checked after crop. Do not stretch or upscale low-quality originals.</p><div className="field-grid"><label>Minimum width (px)<input value={width} onChange={(event) => setWidth(event.target.value)} /></label><label>Minimum height (px)<input value={height} onChange={(event) => setHeight(event.target.value)} /></label><label>Maximum video (MB)<input value={video} onChange={(event) => setVideo(event.target.value)} /></label></div><Note>A hard fail keeps the draft and asks the agency to replace the file. It does not delete existing published content.</Note><label>Reason for change<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn gold" onClick={save}>Save with effective date</button></section>}
      {tab === "Privacy" && <section className="card panel"><h2>Privacy and security</h2><div className="kv"><span>Policy version</span><b>{row.privacyPolicyVersion}</b><span>Staff 2FA</span><b>Managed on each staff account</b><span>Private messages</span><b>Not stored in reporting views</b></div><button className="btn outline" onClick={() => go("staff")}>Manage staff access</button></section>}
      {tab === "Billing" && <section className="card panel">{row.billingRules ? <><h2>Billing rules</h2><div className="kv">{Object.entries(row.billingRules).flatMap(([key, value]) => [<span key={key}>{pretty(key)}</span>, <b key={`${key}-v`}>{String(value)}</b>])}</div></> : <div className="banner">Billing rules are hidden for {pretty(session.user.role)}.</div>}<button className="btn outline" onClick={() => go("subscriptions")}>Open subscriptions</button></section>}
      {tab === "Integrations" && <section className="card panel"><h2>Integrations</h2>{Object.entries(row.integrations || {}).map(([key, value]) => <div className="list-row" key={key}><b>{pretty(key)}</b><Badge status={String(value).includes("connect") && !String(value).includes("not") ? "ACTIVE" : "PENDING"}>{String(value)}</Badge></div>)}</section>}
    </div>
      <aside className="card rail"><h2>Current standard</h2><div className="kv"><span>Photos</span><b>{row.mediaMinWidth}×{row.mediaMinHeight}</b><span>Video</span><b>{row.maxVideoMb} MB</b><span>Currency</span><b>{row.reportingCurrency}</b></div><Note>Policy changes do not automatically remove existing content. Changes are recorded with the reason and the effective date.</Note></aside></div>}</Gate></>;
}
function Notifications({ notify }: { notify: (s: string) => void }) {
  const templates = useQuery("/api/platform/templates");
  const announcements = useQuery("/api/platform/announcements?pageSize=10");
  const [tab, setTab] = useState("Templates");
  const [selected, setSelected] = useState<any>(null);
  const [draftTemplate, setDraftTemplate] = useState({ subject: "", body: "" });
  const [form, setForm] = useState({ title: "Processing update", body: "Some uploads are still in the media queue.", channel: "EMAIL", audience: "All agencies" });
  const [preview, setPreview] = useState<any>(null);
  function choose(row: any) { setSelected(row); setDraftTemplate({ subject: row.subject, body: row.body }); }
  async function saveTemplate() {
    if (!selected) return;
    await api(`/api/platform/templates/${selected.id}`, { method: "PATCH", body: draftTemplate });
    notify("Template saved.");
    templates.reload();
  }
  async function draft() {
    const row = await api("/api/platform/announcements", { method: "POST", body: form });
    setPreview(row.preview);
    announcements.reload();
  }
  async function send(id: string) { await api(`/api/platform/announcements/${id}/send`, { method: "POST", body: {} }); notify("Announcement sent. Delivery failures are recorded."); announcements.reload(); }
  const sent = announcements.data?.data || [];
  const delivered = sent.reduce((sum: number, row: any) => sum + Number(row.delivered || 0), 0);
  const failed = sent.reduce((sum: number, row: any) => sum + Number(row.failed || 0), 0);
  return <><Head code="23 / 24" title="Notifications and announcements" sub="Manage templates, audience preferences and message delivery. Preview a message before it is sent." />
    <Metrics><Stat icon="Send" title="Announcements" value={announcements.data?.total ?? "—"} note="Stored drafts and sends" /><Stat icon="CircleCheck" title="Delivered" value={delivered.toLocaleString()} note="Recorded deliveries" tone="green" /><Stat icon="TriangleAlert" title="Delivery failures" value={failed.toLocaleString()} note="Recorded failures" tone="red" /><Stat icon="FileText" title="Templates" value={templates.data?.length ?? "—"} note="Reusable messages" tone="purple" /></Metrics>
    <Note>Delivered means the provider accepted the message. PlaceIn does not track whether a person opened it.</Note>
    <Tabs items={["Templates", "Announcements", "Delivery log"]} value={tab} onChange={setTab} />
    {tab === "Templates" && <Gate state={templates}>{(rows) => <div className="split"><div><Table active={rows.findIndex((row: any) => row.id === selected?.id)} columns={["Template", "Channel", "Status", "Updated"]} rows={rows.map((row: any) => [row.subject, pretty(row.channel), <Badge key={row.id} status={row.enabled ? "ACTIVE" : "DRAFT"}>{row.enabled ? "Enabled" : "Off"}</Badge>, day(row.updatedAt)])} onRow={(index) => choose(rows[index])} /></div>
      <aside className="card rail">{selected ? <div className="stack"><h2>Edit template</h2><label>Title<input value={draftTemplate.subject} onChange={(event) => setDraftTemplate({ ...draftTemplate, subject: event.target.value })} /></label><label>Message<textarea value={draftTemplate.body} onChange={(event) => setDraftTemplate({ ...draftTemplate, body: event.target.value })} /></label><div className="phone"><small>PlaceIn · now</small><div className="card"><b>{draftTemplate.subject}</b><p>{draftTemplate.body}</p></div></div><button className="btn gold" onClick={() => saveTemplate().catch((error) => notify(error.message))}>Save template</button></div> : <p>Select a template to edit the title, body and mobile preview.</p>}</aside></div>}</Gate>}
    {tab === "Announcements" && <section className="card panel stack"><h2>Announcement draft</h2><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Message<textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label><div className="filters"><Select value={form.channel} set={(channel) => setForm({ ...form, channel })} options={["EMAIL", "PUSH", "IN_APP"]} /><input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} /><button className="btn gold" onClick={() => draft().catch((error) => notify(error.message))}>Preview message</button></div>{preview && <div className="notice"><b>{preview.subject}</b><p>{preview.body}</p><small>{preview.disclaimer}</small></div>}<Note>Review the announcement before sending. Eligible people still follow their own notification preferences.</Note></section>}
    {tab === "Delivery log" && <Gate state={announcements}>{(data) => <Table columns={["Message", "Channel", "Audience", "Status", "Delivered", "Failed", ""]} rows={data.data.map((row: any) => [row.title, pretty(row.channel), row.audience, <Badge key={row.id} status={row.status}>{pretty(row.status)}</Badge>, row.delivered, row.failed, row.status === "SENT" ? "Sent" : <button key="s" className="btn outline sm" onClick={() => send(row.id).catch((error) => notify(error.message))}>Send</button>])} />}</Gate>}</>;
}
function Health({ notify }: { notify: (s: string) => void }) {
  const state = useQuery("/api/platform/health");
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ service: "Media processing", severity: "HIGH", summary: "Queue delay", symptom: "Uploads waiting", impact: "Publication delayed" });
  async function create() { await api("/api/platform/incidents", { method: "POST", body: form }); notify("Incident opened."); setOpenForm(false); state.reload(); }
  async function retry(id: string) {
    const result = await api(`/api/platform/uploads/${id}/retry`, { method: "POST", body: {} });
    notify(result.retried === false ? result.reason : "Retry queued.");
    state.reload();
  }
  return <><Head code="24 / 24" title="Platform health" sub="Monitor services, app stability, uploads and recovery."><button className="btn gold" onClick={() => setOpenForm((open) => !open)}><Icons.TriangleAlert size={16} /> Create incident</button></Head>
    {openForm && <section className="card panel stack"><h2>Open a technical incident</h2><div className="field-grid"><label>Service<input value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} /></label><label>Summary<input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label>Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></label></div><label>Symptom<textarea value={form.symptom} onChange={(event) => setForm({ ...form, symptom: event.target.value })} /></label><button className="btn gold" onClick={() => create().catch((error) => notify(error.message))}>Create incident</button></section>}
    <Gate state={state}>{(data) => {
      const incident = (data.incidents || []).find((row: any) => row.status !== "Resolved") || data.incidents?.[0];
      const failed = (data.uploads || []).filter((row: any) => row.status === "FAILED").length;
      const processing = (data.uploads || []).filter((row: any) => row.status === "PROCESSING").length;
      return <>
        <Metrics><Stat icon="CircleCheck" title="Service availability" value={`${data.availability}%`} note="From the service list" tone="green" /><Stat icon="TriangleAlert" title="App errors" value={data.appErrors} note="Recorded occurrences" tone="red" /><Stat icon="CloudUpload" title="Failed uploads" value={data.failedUploads} note="Current queue" tone="orange" /><Stat icon="HeartPulse" title="Open incidents" value={data.openIncidents} note="Not resolved" /></Metrics>
        {incident && <div className="banner">{incident.summary} — {incident.symptom}</div>}
        <div className="split"><section className="card panel"><h2>Service status</h2><Table columns={["Service", "Status", "Response / queue", "Updated"]} rows={data.services.map((row: any) => [row.name, <Badge key={row.id} status={row.status}>{pretty(row.status)}</Badge>, row.detail, when(row.updatedAt)])} /></section>
          <aside className="card panel incident">{incident ? <><h2>Active technical incident</h2><div className="panel-head"><b>{incident.reference} · {incident.summary}</b><span className="inline-actions"><Badge status={incident.status}>{pretty(incident.status)}</Badge><Badge status={incident.severity}>{pretty(incident.severity)}</Badge></span></div><div className="kv"><span>Assigned to</span><b>{incident.assignee || "—"}</b><span>Started</span><b>{when(incident.openedAt)}</b><span>Support ticket</span><b>{incident.ticketNumber || "—"}</b><span>Upload</span><b>{incident.uploadReference || "—"}</b><span>Symptom</span><b>{incident.symptom}</b><span>Impact</span><b>{incident.impact}</b></div></> : <p>No open incident.</p>}</aside></div>
        <div className="grid three"><section className="card panel"><h2>Recent app errors</h2><Table columns={["Reference", "Platform", "Category", "Count"]} rows={data.errors.map((row: any) => [row.reference, `${row.platform} ${row.appVersion}`, row.category, row.occurrences])} /></section>
          <section className="card panel"><h2>Upload and processing</h2><p className="muted">{data.uploads.length} shown · {failed} failed · {processing} processing</p>{data.uploads.map((row: any) => <div className="list-row" key={row.id}><span className="stack-name"><b>{row.reference}</b><small>{row.detail}</small></span><Badge status={row.status}>{pretty(row.status)}</Badge>{row.progress > 0 && <span className="progress" style={{ width: 80 }}><i style={{ width: `${row.progress}%` }} /></span>}{row.retryEligible && <button className="btn outline sm" onClick={() => retry(row.id).catch((error) => notify(error.message))}>Retry</button>}</div>)}</section>
          <section className="card panel"><h2>Backups and recovery</h2>{data.backups.map((row: any) => <div className="list-row" key={row.id}><b>{row.label}</b><Badge status={row.ok ? "ACTIVE" : "FAILED"}>{row.value}</Badge></div>)}</section></div>
        <Note>{data.notice} Administrative actions are audited.</Note>
      </>;
    }}</Gate></>;
}
