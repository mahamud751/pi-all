export type View =
  | "dashboard" | "properties" | "wizard" | "property" | "reels" | "upload" | "projects" | "project"
  | "team" | "agent" | "enquiries" | "appointments" | "insights" | "audience" | "approvals" | "settings"
  | "agencies" | "agency" | "agents" | "outcomes" | "users" | "user" | "offers" | "analytics"
  | "countries" | "subscriptions" | "invoices" | "tickets" | "staff" | "notifications" | "health" | "audit";


export const viewRoutes: Record<View, string> = {
  "dashboard": "/dashboard",
  "properties": "/properties",
  "reels": "/reels",
  "projects": "/projects",
  "team": "/team",
  "enquiries": "/enquiries",
  "appointments": "/appointments",
  "insights": "/insights",
  "audience": "/audience",
  "approvals": "/approvals",
  "settings": "/settings",
  "agencies": "/agencies",
  "agents": "/agents",
  "outcomes": "/outcomes",
  "users": "/users",
  "offers": "/offers",
  "analytics": "/analytics",
  "countries": "/countries",
  "subscriptions": "/subscriptions",
  "invoices": "/invoices",
  "tickets": "/tickets",
  "staff": "/staff",
  "notifications": "/notifications",
  "health": "/health",
  "audit": "/audit",
  "wizard": "/properties/new",
  "property": "/properties/[id]",
  "upload": "/reels/upload",
  "project": "/projects/[id]",
  "agent": "/agents/[id]",
  "agency": "/agencies/[id]",
  "user": "/users/[id]"
};

export function routeFor(view: View, id = "") {
  const route = viewRoutes[view];
  // Design previews without a selected record use a dedicated preview route.
  return route.replace("[id]", encodeURIComponent(id || "preview"));
}

export function viewForPath(pathname: string): View {
  const exact = (Object.entries(viewRoutes) as [View, string][]).find(([, path]) => path === pathname);
  if (exact) return exact[0];
  const detail = (Object.entries(viewRoutes) as [View, string][]).find(([, path]) => path.includes("[id]") && pathname.startsWith(path.split("[id]")[0]));
  return detail?.[0] || "dashboard";
}

export const authPaths = ["/sign-in", "/password-recovery", "/accept-invitation"];

// Every console screen is served by one catch-all route, so dev mode compiles it once.
export function resolvePath(pathname: string): { view: View; id: string } | "auth" | null {
  if (authPaths.includes(pathname)) return "auth";
  const entries = Object.entries(viewRoutes) as [View, string][];
  const exact = entries.find(([, path]) => path === pathname);
  if (exact) return { view: exact[0], id: "" };
  for (const [view, path] of entries) {
    if (!path.includes("[id]")) continue;
    const prefix = path.split("[id]")[0];
    const rest = pathname.slice(prefix.length);
    if (pathname.startsWith(prefix) && rest && !rest.includes("/")) {
      const id = decodeURIComponent(rest);
      return { view, id: id === "preview" ? "" : id };
    }
  }
  return null;
}

export const staticPaths = [...authPaths, ...Object.values(viewRoutes).filter((path) => !path.includes("[id]"))];
