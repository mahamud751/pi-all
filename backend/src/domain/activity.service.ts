import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "./access.service";
import { AuthUser } from "../common/decorators";
import { contains, paging, result } from "../common/paging";
import { CorrectOutcomeDto, CreateAppointmentDto, PageQuery, UpdateAppointmentDto, UpdateEnquiryDto, UpdateOfferDto } from "./dto";

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  async enquiries(user: AuthUser, query: PageQuery & { status?: string; channel?: string; agencyId?: string; unassigned?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, status: query.status || undefined, channel: query.channel || undefined };
    if (query.country && query.country !== "All countries") {
      where.agency = { country: { OR: [{ code: { equals: query.country, mode: "insensitive" } }, { name: { equals: query.country, mode: "insensitive" } }] } };
    }
    if (query.unassigned === "true") where.agentId = null;
    if (query.q) where.OR = [{ summary: contains(query.q) }, { freeUser: { name: contains(query.q) } }, { property: { title: contains(query.q) } }];
    const [total, rows] = await Promise.all([
      this.prisma.enquiry.count({ where }),
      this.prisma.enquiry.findMany({
        where, skip, take, orderBy: { createdAt: "desc" },
        include: { freeUser: true, agency: true, agent: true, property: true, reel: true },
      }),
    ]);
    return result(rows.map((row) => this.enquiryCard(row)), total, page, pageSize);
  }

  enquiryCard(row: any) {
    const responseMinutes = row.respondedAt ? Math.round((row.respondedAt.getTime() - row.createdAt.getTime()) / 60000) : null;
    return {
      id: row.id, source: row.source, channel: row.channel, status: row.status, summary: row.summary,
      createdAt: row.createdAt, respondedAt: row.respondedAt, responseMinutes,
      customer: { id: row.freeUser.id, name: row.freeUser.name, countryName: row.freeUser.countryName },
      agency: { id: row.agency.id, name: row.agency.name },
      agent: row.agent ? { id: row.agent.id, name: row.agent.name } : null,
      property: row.property ? { id: row.property.id, title: row.property.title, reference: row.property.reference } : null,
      reel: row.reel ? { id: row.reel.id, caption: row.reel.caption } : null,
      privateMessage: "Private message contents are not stored in reporting views.",
    };
  }

  async updateEnquiry(user: AuthUser, id: string, dto: UpdateEnquiryDto) {
    const row = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!row) this.access.notFound("Enquiry");
    this.access.agencyId(user, row.agencyId);
    if (user.kind === "agency") {
      const actor = await this.access.requireAgencyUser(user);
      if (actor.role === "AGENT" && !actor.canManageEnquiries) throw new BadRequestException("Your account cannot manage enquiries.");
    }
    const data: any = {};
    if (dto.agentId) data.agentId = dto.agentId;
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === "ANSWERED") data.respondedAt = new Date();
    }
    if (dto.agentId && !dto.status) data.status = "ASSIGNED";
    const updated = await this.prisma.enquiry.update({
      where: { id }, data, include: { freeUser: true, agency: true, agent: true, property: true, reel: true },
    });
    await this.access.audit(user, "ENQUIRY_UPDATED", "enquiry", id, `Enquiry set to ${updated.status}.`);
    return this.enquiryCard(updated);
  }

  async offers(user: AuthUser, query: PageQuery & { status?: string; agencyId?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, status: query.status || undefined };
    if (query.q) where.OR = [{ freeUser: { name: contains(query.q) } }, { property: { title: contains(query.q) } }];
    const [total, rows] = await Promise.all([
      this.prisma.offer.count({ where }),
      this.prisma.offer.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { property: true, freeUser: true } }),
    ]);
    return result(rows.map((row) => ({
      id: row.id, amount: row.amount, currency: row.currency, status: row.status, createdAt: row.createdAt,
      property: { id: row.property.id, title: row.property.title, reference: row.property.reference, status: row.property.status },
      user: { id: row.freeUser.id, name: row.freeUser.name },
      rule: "Accepting an offer does not mark the property sold.",
    })), total, page, pageSize);
  }

  async updateOffer(user: AuthUser, id: string, dto: UpdateOfferDto) {
    const row = await this.prisma.offer.findUnique({ where: { id }, include: { property: true } });
    if (!row) this.access.notFound("Offer");
    this.access.agencyId(user, row.agencyId);
    const updated = await this.prisma.offer.update({ where: { id }, data: { status: dto.status as any } });
    await this.access.audit(user, "OFFER_UPDATED", "offer", id, `Offer ${dto.status}. Property status left at ${row.property.status}. ${dto.reason || ""}`);
    return { ...updated, propertyStatusUnchanged: row.property.status, note: "An accepted offer does not mark the property sold or let. Record a reported outcome separately." };
  }

  async appointments(user: AuthUser, query: PageQuery & { status?: string; agencyId?: string; agentId?: string; kind?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, status: query.status || undefined, agentId: query.agentId || undefined, kind: query.kind || undefined };
    if (query.from || query.to) where.startsAt = { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined };
    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where, skip, take, orderBy: { startsAt: "asc" },
        include: { property: true, freeUser: true, agency: true, agent: true },
      }),
    ]);
    return result(rows.map((row) => this.appointmentCard(row)), total, page, pageSize);
  }

  appointmentCard(row: any) {
    return {
      id: row.id, kind: row.kind, status: row.status, startsAt: row.startsAt, timezone: row.timezone, notes: row.notes,
      property: row.property ? { id: row.property.id, title: row.property.title } : null,
      customer: { id: row.freeUser.id, name: row.freeUser.name },
      agency: { id: row.agency.id, name: row.agency.name },
      agent: row.agent ? { id: row.agent.id, name: row.agent.name } : null,
    };
  }

  private async assertNoClash(agentId: string | undefined, startsAt: Date, ignoreId?: string) {
    if (!agentId) return;
    const clash = await this.prisma.appointment.findFirst({
      where: {
        id: ignoreId ? { not: ignoreId } : undefined,
        agentId,
        status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"] },
        startsAt: { gte: new Date(startsAt.getTime() - 3600000), lte: new Date(startsAt.getTime() + 3600000) },
      },
    });
    if (clash) throw new BadRequestException("That agent already has an appointment within the same hour. Pick another time so the booking does not clash.");
  }

  async createAppointment(user: AuthUser, dto: CreateAppointmentDto) {
    const property = dto.propertyId ? await this.prisma.property.findUnique({ where: { id: dto.propertyId } }) : null;
    let agencyId = this.access.agencyId(user, dto.agencyId);
    if (!agencyId) agencyId = property?.agencyId;
    if (!agencyId) throw new BadRequestException("Choose a property so the appointment stays with one agency.");
    const agentId = dto.agentId || property?.agentId || undefined;
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException("startsAt must be a valid datetime.");
    const status = dto.status || "REQUESTED";
    if (["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"].includes(status)) await this.assertNoClash(agentId, startsAt);
    const created = await this.prisma.appointment.create({
      data: { agencyId, kind: dto.kind as any, freeUserId: dto.freeUserId, propertyId: dto.propertyId, agentId, startsAt, timezone: dto.timezone, status: status as any, notes: dto.notes },
      include: { property: true, freeUser: true, agency: true, agent: true },
    });
    await this.access.audit(user, "APPOINTMENT_CREATED", "appointment", created.id, `${created.kind} booked at ${startsAt.toISOString()} (${dto.timezone}).`);
    return this.appointmentCard(created);
  }

  async updateAppointment(user: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) this.access.notFound("Appointment");
    this.access.agencyId(user, existing.agencyId);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const agentId = dto.agentId || existing.agentId;
    const status = dto.status || existing.status;
    if (["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"].includes(status)) await this.assertNoClash(agentId, startsAt, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: status as any, startsAt, agentId, notes: dto.notes },
      include: { property: true, freeUser: true, agency: true, agent: true },
    });
    await this.access.audit(user, "APPOINTMENT_UPDATED", "appointment", id, `${existing.status} -> ${status}. ${dto.reason || ""}`);
    return this.appointmentCard(updated);
  }

  async outcomes(user: AuthUser, query: PageQuery & { outcome?: string; agencyId?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, outcome: query.outcome || undefined };
    if (query.from || query.to) where.statusDate = { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined };
    const [total, rows, sold, letCount, withdrawn] = await Promise.all([
      this.prisma.outcomeReport.count({ where }),
      this.prisma.outcomeReport.findMany({ where, skip, take, orderBy: { statusDate: "desc" }, include: { property: true, agency: true } }),
      this.prisma.outcomeReport.count({ where: { ...where, outcome: "SOLD" } }),
      this.prisma.outcomeReport.count({ where: { ...where, outcome: "LET" } }),
      this.prisma.outcomeReport.count({ where: { ...where, outcome: "WITHDRAWN" } }),
    ]);
    const days = rows.map((row) => row.advertisedDays).sort((a, b) => a - b);
    return {
      ...result(rows.map((row) => ({
        id: row.id, outcome: row.outcome, statusDate: row.statusDate, advertisedDays: row.advertisedDays,
        leadAttributedToPlaceIn: row.leadAttributedToPlaceIn, note: row.note, correctedFrom: row.correctedFrom,
        property: { id: row.property.id, title: row.property.title, reference: row.property.reference },
        agency: { id: row.agency.id, name: row.agency.name },
      })), total, page, pageSize),
      summary: { sold, let: letCount, withdrawn, medianDaysAdvertised: days.length ? days[Math.floor(days.length / 2)] : 0 },
      notice: "These are agency-reported outcomes, not verified transactions and not commission records.",
    };
  }

  async correctOutcome(user: AuthUser, id: string, dto: CorrectOutcomeDto) {
    const row = await this.prisma.outcomeReport.findUnique({ where: { id }, include: { property: true } });
    if (!row) this.access.notFound("Outcome");
    this.access.agencyId(user, row.agencyId);
    const updated = await this.prisma.outcomeReport.update({
      where: { id },
      data: { correctedFrom: row.outcome, outcome: dto.outcome as any, leadAttributedToPlaceIn: dto.leadAttributedToPlaceIn, note: dto.reason },
    });
    await this.prisma.property.update({ where: { id: row.propertyId }, data: { status: dto.outcome as any } });
    await this.prisma.propertyStatusEvent.create({
      data: { propertyId: row.propertyId, fromStatus: row.outcome, toStatus: dto.outcome, actorName: user.name, reason: dto.reason },
    });
    await this.access.audit(user, "OUTCOME_CORRECTED", "outcome", id, `${row.property.reference} corrected from ${row.outcome} to ${dto.outcome}. ${dto.reason}`);
    return updated;
  }
}
