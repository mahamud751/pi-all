import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "./access.service";
import { AuthUser } from "../common/decorators";
import { contains, paging, result } from "../common/paging";
import { AgencyStatusDto, CreateAgencyDto, CreateStaffDto, InviteAgentDto, PageQuery, ReassignDto, UpdateAgencyDto, UpdateAgentDto, UpdateStaffDto, UserActionDto } from "./dto";

const PLAN_FEE = { STARTER: 99, GROWTH: 249, PROFESSIONAL: 499, ENTERPRISE: 899 };
const PLAN_LIMITS = {
  STARTER: { agentAllowance: 5, listingAllowance: 50 },
  GROWTH: { agentAllowance: 15, listingAllowance: 200 },
  PROFESSIONAL: { agentAllowance: 40, listingAllowance: 800 },
  ENTERPRISE: { agentAllowance: 100, listingAllowance: 5000 },
};

function paymentOf(agency: { subscription?: { status: string } | null; invoices?: { status: string }[] }) {
  if (agency.invoices?.some((invoice) => invoice.status === "OVERDUE")) return "OVERDUE";
  return agency.subscription?.status || "NONE";
}

function safeAgent(agent: any) {
  if (!agent) return agent;
  const { passwordHash, inviteToken, ...rest } = agent;
  return rest;
}

