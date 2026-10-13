import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators";

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  assertStaff(user: AuthUser) {
    if (user.kind !== "staff") throw new ForbiddenException("This section is only available to head-office staff.");
  }

  assertNotMaintenance(user: AuthUser) {
    if (user.role === "MAINTENANCE") {
      throw new ForbiddenException("Maintenance staff can work on platform health and technical tickets, not account or billing changes.");
    }
  }

  async audit(user: AuthUser | null, action: string, entityType: string, entityId: string | null, detail: string) {
    await this.prisma.auditLog.create({
      data: {
        actorId: user?.kind === "staff" ? user.sub : null,
        actorName: user?.name || "System",
        actorRole: user?.role || "SYSTEM",
        action,
        entityType,
        entityId,
        detail,
      },
    });
  }

  agencyId(user: AuthUser, requested?: string) {
    if (user.kind === "agency") {
      if (requested && requested !== user.agencyId) {
        throw new ForbiddenException("An agency account cannot open another agency's records.");
      }
      return user.agencyId;
    }
    return requested || undefined;
  }

  async requireAgencyUser(user: AuthUser) {
    if (user.kind !== "agency") return null;
    const row = await this.prisma.agencyUser.findUnique({ where: { id: user.sub } });
    if (!row || row.status === "DEACTIVATED" || row.status === "SUSPENDED") {
      throw new ForbiddenException("This agency account is not active.");
    }
    return row;
  }

  async assertCanEditListings(user: AuthUser) {
    if (user.kind === "staff") {
      this.assertNotMaintenance(user);
      return;
    }
    const actor = await this.requireAgencyUser(user);
    if (actor.role === "AGENT" && !actor.canCreateListings) {
      throw new ForbiddenException("Your account does not have permission to create or edit listings.");
    }
  }

  async assertCanManageAgency(user: AuthUser, agencyId: string) {
    if (user.kind === "staff") {
      this.assertNotMaintenance(user);
      return;
    }
    if (user.agencyId !== agencyId) throw new ForbiddenException("An agency account cannot manage another agency.");
    const actor = await this.requireAgencyUser(user);
    if (actor.role === "AGENT") throw new ForbiddenException("Only an owner or manager can change agency settings and invitations.");
  }

  async publishingAllowed(agencyId: string) {
    const [agency, overdue] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { agencyId } }),
      this.prisma.invoice.count({ where: { agencyId, status: "OVERDUE" } }),
    ]);
    if (!agency) return;
    if (["PAST_DUE", "EXPIRED", "CANCELLED"].includes(agency.status) || overdue > 0) {
      throw new ForbiddenException("New publication is blocked until the agency subscription is current. Existing live listings stay published. PlaceIn does not take a commission on a sale or let.");
    }
  }

  async settings() {
    const row = await this.prisma.platformSetting.findUnique({ where: { id: "default" } });
    if (!row) throw new NotFoundException("Platform settings have not been seeded.");
    return row;
  }

  rates() {
    return { GBP: 1, MYR: 5.6, EUR: 1.17, AED: 4.7, JPY: 190, USD: 1.27 };
  }

  toGbp(amount: number, currency: string, rates: Record<string, number>) {
    const rate = rates[currency] || 1;
    return Math.round((amount / rate) * 100) / 100;
  }

  notFound(entity: string): never {
    throw new NotFoundException(`${entity} was not found.`);
  }

  bad(message: string): never {
    throw new BadRequestException(message);
  }
}
