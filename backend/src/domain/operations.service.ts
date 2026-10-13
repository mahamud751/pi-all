import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "./access.service";
import { AuthUser } from "../common/decorators";
import { paging, result } from "../common/paging";
import { CreateTicketDto, DecisionDto, InvoiceAdjustDto, PageQuery, PaymentAttemptDto, PlanChangeDto, TicketMessageDto, UpdateTicketDto } from "./dto";

const FEES = { STARTER: 99, GROWTH: 249, PROFESSIONAL: 499, ENTERPRISE: 899 };
const LIMITS = {
  STARTER: { agentAllowance: 5, listingAllowance: 50 },
  GROWTH: { agentAllowance: 15, listingAllowance: 200 },
  PROFESSIONAL: { agentAllowance: 40, listingAllowance: 800 },
  ENTERPRISE: { agentAllowance: 100, listingAllowance: 5000 },
};

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  async moderation(user: AuthUser, query: PageQuery & { queue?: string; decision?: string }) {
    const agencyId = user.kind === "agency" ? user.agencyId : undefined;
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, queue: query.queue || undefined, decision: query.decision || "PENDING" };
    const [total, rows, counts] = await Promise.all([
      this.prisma.moderationItem.count({ where }),
      this.prisma.moderationItem.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { agency: true, reviewer: true } }),
      this.prisma.moderationItem.groupBy({ by: ["queue"], where: { decision: "PENDING", agencyId }, _count: true }),
    ]);
    return {
      ...result(rows.map((row) => ({
        ...row, agency: row.agency ? { id: row.agency.id, name: row.agency.name } : null,
        reviewer: row.reviewer ? { id: row.reviewer.id, name: row.reviewer.name } : null,
      })), total, page, pageSize),
      queues: counts.map((row) => ({ queue: row.queue, count: row._count })),
    };
  }

  async decide(user: AuthUser, id: string, dto: DecisionDto) {
    if (user.kind === "staff") this.access.assertNotMaintenance(user);
    const item = await this.prisma.moderationItem.findUnique({ where: { id } });
    if (!item) this.access.notFound("Moderation item");
    if (user.kind === "agency" && item.agencyId !== user.agencyId) {
      throw new ForbiddenException("An agency can only decide items in its own queue.");
    }
    if (dto.decision === "APPROVED" && item.entityType === "property" && item.entityId) {
      const property = await this.prisma.property.findUnique({ where: { id: item.entityId } });
      if (property?.mediaQuality === "FAIL") {
        throw new BadRequestException("Hard technical failures must be resolved before publication.");
      }
      if (property) await this.access.publishingAllowed(property.agencyId);
    }
    const history = Array.isArray(item.history) ? item.history : [];
    history.push({ at: new Date().toISOString(), actor: user.name, decision: dto.decision, reason: dto.reason });
    const updated = await this.prisma.moderationItem.update({
      where: { id },
      data: { decision: dto.decision as any, decisionReason: dto.reason, reviewerId: user.kind === "staff" ? user.sub : null, decidedAt: new Date(), history },
    });
    const publication = dto.decision === "APPROVED" ? "LIVE" : dto.decision === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : dto.decision === "REJECTED" ? "REJECTED" : "TAKEN_DOWN";
    if (item.entityType === "property" && item.entityId) {
      await this.prisma.property.update({ where: { id: item.entityId }, data: { publication: publication as any } });
      await this.prisma.propertyStatusEvent.create({ data: { propertyId: item.entityId, publication, actorName: user.name, reason: dto.reason } });
    }
    if (item.entityType === "reel" && item.entityId) {
      await this.prisma.reel.update({ where: { id: item.entityId }, data: { publication: publication as any } });
    }
    if (item.entityType === "agency" && item.entityId && dto.decision === "APPROVED") {
      await this.prisma.agency.update({ where: { id: item.entityId }, data: { verification: "VERIFIED", status: "ACTIVE" } });
    }
    if (item.entityType === "agency" && item.entityId && dto.decision === "REJECTED") {
      await this.prisma.agency.update({ where: { id: item.entityId }, data: { verification: "REJECTED", status: "RESTRICTED" } });
    }
    await this.access.audit(user, "MODERATION_DECISION", item.entityType, item.entityId, `${item.subject}: ${dto.decision}. ${dto.reason}`);
    return updated;
  }

  async subscriptions(user: AuthUser, query: PageQuery & { status?: string }) {
    this.access.assertStaff(user);
    const finance = user.financeAccess;
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { status: query.status || undefined, agency: query.country ? { country: { OR: [{ code: query.country }, { name: query.country }] } } : undefined };
    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({ where, skip, take, include: { agency: { include: { country: true } }, changes: { take: 3, orderBy: { createdAt: "desc" } } }, orderBy: { renewsAt: "asc" } }),
    ]);
    const trialsEnding = await this.prisma.subscription.count({ where: { status: "TRIAL", trialEndsAt: { lte: new Date(Date.now() + 7 * 86400000) } } });
    return {
      ...result(rows.map((row) => ({
        id: row.id, plan: row.plan, status: row.status, renewsAt: row.renewsAt, trialEndsAt: row.trialEndsAt, cancelledAt: row.cancelledAt,
        monthlyFee: finance ? row.monthlyFee : undefined, currency: finance ? row.currency : undefined,
        agency: { id: row.agency.id, name: row.agency.name, country: row.agency.country.name, agentAllowance: row.agency.agentAllowance, listingAllowance: row.agency.listingAllowance },
        changes: finance ? row.changes : [],
      })), total, page, pageSize),
      trialsEnding,
      rules: {
        trial: "A trial lasts 14 days. At expiry without payment the subscription becomes PAST_DUE and new publication is blocked. Existing live listings stay up.",
        overdue: "An overdue invoice also blocks new publication. Free property seekers are never part of this billing system.",
        commission: "PlaceIn does not charge commission. Property transactions happen outside the platform.",
      },
      financeHidden: !finance,
    };
  }

  async changePlan(user: AuthUser, id: string, dto: PlanChangeDto) {
    this.access.assertStaff(user);
    if (!user.financeAccess) throw new ForbiddenException("Plan changes are limited to staff with finance access.");
    const row = await this.prisma.subscription.findUnique({ where: { id }, include: { agency: true } });
    if (!row) this.access.notFound("Subscription");
    const plan = dto.plan as keyof typeof FEES;
    await this.prisma.subscriptionChange.create({
      data: { subscriptionId: id, fromPlan: row.plan, toPlan: plan, effectiveOn: new Date(dto.effectiveOn), reason: dto.reason, actorName: user.name },
    });
    const updated = await this.prisma.subscription.update({ where: { id }, data: { plan: plan as any, monthlyFee: FEES[plan], status: row.status === "TRIAL" ? "TRIAL" : "ACTIVE" } });
    await this.prisma.agency.update({ where: { id: row.agencyId }, data: { plan: plan as any, ...LIMITS[plan] } });
    await this.access.audit(user, "PLAN_CHANGED", "subscription", id, `${row.agency.name}: ${row.plan} -> ${plan} effective ${dto.effectiveOn}. ${dto.reason}`);
    return updated;
  }

  async invoices(user: AuthUser, query: PageQuery & { status?: string; agencyId?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const allowed = user.financeAccess || (user.kind === "agency" && user.role === "OWNER");
    if (!allowed) throw new ForbiddenException("Invoices are limited to finance staff and the agency owner.");
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, status: query.status || undefined };
    const [total, rows] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({ where, skip, take, orderBy: { dueDate: "desc" }, include: { agency: true, attempts: true, events: { orderBy: { createdAt: "desc" }, take: 5 } } }),
    ]);
    const outstanding = rows.reduce((sum, row) => sum + Math.max(0, row.amount - row.amountPaid), 0);
    return { ...result(rows, total, page, pageSize), outstandingOnPage: outstanding };
  }

  async remind(user: AuthUser, id: string) {
    if (!user.financeAccess && user.role !== "OWNER") throw new ForbiddenException("Only finance staff can send payment reminders.");
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { agency: true } });
    if (!invoice) this.access.notFound("Invoice");
    await this.prisma.invoiceEvent.create({ data: { invoiceId: id, kind: "REMINDER", detail: `Reminder prepared for ${invoice.agency.email}`, actorName: user.name } });
    await this.access.audit(user, "INVOICE_REMINDER", "invoice", id, `Reminder for ${invoice.number}. Email delivery is local-only.`);
    return { reminded: true, number: invoice.number, channel: "local-only" };
  }

  async adjust(user: AuthUser, id: string, dto: InvoiceAdjustDto) {
    if (!user.financeAccess) throw new ForbiddenException("Invoice adjustments require finance access.");
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) this.access.notFound("Invoice");
    let status = invoice.status;
    if (invoice.amountPaid >= dto.amount && status !== "VOID" && status !== "REFUNDED") status = "PAID";
    else if (invoice.amountPaid > 0 && invoice.amountPaid < dto.amount) status = "PARTIALLY_PAID";
    const updated = await this.prisma.invoice.update({ where: { id }, data: { amount: dto.amount, status: status as any } });
    await this.prisma.invoiceEvent.create({ data: { invoiceId: id, kind: "ADJUSTMENT", detail: `${invoice.amount} -> ${dto.amount}. ${dto.reason}`, actorName: user.name } });
    await this.access.audit(user, "INVOICE_ADJUSTED", "invoice", id, dto.reason);
    return updated;
  }

  async payment(user: AuthUser, id: string, dto: PaymentAttemptDto) {
    if (!user.financeAccess) throw new ForbiddenException("Payment records require finance access.");
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) this.access.notFound("Invoice");
    await this.prisma.paymentAttempt.create({ data: { invoiceId: id, providerRef: dto.providerRef, status: dto.status, amount: dto.amount, failureReason: dto.failureReason } });
    let amountPaid = invoice.amountPaid;
    let status = invoice.status;
    if (dto.status === "SUCCESS") {
      amountPaid = Math.round((invoice.amountPaid + dto.amount) * 100) / 100;
      status = amountPaid >= invoice.amount ? "PAID" : "PARTIALLY_PAID";
      if (status === "PAID") await this.prisma.subscription.updateMany({ where: { agencyId: invoice.agencyId, status: { in: ["PAST_DUE", "TRIAL"] } }, data: { status: "ACTIVE" } });
    } else if (invoice.dueDate < new Date() && invoice.status !== "PAID") status = "OVERDUE";
    const updated = await this.prisma.invoice.update({ where: { id }, data: { amountPaid, status: status as any } });
    await this.prisma.invoiceEvent.create({ data: { invoiceId: id, kind: "PAYMENT", detail: `${dto.status} ${dto.providerRef} ${dto.amount}. ${dto.failureReason || ""}`, actorName: user.name } });
    await this.access.audit(user, "PAYMENT_RECORDED", "invoice", id, `${dto.status} via ${dto.providerRef}. Status is taken from the payment record.`);
    return updated;
  }

  async tickets(user: AuthUser, query: PageQuery & { status?: string; priority?: string; category?: string }) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { status: query.status || undefined, priority: query.priority || undefined, category: query.category || undefined };
    if (user.kind === "agency") where.agencyId = user.agencyId;
    if (user.role === "MAINTENANCE") where.category = "Technical";
    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({ where, skip, take, orderBy: { updatedAt: "desc" }, include: { agency: true, freeUser: true, assignee: true } }),
    ]);
    return result(rows.map((row) => ({
      id: row.id, number: row.number, requesterType: row.requesterType, category: row.category, priority: row.priority, status: row.status, subject: row.subject, updatedAt: row.updatedAt,
      agency: row.agency ? { id: row.agency.id, name: row.agency.name } : null,
      user: row.freeUser ? { id: row.freeUser.id, name: row.freeUser.name } : null,
      assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    })), total, page, pageSize);
  }

  async ticket(user: AuthUser, id: string) {
    const row = await this.prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "asc" } }, agency: true, freeUser: true, assignee: true } });
    if (!row) this.access.notFound("Ticket");
    if (user.kind === "agency" && row.agencyId !== user.agencyId) throw new ForbiddenException("That ticket belongs to another agency.");
    return { ...row, notes: user.kind === "staff" ? row.notes : [], internalNotesHidden: user.kind !== "staff" };
  }

  async createTicket(user: AuthUser, dto: CreateTicketDto) {
    const count = await this.prisma.supportTicket.count();
    let assigneeId: string | undefined;
    if (dto.category === "Technical") {
      const tech = await this.prisma.staffUser.findFirst({ where: { role: "MAINTENANCE", active: true } });
      assigneeId = tech?.id;
    }
    const agencyId = dto.requesterType === "AGENCY" ? (user.kind === "agency" ? user.agencyId : dto.agencyId) : undefined;
    const ticket = await this.prisma.supportTicket.create({
      data: {
        number: `SUP${1000 + count + 1}`, requesterType: dto.requesterType, agencyId, freeUserId: dto.freeUserId,
        category: dto.category, priority: dto.priority as any, subject: dto.subject, assigneeId, status: "OPEN",
        messages: { create: { authorName: user.name, body: dto.body } },
      },
    });
    await this.access.audit(user, "TICKET_OPENED", "ticket", ticket.id, `${ticket.number} ${dto.category}.`);
    return ticket;
  }

  async addMessage(user: AuthUser, id: string, dto: TicketMessageDto) {
    const ticket = await this.ticket(user, id);
    if (user.kind === "agency" && ticket.agencyId !== user.agencyId) throw new ForbiddenException("That ticket belongs to another agency.");
    const message = await this.prisma.ticketMessage.create({ data: { ticketId: id, authorName: user.name, body: dto.body } });
    await this.prisma.supportTicket.update({ where: { id }, data: { status: "AWAITING_CUSTOMER" } });
    return message;
  }

  async addNote(user: AuthUser, id: string, dto: TicketMessageDto) {
    this.access.assertStaff(user);
    const note = await this.prisma.ticketNote.create({ data: { ticketId: id, authorId: user.sub, authorName: user.name, body: dto.body } });
    await this.access.audit(user, "TICKET_NOTE", "ticket", id, "Internal note added. It is not sent to the customer.");
    return { ...note, visibility: "internal" };
  }

  async updateTicket(user: AuthUser, id: string, dto: UpdateTicketDto) {
    this.access.assertStaff(user);
    return this.prisma.supportTicket.update({ where: { id }, data: dto as any });
  }
}
