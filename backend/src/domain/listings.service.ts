import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "./access.service";
import { AuthUser } from "../common/decorators";
import { contains, paging, result } from "../common/paging";
import { CreateProjectDto, CreatePropertyDto, CreateReelDto, PageQuery, PhotoDto, PropertyStatusDto, PublicationDto, UpdatePropertyDto } from "./dto";

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService, private access: AccessService) {}

  private async scorePhotos(photos: PhotoDto[]) {
    const settings = await this.access.settings();
    return photos.map((photo) => ({
      ...photo,
      quality: photo.width >= settings.mediaMinWidth && photo.height >= settings.mediaMinHeight ? "READY" : "TOO_SMALL",
    }));
  }

  private qualityOf(photos: { quality: string }[]) {
    if (!photos.length) return "PENDING";
    return photos.some((photo) => photo.quality === "TOO_SMALL") ? "FAIL" : "PASS";
  }

  async properties(user: AuthUser, query: PageQuery & { status?: string; publication?: string; listingType?: string; agencyId?: string; agentId?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = {
      agencyId, status: query.status || undefined, publication: query.publication || undefined, listingType: query.listingType || undefined, agentId: query.agentId || undefined,
    };
    if (query.country && query.country !== "All countries") {
      where.OR = [{ countryName: { equals: query.country, mode: "insensitive" } }, { countryName: { contains: query.country, mode: "insensitive" } }];
    }
    if (query.q) {
      const search = [{ title: contains(query.q) }, { reference: contains(query.q) }, { city: contains(query.q) }, { area: contains(query.q) }];
      where.AND = [{ OR: search }];
    }
    const [total, rows] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where, skip, take, orderBy: { updatedAt: "desc" },
        include: { agency: true, agent: true, project: true },
      }),
    ]);
    return result(rows.map((row) => this.card(row)), total, page, pageSize);
  }

  card(row: any) {
    return {
      id: row.id, reference: row.reference, title: row.title, listingType: row.listingType, propertyType: row.propertyType,
      price: row.price, currency: row.currency, beds: row.beds, baths: row.baths, sizeSqft: row.sizeSqft,
      city: row.city, area: row.area, countryName: row.countryName, publication: row.publication, status: row.status,
      mediaQuality: row.mediaQuality, coverUrl: row.coverUrl, views: row.views, uniqueViewers: row.uniqueViewers, saves: row.saves,
      uploadedAt: row.uploadedAt, agency: row.agency ? { id: row.agency.id, name: row.agency.name } : undefined,
      agent: row.agent ? { id: row.agent.id, name: row.agent.name } : null,
      project: row.project ? { id: row.project.id, name: row.project.name } : null,
    };
  }

  async property(user: AuthUser, id: string) {
    const row = await this.prisma.property.findUnique({
      where: { id },
      include: {
        agency: { include: { country: true } }, agent: true, project: true, photos: true,
        events: { orderBy: { createdAt: "desc" } },
        enquiries: { orderBy: { createdAt: "desc" }, take: 20, include: { freeUser: true } },
        offers: { orderBy: { createdAt: "desc" }, include: { freeUser: true } },
        appointments: { orderBy: { startsAt: "desc" }, take: 20, include: { freeUser: true, agent: true } },
        reels: true, outcomes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) this.access.notFound("Property");
    this.access.agencyId(user, row.agencyId);
    return {
      ...row,
      agent: row.agent ? { id: row.agent.id, name: row.agent.name, email: row.agent.email } : null,
      enquiries: row.enquiries.map((item) => ({ ...item, freeUser: { id: item.freeUser.id, name: item.freeUser.name } })),
      note: "Publication and commercial status are separate. A listing can be unpublished while the property is still available.",
    };
  }

  async createProperty(user: AuthUser, dto: CreatePropertyDto) {
    await this.access.assertCanEditListings(user);
    const agencyId = this.access.agencyId(user, dto.agencyId);
    if (!agencyId) throw new BadRequestException("Choose the agency that owns this listing.");
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    const used = await this.prisma.property.count({ where: { agencyId, publication: { notIn: ["TAKEN_DOWN", "REJECTED"] } } });
    if (used >= agency.listingAllowance) throw new BadRequestException(`Listing allowance of ${agency.listingAllowance} is already used.`);
    const count = await this.prisma.property.count();
    const photos = await this.scorePhotos(dto.photos || []);
    const cover = photos.find((photo) => photo.isCover) || photos[0];
    const created = await this.prisma.property.create({
      data: {
        reference: `PR${String(count + 1).padStart(4, "0")}`,
        agencyId, projectId: dto.projectId, agentId: dto.agentId || (user.kind === "agency" ? user.sub : undefined),
        title: dto.title, listingType: dto.listingType as any, propertyType: dto.propertyType, price: dto.price, currency: dto.currency,
        beds: dto.beds, baths: dto.baths, sizeSqft: dto.sizeSqft, description: dto.description,
        countryName: dto.countryName || "", city: dto.city || "", area: dto.area || "", postcode: dto.postcode || "", addressPrivate: dto.addressPrivate || "",
        publication: "DRAFT", status: "AVAILABLE", mediaQuality: this.qualityOf(photos), coverUrl: cover?.url,
        photos: { create: photos },
        events: { create: { toStatus: "AVAILABLE", publication: "DRAFT", actorName: user.name, reason: "Draft created" } },
      },
    });
    await this.access.audit(user, "PROPERTY_CREATED", "property", created.id, `${created.reference} saved as a draft.`);
    return this.property(user, created.id);
  }

  async updateProperty(user: AuthUser, id: string, dto: UpdatePropertyDto) {
    await this.access.assertCanEditListings(user);
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) this.access.notFound("Property");
    this.access.agencyId(user, existing.agencyId);
    await this.prisma.property.update({ where: { id }, data: dto as any });
    await this.access.audit(user, "PROPERTY_UPDATED", "property", id, `${existing.reference} details updated.`);
    return this.property(user, id);
  }

  async addPhotos(user: AuthUser, id: string, photos: PhotoDto[]) {
    await this.access.assertCanEditListings(user);
    const existing = await this.prisma.property.findUnique({ where: { id }, include: { photos: true } });
    if (!existing) this.access.notFound("Property");
    this.access.agencyId(user, existing.agencyId);
    const scored = await this.scorePhotos(photos);
    await this.prisma.propertyPhoto.createMany({ data: scored.map((photo) => ({ ...photo, propertyId: id, isCover: Boolean(photo.isCover) })) });
    const all = [...existing.photos, ...scored];
    const cover = scored.find((photo) => photo.isCover) || existing.coverUrl;
    await this.prisma.property.update({
      where: { id },
      data: { mediaQuality: this.qualityOf(all), coverUrl: typeof cover === "string" ? cover : cover?.url || existing.coverUrl },
    });
    return this.property(user, id);
  }

  async submitProperty(user: AuthUser, id: string) {
    await this.access.assertCanEditListings(user);
    const row = await this.prisma.property.findUnique({ where: { id }, include: { photos: true, agency: true, agent: true } });
    if (!row) this.access.notFound("Property");
    this.access.agencyId(user, row.agencyId);
    if (!row.city || !row.countryName || !row.area) throw new BadRequestException("Add the country, city and area before submitting.");
    if (!row.photos.length) throw new BadRequestException("Add at least one photo before submitting.");
    if (row.agency.enforceImageQuality && row.mediaQuality === "FAIL") {
      await this.prisma.moderationItem.create({
        data: { queue: "QUALITY_FAILURE", priority: "High", subject: row.title, reason: "Photo is below the minimum resolution", entityType: "property", entityId: row.id, agencyId: row.agencyId },
      });
      throw new BadRequestException("A photo is below the minimum resolution. Replace it before publication. This is a hard technical failure.");
    }
    await this.access.publishingAllowed(row.agencyId);
    const needsApproval = row.agency.requireApproval || row.agent?.publishRequiresApproval;
    const publication = needsApproval ? "PENDING_REVIEW" : "LIVE";
    await this.prisma.property.update({ where: { id }, data: { publication: publication as any } });
    await this.prisma.propertyStatusEvent.create({ data: { propertyId: id, publication, actorName: user.name, reason: needsApproval ? "Submitted for approval" : "Published" } });
    if (needsApproval) {
      await this.prisma.moderationItem.create({
        data: { queue: "CONTENT_REVIEW", priority: "Normal", subject: row.title, reason: "New listing submitted", entityType: "property", entityId: row.id, agencyId: row.agencyId },
      });
    }
    await this.access.audit(user, "PROPERTY_SUBMITTED", "property", id, `${row.reference} is ${publication}.`);
    return this.property(user, id);
  }

  async setStatus(user: AuthUser, id: string, dto: PropertyStatusDto) {
    await this.access.assertCanEditListings(user);
    const row = await this.prisma.property.findUnique({ where: { id } });
    if (!row) this.access.notFound("Property");
    this.access.agencyId(user, row.agencyId);
    await this.prisma.property.update({ where: { id }, data: { status: dto.status as any } });
    await this.prisma.propertyStatusEvent.create({
      data: { propertyId: id, fromStatus: row.status, toStatus: dto.status, actorName: user.name, reason: dto.reason },
    });
    if (["SOLD", "LET", "WITHDRAWN"].includes(dto.status)) {
      const advertisedDays = Math.max(1, Math.round((Date.now() - row.uploadedAt.getTime()) / 86400000));
      await this.prisma.outcomeReport.create({
        data: {
          propertyId: id, agencyId: row.agencyId, outcome: dto.status as any, statusDate: new Date(), advertisedDays,
          leadAttributedToPlaceIn: dto.leadAttributedToPlaceIn, note: dto.reason,
        },
      });
    }
    await this.access.audit(user, "PROPERTY_STATUS", "property", id, `${row.reference} marked ${dto.status}. ${dto.reason}`);
    return this.property(user, id);
  }

  async setPublication(user: AuthUser, id: string, dto: PublicationDto) {
    if (user.kind === "staff") this.access.assertNotMaintenance(user);
    const row = await this.prisma.property.findUnique({ where: { id } });
    if (!row) this.access.notFound("Property");
    this.access.agencyId(user, row.agencyId);
    if (["LIVE"].includes(dto.publication)) await this.access.publishingAllowed(row.agencyId);
    if (dto.publication === "LIVE" && row.mediaQuality === "FAIL") {
      throw new BadRequestException("Resolve the photo quality failure before publishing.");
    }
    await this.prisma.property.update({ where: { id }, data: { publication: dto.publication as any } });
    await this.prisma.propertyStatusEvent.create({ data: { propertyId: id, publication: dto.publication, actorName: user.name, reason: dto.reason } });
    await this.access.audit(user, "PROPERTY_PUBLICATION", "property", id, `${row.reference} publication set to ${dto.publication}. ${dto.reason}`);
    return this.property(user, id);
  }

  async projects(user: AuthUser, query: PageQuery & { agencyId?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId };
    if (query.q) where.OR = [{ name: contains(query.q) }, { city: contains(query.q) }, { area: contains(query.q) }];
    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { agency: true, _count: { select: { properties: true, agents: true } } } }),
    ]);
    return result(rows.map((row) => ({ ...row, listings: row._count.properties, assignedAgents: row._count.agents })), total, page, pageSize);
  }

  async project(user: AuthUser, id: string) {
    const row = await this.prisma.project.findUnique({
      where: { id },
      include: { agency: true, properties: { include: { agent: true } }, agents: { include: { agent: true } } },
    });
    if (!row) this.access.notFound("Project");
    this.access.agencyId(user, row.agencyId);
    return { ...row, agents: row.agents.map((link) => ({ id: link.agent.id, name: link.agent.name, role: link.agent.role, email: link.agent.email })) };
  }

  async createProject(user: AuthUser, dto: CreateProjectDto) {
    const agencyId = this.access.agencyId(user, dto.agencyId);
    if (!agencyId) throw new BadRequestException("Choose an agency.");
    await this.access.assertCanManageAgency(user, agencyId);
    const created = await this.prisma.project.create({
      data: {
        agencyId, name: dto.name, city: dto.city, area: dto.area, description: dto.description,
        completion: dto.completion, units: dto.units || 0, propertyTypes: dto.propertyTypes || 1, imageUrl: dto.imageUrl, status: "ACTIVE",
      },
    });
    if (dto.agentIds?.length) {
      await this.prisma.projectAgent.createMany({ data: dto.agentIds.map((agentId) => ({ projectId: created.id, agentId })), skipDuplicates: true });
    }
    await this.access.audit(user, "PROJECT_CREATED", "project", created.id, `${created.name} created.`);
    return this.project(user, created.id);
  }

  async reels(user: AuthUser, query: PageQuery & { agencyId?: string; publication?: string; kind?: string }) {
    const agencyId = this.access.agencyId(user, query.agencyId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: any = { agencyId, publication: query.publication || undefined, kind: query.kind || undefined };
    if (query.q) where.caption = contains(query.q);
    const [total, rows] = await Promise.all([
      this.prisma.reel.count({ where }),
      this.prisma.reel.findMany({ where, skip, take, orderBy: { uploadedAt: "desc" }, include: { agency: true, agent: true, property: true, _count: { select: { enquiries: true } } } }),
    ]);
    return result(rows.map((row) => ({
      ...row, enquiryCount: row._count.enquiries,
      agency: { id: row.agency.id, name: row.agency.name },
      agent: row.agent ? { id: row.agent.id, name: row.agent.name } : null,
      property: row.property ? { id: row.property.id, title: row.property.title } : null,
    })), total, page, pageSize);
  }

  async createReel(user: AuthUser, dto: CreateReelDto) {
    if (user.kind === "agency") {
      const actor = await this.access.requireAgencyUser(user);
      if (actor.role === "AGENT" && !actor.canUploadReels) throw new BadRequestException("Your account cannot upload reels.");
    } else this.access.assertNotMaintenance(user);
    const agencyId = this.access.agencyId(user, dto.agencyId);
    if (!agencyId) throw new BadRequestException("Choose an agency.");
    const created = await this.prisma.reel.create({
      data: {
        agencyId, propertyId: dto.propertyId, agentId: dto.agentId || (user.kind === "agency" ? user.sub : undefined),
        kind: dto.kind as any, caption: dto.caption, coverUrl: dto.coverUrl, videoUrl: dto.videoUrl,
        processing: dto.videoUrl ? "READY" : "QUEUED", publication: "DRAFT", quality: "PASS",
      },
    });
    await this.access.audit(user, "REEL_CREATED", "reel", created.id, "Reel draft saved. Editing stays in the mobile app; this portal records the upload.");
    return created;
  }

  async submitReel(user: AuthUser, id: string) {
    const row = await this.prisma.reel.findUnique({ where: { id }, include: { agency: true } });
    if (!row) this.access.notFound("Reel");
    this.access.agencyId(user, row.agencyId);
    if (row.processing === "FAILED" || row.quality === "FAIL") {
      throw new BadRequestException("Resolve the processing or quality failure before submitting this reel.");
    }
    await this.access.publishingAllowed(row.agencyId);
    const publication = row.agency.requireApproval ? "PENDING_REVIEW" : "LIVE";
    const updated = await this.prisma.reel.update({ where: { id }, data: { publication: publication as any, processing: "READY" } });
    if (row.agency.requireApproval) {
      await this.prisma.moderationItem.create({
        data: { queue: "CONTENT_REVIEW", priority: "Normal", subject: row.caption.slice(0, 80), reason: "Reel submitted", entityType: "reel", entityId: row.id, agencyId: row.agencyId },
      });
    }
    await this.access.audit(user, "REEL_SUBMITTED", "reel", id, `Reel set to ${publication}.`);
    return updated;
  }
}
