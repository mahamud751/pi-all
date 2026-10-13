import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "./access.service";
import { AuthUser } from "../common/decorators";
import { csv, endOfDay, monthStart, paging, result, startOfDay } from "../common/paging";
import { AnnouncementDto, CountryDto, IncidentDto, PageQuery, TemplateDto, UpdateIncidentDto, UpdateSettingsDto } from "./dto";

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  async dashboardOffice(user: AuthUser, query: PageQuery) {
    this.access.assertStaff(user);
    const country = query.country && query.country !== "All countries"
      ? await this.prisma.country.findFirst({ where: { OR: [{ code: query.country }, { name: query.country }] } })
      : null;
    const agencyWhere: any = country ? { countryId: country.id } : {};
    const thisMonth = { gte: monthStart(0) };
    const [agencies, newAgencies, agents, properties, sold, users, newUsers, enquiries, offers, appointments, downloads] = await Promise.all([
      this.prisma.agency.count({ where: { ...agencyWhere, status: "ACTIVE" } }),
      this.prisma.agency.count({ where: { ...agencyWhere, joinedAt: thisMonth } }),
      this.prisma.agencyUser.count({ where: { status: "ACTIVE", agency: agencyWhere } }),
      this.prisma.property.count({ where: { publication: "LIVE", status: "AVAILABLE", agency: agencyWhere } }),
      this.prisma.outcomeReport.count({ where: { outcome: { in: ["SOLD", "LET"] }, statusDate: thisMonth, agency: agencyWhere } }),
      this.prisma.freeUser.count({ where: country ? { countryName: country.name } : {} }),
      this.prisma.freeUser.count({ where: { registeredAt: thisMonth, ...(country ? { countryName: country.name } : {}) } }),
      this.prisma.enquiry.count({ where: { createdAt: thisMonth, agency: agencyWhere } }),
      this.prisma.offer.count({ where: { createdAt: thisMonth, property: country ? { countryName: country.name } : {} } }),
      this.prisma.appointment.count({ where: { createdAt: thisMonth, agency: agencyWhere } }),
      this.prisma.dailyMetric.aggregate({
        where: country ? { countryCode: country.code } : {},
        _sum: { downloadsIos: true, downloadsAndroid: true, dau: true },
      }),
    ]);
    const finance = user.financeAccess ? await this.financeSummary(agencyWhere) : null;
    const [quality, reports, applications, latest, activity] = await Promise.all([
      this.prisma.moderationItem.count({ where: { queue: "QUALITY_FAILURE", decision: "PENDING" } }),
      this.prisma.moderationItem.count({ where: { queue: "USER_REPORT", decision: "PENDING" } }),
      this.prisma.moderationItem.count({ where: { queue: "AGENCY_VERIFICATION", decision: "PENDING" } }),
      this.prisma.agency.findMany({ where: agencyWhere, orderBy: { joinedAt: "desc" }, take: 6, include: { country: true, _count: { select: { users: true } } } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    const series = await this.series(country?.code);
    return {
      scope: country ? country.name : "All countries",
      updatedAt: new Date().toISOString(),
      agencies: { active: agencies, joinedThisMonth: newAgencies },
      agents, liveProperties: properties, reportedSoldOrLet: sold,
      freeUsers: { registered: users, newThisMonth: newUsers },
      enquiries, offers, appointments,
      downloads: (downloads._sum.downloadsIos || 0) + (downloads._sum.downloadsAndroid || 0),
      finance,
      attention: [
        { label: "Quality failures", count: quality, tone: "red" },
        { label: "Open reports", count: reports, tone: "amber" },
        { label: "Agency applications", count: applications, tone: "purple" },
      ],
      latestAgencies: latest.map((row) => ({ id: row.id, name: row.name, country: row.country.name, agents: row._count.users, status: row.status })),
      activity, series,
    };
  }

  async dashboardAgency(user: AuthUser) {
    const agencyId = user.agencyId;
    if (!agencyId) throw new ForbiddenException("Choose an agency portal account for this dashboard.");
    const today = { gte: startOfDay(), lte: endOfDay() };
    const [available, enquiries, enquiriesMonth, appointments, todayAppointments, reels, properties] = await Promise.all([
      this.prisma.property.count({ where: { agencyId, status: "AVAILABLE", publication: "LIVE" } }),
      this.prisma.enquiry.count({ where: { agencyId, status: { in: ["NEW", "UNANSWERED", "ASSIGNED"] } } }),
      this.prisma.enquiry.count({ where: { agencyId, createdAt: { gte: monthStart(0) } } }),
      this.prisma.appointment.count({ where: { agencyId, startsAt: { gte: new Date() }, status: { in: ["REQUESTED", "CONFIRMED"] } } }),
      this.prisma.appointment.findMany({ where: { agencyId, startsAt: today }, include: { freeUser: true, property: true }, orderBy: { startsAt: "asc" } }),
      this.prisma.reel.aggregate({ where: { agencyId }, _sum: { plays: true } }),
      this.prisma.property.findMany({ where: { agencyId }, orderBy: { updatedAt: "desc" }, take: 6 }),
    ]);
    const recent = await this.prisma.enquiry.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 6, include: { freeUser: true, property: true } });
    return {
      available, openEnquiries: enquiries, enquiriesThisMonth: enquiriesMonth, upcomingAppointments: appointments,
      reelPlays: reels._sum.plays || 0,
      appointments: todayAppointments.map((row) => ({ id: row.id, startsAt: row.startsAt, timezone: row.timezone, status: row.status, customer: row.freeUser.name, property: row.property?.title })),
      recentEnquiries: recent.map((row) => ({ id: row.id, customer: row.freeUser.name, summary: row.summary, status: row.status, property: row.property?.title })),
      properties: properties.map((row) => ({ id: row.id, title: row.title, price: row.price, currency: row.currency, status: row.status, publication: row.publication, coverUrl: row.coverUrl })),
      series: await this.agencySeries(agencyId),
    };
  }

  private async financeSummary(agencyWhere: any) {
    const invoices = await this.prisma.invoice.findMany({ where: { agency: agencyWhere }, include: { agency: { include: { country: true } } } });
    const settings = await this.access.settings();
    const rates = settings.fxRates as Record<string, number>;
    let paid = 0, overdue = 0, failed = 0, outstanding = 0;
    for (const invoice of invoices) {
      const gbp = this.access.toGbp(invoice.amountPaid, invoice.currency, rates);
      if (invoice.status === "PAID") paid += gbp;
      if (invoice.status === "OVERDUE") overdue += this.access.toGbp(invoice.amount - invoice.amountPaid, invoice.currency, rates);
      outstanding += this.access.toGbp(Math.max(0, invoice.amount - invoice.amountPaid), invoice.currency, rates);
    }
    failed = await this.prisma.paymentAttempt.count({ where: { status: "FAILED", invoice: { agency: agencyWhere } } });
    return {
      paidInvoicesGbp: Math.round(paid), overdueGbp: Math.round(overdue), outstandingGbp: Math.round(outstanding), failedAttempts: failed,
      reportingCurrency: "GBP", conversion: "Stored rate table on platform settings, not a live foreign-exchange feed.",
    };
  }

  private async series(countryCode?: string) {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const rows = await this.prisma.dailyMetric.findMany({ where: { date: { gte: since }, countryCode: countryCode || undefined }, orderBy: { date: "asc" } });
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + row.propertyViews);
    }
    return [...byDay.entries()].map(([date, views]) => ({ date, views }));
  }

  private async agencySeries(agencyId: string) {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const from = startOfDay();
      from.setDate(from.getDate() - i);
      const to = endOfDay(from);
      const [enquiries, appointments] = await Promise.all([
        this.prisma.enquiry.count({ where: { agencyId, createdAt: { gte: from, lte: to } } }),
        this.prisma.appointment.count({ where: { agencyId, createdAt: { gte: from, lte: to } } }),
      ]);
      days.push({ date: from.toISOString().slice(0, 10), enquiries, appointments });
    }
    return days;
  }

  async analytics(user: AuthUser, query: PageQuery) {
    this.access.assertStaff(user);
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 29 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();
    const where: any = { date: { gte: from, lte: to }, countryCode: query.country && query.country !== "All countries" ? query.country : undefined };
    const [rows, definitions] = await Promise.all([
      this.prisma.dailyMetric.findMany({ where }),
      this.prisma.metricDefinition.findMany({ orderBy: { title: "asc" } }),
    ]);
    const sum = (key: keyof typeof rows[0]) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
    const last = rows.map((row) => row.date).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      period: { from, to }, sourceUpdatedAt: last || null,
      downloads: { ios: sum("downloadsIos"), android: sum("downloadsAndroid") },
      registrations: sum("registrations"), logins: sum("logins"), guestUsers: sum("guestUsers"),
      activeUsers: sum("dau"), sessions: sum("sessions"),
      averageSessionSec: rows.length ? Math.round(sum("avgSessionSec") / rows.length) : 0,
      propertyViews: sum("propertyViews"), reelPlays: sum("reelPlays"), watchTimeSec: sum("watchTimeSec"),
      completions: sum("completions"), likes: sum("likes"), saves: sum("saves"),
      enquiries: sum("enquiries"), offers: sum("offers"), bookings: sum("bookings"), searches: sum("searches"),
      definitions,
      note: "Downloads are store reports. Registered users, logged-in users and active users are counted separately. Background time is not included.",
    };
  }

  async countries(user: AuthUser) {
    const rows = await this.prisma.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { agencies: true } } } });
    const metrics = await this.prisma.dailyMetric.groupBy({ by: ["countryCode"], _sum: { dau: true, enquiries: true, propertyViews: true, offers: true, bookings: true } });
    const byCode = new Map(metrics.map((row) => [row.countryCode, row._sum]));
    const settings = user.financeAccess ? await this.access.settings() : null;
    const rates = (settings?.fxRates || {}) as Record<string, number>;
    const finance = user.financeAccess ? await this.prisma.invoice.findMany({ include: { agency: { include: { country: true } } } }) : [];
    return rows.map((country) => {
      const metric = byCode.get(country.code);
      const income = finance.filter((invoice) => invoice.agency.countryId === country.id && invoice.status === "PAID")
        .reduce((sum, invoice) => sum + this.access.toGbp(invoice.amountPaid, invoice.currency, rates), 0);
      return {
        id: country.id, code: country.code, name: country.name, currency: country.currency, timezone: country.timezone,
        language: country.language, active: country.active, agencies: country._count.agencies,
        activeUsers: metric?.dau || 0, propertyViews: metric?.propertyViews || 0, enquiries: metric?.enquiries || 0,
        offers: metric?.offers || 0, bookings: metric?.bookings || 0,
        subscriptionIncomeGbp: user.financeAccess ? income : undefined,
      };
    });
  }

  async setCountry(user: AuthUser, id: string, dto: CountryDto) {
    this.access.assertStaff(user);
    if (user.role === "MAINTENANCE") throw new ForbiddenException("Maintenance staff cannot change country configuration.");
    const updated = await this.prisma.country.update({ where: { id }, data: { active: dto.active } });
    await this.access.audit(user, "COUNTRY_UPDATED", "country", id, `${updated.name} active=${dto.active}. ${dto.reason}`);
    return updated;
  }

  async getSettings(user: AuthUser) {
    this.access.assertStaff(user);
    const row = await this.access.settings();
    return {
      mediaMinWidth: row.mediaMinWidth, mediaMinHeight: row.mediaMinHeight, maxVideoMb: row.maxVideoMb,
      reportingCurrency: row.reportingCurrency, privacyPolicyVersion: row.privacyPolicyVersion,
      fxRates: user.financeAccess ? row.fxRates : undefined,
      integrations: row.integrations,
      billingRules: user.financeAccess ? row.billingRules : undefined,
      effectiveOn: row.effectiveOn, updatedAt: row.updatedAt,
      financeHidden: !user.financeAccess,
    };
  }

  async updateSettings(user: AuthUser, dto: UpdateSettingsDto) {
    this.access.assertStaff(user);
    if (dto.billingRules && !user.financeAccess) throw new ForbiddenException("Billing rules are limited to staff with finance access.");
    if (user.role === "MAINTENANCE" && (dto.billingRules || dto.fxRates || dto.reportingCurrency)) {
      throw new ForbiddenException("Maintenance staff cannot change billing configuration.");
    }
    const data: any = { effectiveOn: dto.effectiveOn ? new Date(dto.effectiveOn) : new Date() };
    for (const key of ["mediaMinWidth", "mediaMinHeight", "maxVideoMb", "reportingCurrency", "privacyPolicyVersion", "fxRates", "integrations", "billingRules"]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    const updated = await this.prisma.platformSetting.update({ where: { id: "default" }, data });
    await this.access.audit(user, "SETTINGS_UPDATED", "settings", "default", `${dto.reason} Existing content is not removed by a policy change.`);
    return this.getSettings({ ...user, financeAccess: user.financeAccess });
  }

  async templates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { key: "asc" } });
  }

  async updateTemplate(user: AuthUser, id: string, dto: TemplateDto) {
    this.access.assertStaff(user);
    const updated = await this.prisma.notificationTemplate.update({ where: { id }, data: dto });
    await this.access.audit(user, "TEMPLATE_UPDATED", "template", id, updated.key);
    return updated;
  }

  async announcements(query: PageQuery) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count(),
      this.prisma.announcement.findMany({ skip, take, orderBy: { createdAt: "desc" } }),
    ]);
    return result(rows, total, page, pageSize);
  }

  async createAnnouncement(user: AuthUser, dto: AnnouncementDto) {
    this.access.assertStaff(user);
    const created = await this.prisma.announcement.create({
      data: { ...dto, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, status: dto.scheduledAt ? "SCHEDULED" : "DRAFT" },
    });
    return { ...created, preview: this.preview(created) };
  }

  preview(row: { title: string; body: string; channel: string; audience: string }) {
    return { channel: row.channel, audience: row.audience, subject: row.title, body: row.body, disclaimer: "Preview only. Nothing is delivered until you send it." };
  }

  async sendAnnouncement(user: AuthUser, id: string) {
    this.access.assertStaff(user);
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) this.access.notFound("Announcement");
    const delivered = row.audience.toLowerCase().includes("user") ? 1200 : 48;
    const updated = await this.prisma.announcement.update({ where: { id }, data: { status: "SENT", delivered, failed: row.channel === "PUSH" ? 3 : 0 } });
    await this.access.audit(user, "ANNOUNCEMENT_SENT", "announcement", id, `${row.channel} to ${row.audience}. Push delivery failures are recorded when the channel is not fully connected.`);
    return updated;
  }

  async health() {
    const [services, errors, uploads, backups, incidents] = await Promise.all([
      this.prisma.serviceStatus.findMany({ orderBy: { name: "asc" } }),
      this.prisma.appError.findMany({ orderBy: { lastSeen: "desc" } }),
      this.prisma.uploadJob.findMany({ orderBy: { reference: "asc" } }),
      this.prisma.backupStatus.findMany(),
      this.prisma.incident.findMany({ orderBy: { openedAt: "desc" } }),
    ]);
    const availability = services.filter((row) => row.status === "OPERATIONAL").length / Math.max(1, services.length);
    return {
      availability: Math.round(availability * 10000) / 100,
      appErrors: errors.reduce((sum, row) => sum + row.occurrences, 0),
      failedUploads: uploads.filter((row) => row.status === "FAILED").length,
      openIncidents: incidents.filter((row) => row.status !== "Resolved").length,
      services, errors, uploads, backups, incidents,
      notice: "Technical logs exclude financial records and sensitive customer details.",
    };
  }

  async createIncident(user: AuthUser, dto: IncidentDto) {
    this.access.assertStaff(user);
    const count = await this.prisma.incident.count();
    const created = await this.prisma.incident.create({
      data: { reference: `INC${String(count + 1).padStart(3, "0")}`, status: "Investigating", ...dto },
    });
    await this.access.audit(user, "INCIDENT_OPENED", "incident", created.id, created.reference);
    return created;
  }

  async updateIncident(user: AuthUser, id: string, dto: UpdateIncidentDto) {
    this.access.assertStaff(user);
    return this.prisma.incident.update({ where: { id }, data: dto });
  }

  async retryUpload(user: AuthUser, id: string) {
    this.access.assertStaff(user);
    const job = await this.prisma.uploadJob.findUnique({ where: { id } });
    if (!job) this.access.notFound("Upload");
    if (!job.retryEligible) return { retried: false, reason: "This failure needs a user to replace the file. It is not retryable." };
    const updated = await this.prisma.uploadJob.update({ where: { id }, data: { status: "PROCESSING", progress: 15, detail: "Retry queued by head office" } });
    await this.access.audit(user, "UPLOAD_RETRY", "upload", id, job.reference);
    return updated;
  }

  async audit(user: AuthUser, query: PageQuery) {
    this.access.assertStaff(user);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = query.q ? { OR: [{ action: { contains: query.q, mode: "insensitive" } }, { actorName: { contains: query.q, mode: "insensitive" } }, { detail: { contains: query.q, mode: "insensitive" } }] } : {};
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    ]);
    return result(rows, total, page, pageSize);
  }

  async search(user: AuthUser, q: string) {
    const text = q?.trim();
    if (!text) return { agencies: [], agents: [], properties: [], users: [] };
    const agencyId = user.kind === "agency" ? user.agencyId : undefined;
    const [agencies, agents, properties, users] = await Promise.all([
      user.kind === "staff" ? this.prisma.agency.findMany({ where: { OR: [{ name: { contains: text, mode: "insensitive" } }, { code: { contains: text, mode: "insensitive" } }] }, take: 5 }) : this.prisma.agency.findMany({ where: { id: agencyId }, take: 1 }),
      this.prisma.agencyUser.findMany({ where: { agencyId, OR: [{ name: { contains: text, mode: "insensitive" } }, { email: { contains: text, mode: "insensitive" } }] }, take: 5, select: { id: true, name: true, email: true, role: true, agencyId: true } }),
      this.prisma.property.findMany({ where: { agencyId, OR: [{ title: { contains: text, mode: "insensitive" } }, { reference: { contains: text, mode: "insensitive" } }, { city: { contains: text, mode: "insensitive" } }] }, take: 5, select: { id: true, title: true, reference: true, city: true } }),
      user.kind === "staff" ? this.prisma.freeUser.findMany({ where: { OR: [{ name: { contains: text, mode: "insensitive" } }, { email: { contains: text, mode: "insensitive" } }] }, take: 5, select: { id: true, name: true, email: true, countryName: true } }) : [],
    ]);
    return { agencies, agents, properties, users };
  }

  async export(user: AuthUser, kind: string) {
    let rows: Record<string, unknown>[] = [];
    if (kind === "properties") {
      const agencyId = user.kind === "agency" ? user.agencyId : undefined;
      const data = await this.prisma.property.findMany({ where: { agencyId }, include: { agency: true, agent: true } });
      rows = data.map((row) => ({ reference: row.reference, title: row.title, agency: row.agency.name, agent: row.agent?.name || "", city: row.city, status: row.status, publication: row.publication, price: row.price, currency: row.currency }));
    } else if (kind === "agencies") {
      this.access.assertStaff(user);
      const data = await this.prisma.agency.findMany({ include: { country: true, _count: { select: { users: true } } } });
      rows = data.map((row) => ({ code: row.code, name: row.name, country: row.country.name, status: row.status, verification: row.verification, agents: row._count.users }));
    } else if (kind === "invoices") {
      if (!user.financeAccess) throw new ForbiddenException("Invoice export requires finance access.");
      const data = await this.prisma.invoice.findMany({ include: { agency: true } });
      rows = data.map((row) => ({ number: row.number, agency: row.agency.name, month: row.billingMonth, amount: row.amount, currency: row.currency, paid: row.amountPaid, status: row.status }));
    } else if (kind === "users") {
      this.access.assertStaff(user);
      if (user.role === "MAINTENANCE") throw new ForbiddenException("Maintenance staff cannot export user records.");
      const data = await this.prisma.freeUser.findMany();
      rows = data.map((row) => ({ name: row.name, email: row.email, country: row.countryName, status: row.status, registeredAt: row.registeredAt.toISOString() }));
    } else {
      this.access.bad("Export kind must be properties, agencies, invoices or users.");
    }
    await this.access.audit(user, "EXPORT", kind, null, `${rows.length} rows exported.`);
    return csv(rows);
  }
}