@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  private countryWhere(country?: string) {
    if (!country || country === "All countries") return undefined;
    return { OR: [{ code: { equals: country, mode: "insensitive" as const } }, { name: { equals: country, mode: "insensitive" as const } }] };
  }

  async agencies(user: AuthUser, query: PageQuery & { status?: string; plan?: string; verification?: string; payment?: string }) {
    this.access.assertStaff(user);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = {
      country: this.countryWhere(query.country),
      status: query.status || undefined,
      plan: query.plan || undefined,
      verification: query.verification || undefined,
    };
    if (query.q) where.OR = [{ name: contains(query.q) }, { code: contains(query.q) }, { city: contains(query.q) }, { email: contains(query.q) }];
    if (query.payment === "OVERDUE") where.invoices = { some: { status: "OVERDUE" } };
    if (query.payment && query.payment !== "OVERDUE") where.subscription = { status: query.payment };
    const [total, rows] = await Promise.all([
      this.prisma.agency.count({ where }),
      this.prisma.agency.findMany({
        where, skip, take, orderBy: { lastActivityAt: "desc" },
        include: {
          country: true,
          subscription: true,
          invoices: { where: { status: "OVERDUE" }, take: 1 },
          _count: { select: { users: true, properties: { where: { status: "AVAILABLE", publication: "LIVE" } } } },
        },
      }),
    ]);
    return result(rows.map((agency) => this.agencyCard(agency, user)), total, page, pageSize);
  }

  agencyCard(agency: any, user: AuthUser) {
    const finance = user.financeAccess;
    return {
      id: agency.id, code: agency.code, name: agency.name, city: agency.city, address: agency.address,
      email: agency.email, phone: agency.phone, website: agency.website, description: agency.description,
      status: agency.status, verification: agency.verification, plan: finance || user.kind === "agency" ? agency.plan : undefined,
      paymentStatus: finance ? paymentOf(agency) : undefined,
      country: agency.country?.name, countryCode: agency.country?.code, timezone: agency.country?.timezone, currency: agency.country?.currency,
      agentCount: agency._count?.users ?? agency.users?.length, availableProperties: agency._count?.properties,
      agentAllowance: agency.agentAllowance, listingAllowance: agency.listingAllowance,
      joinedAt: agency.joinedAt, lastActivityAt: agency.lastActivityAt,
    };
  }

  async agency(user: AuthUser, id: string) {
    const scoped = this.access.agencyId(user, id);
    if (user.kind === "staff") this.access.assertStaff(user);
    const agency = await this.prisma.agency.findUnique({
      where: { id: scoped || id },
      include: {
        country: true,
        subscription: { include: { changes: { orderBy: { createdAt: "desc" }, take: 8 } } },
        invoices: { orderBy: { dueDate: "desc" }, take: 12, include: { attempts: true } },
        users: { orderBy: { name: "asc" } },
        projects: { include: { _count: { select: { properties: true, agents: true } } } },
        properties: { orderBy: { updatedAt: "desc" }, take: 12, include: { agent: true } },
        reels: { orderBy: { uploadedAt: "desc" }, take: 8 },
        enquiries: { orderBy: { createdAt: "desc" }, take: 8, include: { freeUser: true, agent: true } },
        appointments: { orderBy: { startsAt: "desc" }, take: 8, include: { freeUser: true, agent: true, property: true } },
        outcomes: { orderBy: { statusDate: "desc" }, take: 8, include: { property: true } },
      },
    });
    if (!agency) this.access.notFound("Agency");
    const activity = await this.prisma.auditLog.findMany({ where: { detail: { contains: agency.name } }, orderBy: { createdAt: "desc" }, take: 12 });
    const finance = user.financeAccess || (user.kind === "agency" && user.role === "OWNER");
    return {
      ...this.agencyCard({ ...agency, _count: { users: agency.users.length, properties: agency.properties.filter((p) => p.status === "AVAILABLE").length } }, finance ? { ...user, financeAccess: true } : user),
      settings: {
        requireApproval: agency.requireApproval, enforceImageQuality: agency.enforceImageQuality,
        notifyEnquiries: agency.notifyEnquiries, notifyAppointments: agency.notifyAppointments,
        notifyTeam: agency.notifyTeam, twoFactorRequired: agency.twoFactorRequired,
      },
      agents: agency.users.map(safeAgent),
      projects: agency.projects,
      properties: agency.properties.map((property) => ({ ...property, agent: property.agent ? safeAgent(property.agent) : null })),
      media: agency.reels,
      leads: agency.enquiries.map((enquiry) => ({ ...enquiry, freeUser: { id: enquiry.freeUser.id, name: enquiry.freeUser.name, countryName: enquiry.freeUser.countryName } })),
      appointments: agency.appointments,
      outcomes: agency.outcomes,
      subscription: finance ? agency.subscription : null,
      invoices: finance ? agency.invoices : [],
      activity,
      financeHidden: !finance,
    };
  }

  async createAgency(user: AuthUser, dto: CreateAgencyDto) {
    this.access.assertStaff(user);
    this.access.assertNotMaintenance(user);
    const country = await this.prisma.country.findUnique({ where: { code: dto.countryCode.toUpperCase() } });
    if (!country) throw new BadRequestException("Choose a country that is configured in platform settings.");
    const count = await this.prisma.agency.count();
    const plan = (dto.plan || "GROWTH") as keyof typeof PLAN_FEE;
    const agency = await this.prisma.agency.create({
      data: {
        code: `AG-${String(count + 1).padStart(3, "0")}`,
        name: dto.name, countryId: country.id, city: dto.city, address: dto.address, email: dto.email.toLowerCase(),
        phone: dto.phone, website: dto.website, description: dto.description, status: "REVIEW", verification: "PENDING",
        plan: plan as any, ...PLAN_LIMITS[plan],
      },
      include: { country: true },
    });
    await this.prisma.subscription.create({
      data: {
        agencyId: agency.id, plan: plan as any, status: "TRIAL", monthlyFee: PLAN_FEE[plan], currency: country.currency,
        startedAt: new Date(), renewsAt: new Date(Date.now() + 14 * 86400000), trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });
    await this.prisma.moderationItem.create({
      data: { queue: "AGENCY_VERIFICATION", priority: "Normal", subject: agency.name, reason: "New agency application", entityType: "agency", entityId: agency.id, agencyId: agency.id },
    });
    await this.access.audit(user, "AGENCY_CREATED", "agency", agency.id, `${agency.name} created in ${country.name} on the ${plan} trial.`);
    return agency;
  }

  async updateAgency(user: AuthUser, id: string, dto: UpdateAgencyDto) {
    await this.access.assertCanManageAgency(user, user.kind === "agency" ? user.agencyId : id);
    const { effectiveOn, ...data } = dto;
    const agency = await this.prisma.agency.update({ where: { id: user.kind === "agency" ? user.agencyId : id }, data: data as any });
    await this.access.audit(user, "AGENCY_UPDATED", "agency", agency.id, effectiveOn ? `Settings saved, effective ${effectiveOn}.` : "Agency profile updated.");
    return this.agency(user, agency.id);
  }

  async setAgencyStatus(user: AuthUser, id: string, dto: AgencyStatusDto) {
    this.access.assertStaff(user);
    this.access.assertNotMaintenance(user);
    const agency = await this.prisma.agency.update({ where: { id }, data: { status: dto.status as any, lastActivityAt: new Date() } });
    await this.access.audit(user, "AGENCY_STATUS", "agency", id, `${agency.name} set to ${dto.status}. ${dto.reason}`);
    return { id, status: agency.status, reason: dto.reason };
  }

  async agents(user: AuthUser, query: PageQuery & { status?: string; agencyId?: string; role?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = {
      agencyId, status: query.status || undefined, role: query.role || undefined,
      agency: query.country ? { country: this.countryWhere(query.country) } : undefined,
    };
    if (query.q) where.OR = [{ name: contains(query.q) }, { email: contains(query.q) }, { city: contains(query.q) }];
    const [total, rows] = await Promise.all([
      this.prisma.agencyUser.count({ where }),
      this.prisma.agencyUser.findMany({
        where, skip, take, orderBy: { lastActivityAt: "desc" },
        include: { agency: { include: { country: true } }, _count: { select: { properties: true, projectLinks: true } } },
      }),
    ]);
    return result(rows.map((agent) => ({
      ...safeAgent(agent),
      agency: { id: agent.agency.id, name: agent.agency.name, country: agent.agency.country.name },
      propertyCount: agent._count.properties, projectCount: agent._count.projectLinks,
    })), total, page, pageSize);
  }

  async agent(user: AuthUser, id: string) {
    const agent = await this.prisma.agencyUser.findUnique({
      where: { id },
      include: {
        agency: { include: { country: true } },
        projectLinks: { include: { project: true } },
        properties: { take: 12, orderBy: { updatedAt: "desc" } },
        enquiries: { take: 12, orderBy: { createdAt: "desc" }, include: { property: true } },
        appointments: { take: 12, orderBy: { startsAt: "desc" }, include: { property: true, freeUser: true } },
      },
    });
    if (!agent) this.access.notFound("Agent");
    this.access.agencyId(user, agent.agencyId);
    const responseTimes = agent.enquiries.filter((item) => item.respondedAt).map((item) => item.respondedAt.getTime() - item.createdAt.getTime());
    const median = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)];
    return {
      ...safeAgent(agent),
      agency: { id: agent.agency.id, name: agent.agency.name, country: agent.agency.country.name },
      projects: agent.projectLinks.map((link) => link.project),
      properties: agent.properties,
      enquiries: agent.enquiries,
      appointments: agent.appointments,
      medianResponseMinutes: median ? Math.round(median / 60000) : null,
      passwordStored: "hashed",
    };
  }

  async invite(user: AuthUser, dto: InviteAgentDto, agencyId?: string) {
    const target = this.access.agencyId(user, agencyId) || agencyId;
    if (!target) throw new BadRequestException("Choose an agency for this invitation.");
    await this.access.assertCanManageAgency(user, target);
    const agency = await this.prisma.agency.findUnique({ where: { id: target }, include: { _count: { select: { users: true } } } });
    if (!agency) this.access.notFound("Agency");
    if (agency._count.users >= agency.agentAllowance) {
      throw new BadRequestException(`The ${agency.plan} plan allows ${agency.agentAllowance} accounts. Change the plan before inviting another person.`);
    }
    const token = `invite-${randomBytes(8).toString("hex")}`;
    const agent = await this.prisma.agencyUser.create({
      data: {
        agencyId: target, email: dto.email.toLowerCase(), name: dto.name, role: (dto.role || "AGENT") as any,
        title: dto.title, city: dto.city, status: "INVITED", passwordHash: await bcrypt.hash(randomBytes(12).toString("hex"), 10),
        inviteToken: token, inviteExpiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    if (dto.projectIds?.length) {
      await this.prisma.projectAgent.createMany({ data: dto.projectIds.map((projectId) => ({ projectId, agentId: agent.id })), skipDuplicates: true });
    }
    await this.access.audit(user, "AGENT_INVITED", "agent", agent.id, `${dto.email} invited to ${agency.name} as ${agent.role}.`);
    return { agent: safeAgent(agent), inviteToken: token, expiresInDays: 7, note: "Local API returns the invitation token. Production would email it." };
  }

  async updateAgent(user: AuthUser, id: string, dto: UpdateAgentDto) {
    const existing = await this.prisma.agencyUser.findUnique({ where: { id } });
    if (!existing) this.access.notFound("Agent");
    await this.access.assertCanManageAgency(user, existing.agencyId);
    const agent = await this.prisma.agencyUser.update({ where: { id }, data: dto as any });
    await this.access.audit(user, "AGENT_UPDATED", "agent", id, `Permissions or profile updated for ${agent.name}.`);
    return safeAgent(agent);
  }

  async reassign(user: AuthUser, id: string, dto: ReassignDto) {
    const from = await this.prisma.agencyUser.findUnique({ where: { id } });
    const to = await this.prisma.agencyUser.findUnique({ where: { id: dto.toAgentId } });
    if (!from || !to) this.access.notFound("Agent");
    if (from.agencyId !== to.agencyId) throw new BadRequestException("Reassignment stays inside the same agency.");
    await this.access.assertCanManageAgency(user, from.agencyId);
    await this.prisma.$transaction([
      this.prisma.property.updateMany({ where: { agentId: from.id }, data: { agentId: to.id } }),
      this.prisma.enquiry.updateMany({ where: { agentId: from.id, status: { in: ["NEW", "ASSIGNED", "UNANSWERED"] } }, data: { agentId: to.id, status: "ASSIGNED" } }),
      this.prisma.appointment.updateMany({ where: { agentId: from.id, startsAt: { gte: new Date() }, status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"] } }, data: { agentId: to.id } }),
      this.prisma.reel.updateMany({ where: { agentId: from.id, publication: { in: ["DRAFT", "PENDING_REVIEW"] } }, data: { agentId: to.id } }),
    ]);
    const links = await this.prisma.projectAgent.findMany({ where: { agentId: from.id } });
    for (const link of links) {
      await this.prisma.projectAgent.delete({ where: { projectId_agentId: { projectId: link.projectId, agentId: from.id } } });
      await this.prisma.projectAgent.upsert({
        where: { projectId_agentId: { projectId: link.projectId, agentId: to.id } },
        create: { projectId: link.projectId, agentId: to.id }, update: {},
      });
    }
    if (dto.deactivate !== false) await this.prisma.agencyUser.update({ where: { id: from.id }, data: { status: "DEACTIVATED" } });
    await this.access.audit(user, "AGENT_REASSIGNED", "agent", from.id, `Open work moved from ${from.name} to ${to.name}. ${dto.reason}`);
    return { from: from.id, to: to.id, deactivated: dto.deactivate !== false };
  }

  async users(user: AuthUser, query: PageQuery & { status?: string }) {
    if (user.kind === "staff" && user.role === "MAINTENANCE") {
      // Maintenance may search accounts for a technical ticket, but cannot export them.
    }
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { AND: [] as any[], status: query.status || undefined, countryName: undefined };
    if (query.country && query.country !== "All countries") {
      const country = await this.prisma.country.findFirst({ where: { OR: [{ code: { equals: query.country, mode: "insensitive" } }, { name: { equals: query.country, mode: "insensitive" } }] } });
      where.countryName = country?.name || query.country;
    }
    if (query.from || query.to) where.registeredAt = { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined };
    if (query.q) where.AND.push({ OR: [{ name: contains(query.q) }, { email: contains(query.q) }] });
    const connected = user.kind === "agency" ? { OR: [
      { enquiries: { some: { agencyId: user.agencyId } } },
      { appointments: { some: { agencyId: user.agencyId } } },
      { offers: { some: { agencyId: user.agencyId } } },
    ] } : {};
    if (user.kind === "agency") where.AND.push(connected);
    if (!where.AND.length) delete where.AND;
    const [registeredUsers, total, rows] = await Promise.all([
      this.prisma.freeUser.count({ where: connected }),
      this.prisma.freeUser.count({ where }),
      this.prisma.freeUser.findMany({
        where, skip, take, orderBy: { lastActivityAt: "desc" },
        include: { _count: { select: { enquiries: true, offers: true, appointments: true } } },
      }),
    ]);
    return { ...result(rows, total, page, pageSize), registeredUsers, filteredCount: total };
  }

  async user(user: AuthUser, id: string) {
    this.access.assertStaff(user);
    const row = await this.prisma.freeUser.findUnique({
      where: { id },
      include: {
        enquiries: { orderBy: { createdAt: "desc" }, take: 20, include: { property: true, agency: true } },
        offers: { orderBy: { createdAt: "desc" }, include: { property: true } },
        appointments: { orderBy: { startsAt: "desc" }, take: 20, include: { property: true, agency: true } },
      },
    });
    if (!row) this.access.notFound("User");
    return {
      ...row,
      privacy: "Personal activity is limited to authorised head-office roles. Free users have no invoices and no subscription.",
      enquiries: row.enquiries.map((item) => ({ id: item.id, summary: item.summary, channel: item.channel, status: item.status, createdAt: item.createdAt, property: item.property?.title, agency: item.agency.name })),
    };
  }

  async deletionRequest(user: AuthUser, id: string, dto: UserActionDto) {
    this.access.assertStaff(user);
    this.access.assertNotMaintenance(user);
    const row = await this.prisma.freeUser.update({ where: { id }, data: { status: "DELETION_REQUESTED", deletionRequestedAt: new Date() } });
    await this.access.audit(user, "DELETION_REQUESTED", "freeUser", id, dto.reason);
    return { id: row.id, status: row.status };
  }

  async confirmDeletion(user: AuthUser, id: string, dto: UserActionDto) {
    this.access.assertStaff(user);
    if (user.role !== "SUPER_ADMIN") throw new ForbiddenException("Only a super admin can confirm deletion.");
    await this.prisma.freeUser.update({
      where: { id },
      data: { name: "Deleted user", email: `deleted-${id}@anonymised.local`, phone: null, status: "DEACTIVATED", deletionConfirmedAt: new Date() },
    });
    await this.access.audit(user, "USER_ANONYMISED", "freeUser", id, dto.reason);
    return { id, anonymised: true };
  }

  async userSupport(user: AuthUser, id: string, dto: UserActionDto) {
    this.access.assertStaff(user);
    const account = await this.prisma.freeUser.findUnique({ where: { id } });
    if (!account) this.access.notFound("User");
    const count = await this.prisma.supportTicket.count();
    const ticket = await this.prisma.supportTicket.create({
      data: {
        number: `SUP${1000 + count + 1}`, requesterType: "FREE_USER", freeUserId: id, category: "Account support",
        priority: "NORMAL", subject: `Support for ${account.name}`, status: "OPEN",
        messages: { create: { authorName: user.name, body: dto.reason } },
      },
    });
    await this.access.audit(user, "USER_SUPPORT", "freeUser", id, `Ticket ${ticket.number} opened. ${dto.reason}`);
    return ticket;
  }

  async staff(user: AuthUser) {
    this.access.assertStaff(user);
    const rows = await this.prisma.staffUser.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sessions: { where: { revoked: false, expiresAt: { gt: new Date() } } } } } } });
    return rows.map((row) => ({
      id: row.id, email: row.email, name: row.name, role: row.role, active: row.active,
      financeAccess: row.role === "SUPER_ADMIN" || row.financeAccess, twoFactor: row.twoFactor,
      lastLoginAt: row.lastLoginAt, openSessions: row._count.sessions,
    }));
  }

  async createStaff(user: AuthUser, dto: CreateStaffDto) {
    if (user.role !== "SUPER_ADMIN") throw new ForbiddenException("Only a super admin can create staff accounts.");
    if (dto.role === "MAINTENANCE" && dto.financeAccess) throw new BadRequestException("Maintenance staff cannot receive finance access.");
    const created = await this.prisma.staffUser.create({
      data: {
        email: dto.email.toLowerCase(), name: dto.name, role: dto.role as any,
        financeAccess: dto.role === "SUPER_ADMIN" ? true : Boolean(dto.financeAccess),
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    await this.access.audit(user, "STAFF_CREATED", "staff", created.id, `${created.email} created as ${created.role}.`);
    return { id: created.id, email: created.email, role: created.role };
  }

  async updateStaff(user: AuthUser, id: string, dto: UpdateStaffDto) {
    if (user.role !== "SUPER_ADMIN") throw new ForbiddenException("Only a super admin can change staff access.");
    if (dto.role === "MAINTENANCE") dto.financeAccess = false;
    const data: any = { ...dto };
    let twoFactorCode: string | undefined;
    if (dto.twoFactor === true) {
      twoFactorCode = String(Math.floor(100000 + Math.random() * 900000));
      data.twoFactorCode = twoFactorCode;
    }
    if (dto.twoFactor === false) data.twoFactorCode = null;
    const updated = await this.prisma.staffUser.update({ where: { id }, data });
    await this.access.audit(user, "STAFF_UPDATED", "staff", id, `Access updated for ${updated.email}.`);
    return { id: updated.id, role: updated.role, financeAccess: updated.financeAccess, twoFactor: updated.twoFactor, twoFactorCode };
  }

  async revokeSessions(user: AuthUser, id: string) {
    if (user.role !== "SUPER_ADMIN" && user.sub !== id) throw new ForbiddenException("Only a super admin can revoke another person's sessions.");
    const result = await this.prisma.session.updateMany({ where: { staffId: id, revoked: false }, data: { revoked: true } });
    await this.access.audit(user, "SESSIONS_REVOKED", "staff", id, `${result.count} sessions revoked.`);
    return { revoked: result.count };
  }

  planCatalog() {
    return Object.entries(PLAN_FEE).map(([code, monthlyFeeGbp]) => ({ code, monthlyFeeGbp, ...PLAN_LIMITS[code as keyof typeof PLAN_FEE] }));
  }
}
