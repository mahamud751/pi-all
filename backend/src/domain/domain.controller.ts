import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from "@nestjs/swagger";
import { diskStorage } from "multer";
import { extname } from "path";
import type { Response } from "express";
import { ApiProtected, AuthUser, CurrentUser, Finance, Public, Roles } from "../common/decorators";
import { DirectoryService } from "./directory.service";
import { ListingsService } from "./listings.service";
import { ActivityService } from "./activity.service";
import { OperationsService } from "./operations.service";
import { PlatformService } from "./platform.service";
import { AnnouncementDto, AgencyStatusDto, CorrectOutcomeDto, CountryDto, CreateAgencyDto, CreateAppointmentDto, CreateProjectDto, CreatePropertyDto, CreateReelDto, CreateStaffDto, CreateTicketDto, DecisionDto, IncidentDto, InviteAgentDto, InvoiceAdjustDto, PageQuery, PaymentAttemptDto, PhotosDto, PlanChangeDto, PropertyStatusDto, PublicationDto, ReassignDto, TemplateDto, TicketMessageDto, UpdateAgencyDto, UpdateAgentDto, UpdateAppointmentDto, UpdateEnquiryDto, UpdateIncidentDto, UpdateOfferDto, UpdatePropertyDto, UpdateSettingsDto, UpdateStaffDto, UpdateTicketDto, UserActionDto } from "./dto";

@ApiTags("Live")
@Controller()
export class LiveController {
  @Public() @Get("live")
  @ApiProtected("Process liveness")
  live() { return { ok: true, service: "placein-admin-api" }; }
}

@ApiTags("Dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private platform: PlatformService) {}
  @Get("office") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Head-office dashboard", "Paying agencies and free property seekers are summarised separately. Revenue is omitted unless the caller has finance access.")
  office(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.platform.dashboardOffice(user, query); }
  @Get("agency")
  @ApiProtected("Agency dashboard", "Scoped to the signed-in agency. Staff should use the office dashboard.")
  agency(@CurrentUser() user: AuthUser) { return this.platform.dashboardAgency(user); }
}

@ApiTags("Agencies")
@Controller("agencies")
export class AgenciesController {
  constructor(private directory: DirectoryService) {}
  @Get() @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Search agencies", "Filter by name, country, verification, account status, plan and payment status.")
  @ApiQuery({ name: "status", required: false }) @ApiQuery({ name: "plan", required: false }) @ApiQuery({ name: "verification", required: false }) @ApiQuery({ name: "payment", required: false })
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.directory.agencies(user, query as any); }
  @Post() @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Create an agency application", "Opens a trial subscription and an agency-verification queue item.")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAgencyDto) { return this.directory.createAgency(user, dto); }
  @Get(":id") @ApiProtected("Agency profile", "Tabs of data for overview, team, projects, listings, media, leads, appointments, outcomes, subscription and invoices. Finance tabs follow permissions.")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.directory.agency(user, id); }
  @Patch(":id") @ApiProtected("Update agency profile or notification rules")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAgencyDto) { return this.directory.updateAgency(user, id, dto); }
  @Post(":id/status") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Change agency account status", "A reason is required and written to the audit log.")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AgencyStatusDto) { return this.directory.setAgencyStatus(user, id, dto); }
  @Post(":id/invites") @ApiProtected("Invite an agent into this agency", "Returns the invitation token because local email is not connected.")
  invite(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: InviteAgentDto) { return this.directory.invite(user, dto, id); }
}

@ApiTags("Agents")
@Controller("agents")
export class AgentsController {
  constructor(private directory: DirectoryService) {}
  @Get() @ApiProtected("Agent directory", "Each agent remains scoped to one agency membership.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.directory.agents(user, query as any); }
  @Get(":id") @ApiProtected("Agent profile", "Permissions, projects, listings, enquiries, appointments and response time. The password hash is never returned.")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.directory.agent(user, id); }
  @Patch(":id") @ApiProtected("Update agent permissions or profile")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAgentDto) { return this.directory.updateAgent(user, id, dto); }
  @Post(":id/reassign") @ApiProtected("Move open work when an agent leaves", "Properties, open enquiries, future appointments and project memberships move to another agent in the same agency.")
  reassign(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReassignDto) { return this.directory.reassign(user, id, dto); }
}

@ApiTags("Properties")
@Controller("properties")
export class PropertiesController {
  constructor(private listings: ListingsService) {}
  @Get() @ApiProtected("Property directory", "Search by reference, location, agency and agent. Publication state is separate from sold, let, withdrawn or expired.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.listings.properties(user, query as any); }
  @Post() @ApiProtected("Create a draft listing")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) { return this.listings.createProperty(user, dto); }
  @Get(":id") @ApiProtected("Property details and activity", "Views, saves, enquiries, offers, appointments, media quality and the status history.")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.listings.property(user, id); }
  @Patch(":id") @ApiProtected("Update listing details or location")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePropertyDto) { return this.listings.updateProperty(user, id, dto); }
  @Post(":id/photos") @ApiProtected("Attach photos and score them against the minimum resolution")
  photos(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: PhotosDto) { return this.listings.addPhotos(user, id, body.photos || []); }
  @Post(":id/submit") @ApiProtected("Submit a listing", "Quality failures block publication. Approval rules decide whether it goes live or into review.")
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.listings.submitProperty(user, id); }
  @Post(":id/status") @ApiProtected("Record a reported property outcome", "Sold, let and withdrawn write an outcome report. This is not a verified transaction.")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PropertyStatusDto) { return this.listings.setStatus(user, id, dto); }
  @Post(":id/publication") @ApiProtected("Change publication without changing the commercial status")
  publication(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PublicationDto) { return this.listings.setPublication(user, id, dto); }
}

@ApiTags("Projects")
@Controller("projects")
export class ProjectsController {
  constructor(private listings: ListingsService) {}
  @Get() @ApiProtected("Project directory")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.listings.projects(user, query as any); }
  @Post() @ApiProtected("Create a project")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) { return this.listings.createProject(user, dto); }
  @Get(":id") @ApiProtected("Project workspace")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.listings.project(user, id); }
}

@ApiTags("Reels")
@Controller("reels")
export class ReelsController {
  constructor(private listings: ListingsService) {}
  @Get() @ApiProtected("Reels and walkthroughs", "Shows processing, quality, publication and audience counts. Reel editing stays in the mobile app.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.listings.reels(user, query as any); }
  @Post() @ApiProtected("Save a reel draft")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReelDto) { return this.listings.createReel(user, dto); }
  @Post(":id/submit") @ApiProtected("Submit a reel for approval or publish it")
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.listings.submitReel(user, id); }
}

@ApiTags("Enquiries")
@Controller("enquiries")
export class EnquiriesController {
  constructor(private activity: ActivityService) {}
  @Get() @ApiProtected("Enquiries and connections", "Tracks source, channel, response time and follow-up. Private message text is not included.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.activity.enquiries(user, query as any); }
  @Patch(":id") @ApiProtected("Assign or answer an enquiry")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateEnquiryDto) { return this.activity.updateEnquiry(user, id, dto); }
}

@ApiTags("Offers")
@Controller("offers")
export class OffersController {
  constructor(private activity: ActivityService) {}
  @Get() @ApiProtected("Buyer offers", "Statuses are submitted, acknowledged, accepted, declined or withdrawn. Acceptance does not sell the property.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.activity.offers(user, query as any); }
  @Patch(":id") @ApiProtected("Record the agency response to an offer")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateOfferDto) { return this.activity.updateOffer(user, id, dto); }
}

@ApiTags("Appointments")
@Controller("appointments")
export class AppointmentsController {
  constructor(private activity: ActivityService) {}
  @Get() @ApiProtected("Appointments", "Viewings, video calls and office visits with timezone and status. Confirmed bookings cannot overlap the same agent by less than an hour.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.activity.appointments(user, query as any); }
  @Post() @ApiProtected("Create an appointment")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) { return this.activity.createAppointment(user, dto); }
  @Patch(":id") @ApiProtected("Reschedule, confirm, complete, cancel or mark a no-show")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAppointmentDto) { return this.activity.updateAppointment(user, id, dto); }
}

@ApiTags("Outcomes")
@Controller("outcomes")
export class OutcomesController {
  constructor(private activity: ActivityService) {}
  @Get() @ApiProtected("Reported property outcomes", "Sold, let and withdrawn reports with time advertised. Not commission records.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.activity.outcomes(user, query as any); }
  @Post(":id/correct") @ApiProtected("Correct a reported outcome and keep the previous value")
  correct(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CorrectOutcomeDto) { return this.activity.correctOutcome(user, id, dto); }
}

@ApiTags("Moderation")
@Controller("moderation")
export class ModerationController {
  constructor(private operations: OperationsService) {}
  @Get() @ApiProtected("Moderation queues", "Agency verification, content review, quality failures, user reports and appeals.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.operations.moderation(user, query as any); }
  @Post(":id/decide") @ApiProtected("Approve, request changes, reject or take down", "A reason is required. Quality failures cannot be approved.")
  decide(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: DecisionDto) { return this.operations.decide(user, id, dto); }
}

@ApiTags("Free users")
@Controller("users")
export class UsersController {
  constructor(private directory: DirectoryService) {}
  @Get()
  @ApiProtected("Free user directory", "Server-side search, filters and pagination. Head office sees every seeker. An agency only sees people who already enquired, offered or booked with that agency. The response includes the unfiltered registered total and the filtered count.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.directory.users(user, query as any); }
  @Get(":id") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("User profile and activity", "No invoices or subscriptions. Activity is limited to authorised staff.")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.directory.user(user, id); }
  @Post(":id/deletion-request") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Record a deletion request")
  request(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UserActionDto) { return this.directory.deletionRequest(user, id, dto); }
  @Post(":id/confirm-deletion") @Roles("SUPER_ADMIN")
  @ApiProtected("Anonymise a free user", "Keeps enquiry history but removes the name, email and phone.")
  confirm(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UserActionDto) { return this.directory.confirmDeletion(user, id, dto); }
  @Post(":id/support") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Open an account-support ticket for this user")
  support(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UserActionDto) { return this.directory.userSupport(user, id, dto); }
}

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private operations: OperationsService) {}
  @Get() @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Agency subscriptions", "Fees are hidden without finance access. Maintenance can see status but not amounts.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.operations.subscriptions(user, query as any); }
  @Post(":id/plan") @Finance()
  @ApiProtected("Change a plan", "Records the previous plan, the new plan and the effective date. Allowances update with the plan.")
  plan(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PlanChangeDto) { return this.operations.changePlan(user, id, dto); }
}

@ApiTags("Invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private operations: OperationsService) {}
  @Get() @ApiProtected("Monthly invoices", "Paid, unpaid, partially paid, overdue, void and refunded. Agency owners see only their own agency.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.operations.invoices(user, query as any); }
  @Post(":id/remind") @ApiProtected("Record a payment reminder")
  remind(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.operations.remind(user, id); }
  @Post(":id/adjust") @Finance()
  @ApiProtected("Adjust an invoice amount", "Requires a reason and finance access.")
  adjust(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: InvoiceAdjustDto) { return this.operations.adjust(user, id, dto); }
  @Post(":id/payments") @Finance()
  @ApiProtected("Record a payment-provider attempt", "A successful attempt is what marks the invoice paid. A failed attempt can move a due invoice to overdue.")
  pay(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PaymentAttemptDto) { return this.operations.payment(user, id, dto); }
}

@ApiTags("Support")
@Controller("tickets")
export class TicketsController {
  constructor(private operations: OperationsService) {}
  @Get() @ApiProtected("Support tickets", "Maintenance staff only receive technical tickets. Agency users only see their own.")
  list(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.operations.tickets(user, query as any); }
  @Post() @ApiProtected("Open a ticket", "Technical category is assigned to maintenance.")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) { return this.operations.createTicket(user, dto); }
  @Get(":id") @ApiProtected("Ticket thread", "Internal notes are omitted for agency callers.")
  one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.operations.ticket(user, id); }
  @Post(":id/messages") @ApiProtected("Customer-visible reply")
  message(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TicketMessageDto) { return this.operations.addMessage(user, id, dto); }
  @Post(":id/notes") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Internal note", "Never sent to the customer.")
  note(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TicketMessageDto) { return this.operations.addNote(user, id, dto); }
  @Patch(":id") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Change ticket status, priority or assignee")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateTicketDto) { return this.operations.updateTicket(user, id, dto); }
}

@ApiTags("Staff")
@Controller("staff")
export class StaffController {
  constructor(private directory: DirectoryService) {}
  @Get() @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Staff directory", "Three roles: super admin, admin/support and maintenance. Passwords and two-factor codes are not listed.")
  list(@CurrentUser() user: AuthUser) { return this.directory.staff(user); }
  @Post() @Roles("SUPER_ADMIN")
  @ApiProtected("Create a staff account")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) { return this.directory.createStaff(user, dto); }
  @Patch(":id") @Roles("SUPER_ADMIN")
  @ApiProtected("Change role, finance access, active flag or two-factor", "Enabling two-factor returns the local code once.")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateStaffDto) { return this.directory.updateStaff(user, id, dto); }
  @Post(":id/revoke-sessions") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Revoke open sessions")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.directory.revokeSessions(user, id); }
}

@ApiTags("Platform")
@Controller("platform")
export class PlatformController {
  constructor(private platform: PlatformService) {}
  @Get("settings") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Platform settings", "Billing rules are omitted without finance access.")
  settings(@CurrentUser() user: AuthUser) { return this.platform.getSettings(user); }
  @Patch("settings") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Update platform settings", "Stores an effective date. A policy change does not silently remove existing content.")
  save(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) { return this.platform.updateSettings(user, dto); }
  @Get("countries") @ApiProtected("Countries and regional performance", "User country is the configured country. Subscription income is GBP for finance roles only.")
  countries(@CurrentUser() user: AuthUser) { return this.platform.countries(user); }
  @Patch("countries/:id") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Activate or retire a country")
  country(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CountryDto) { return this.platform.setCountry(user, id, dto); }
  @Get("analytics") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("App usage and audience analytics", "Each metric has a definition, a source and a last-updated time.")
  analytics(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.platform.analytics(user, query); }
  @Get("templates") @ApiProtected("Notification templates")
  templates() { return this.platform.templates(); }
  @Patch("templates/:id") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Edit a notification template")
  template(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TemplateDto) { return this.platform.updateTemplate(user, id, dto); }
  @Get("announcements") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Announcement history")
  announcements(@Query() query: PageQuery) { return this.platform.announcements(query); }
  @Post("announcements") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Draft an announcement and return a preview")
  draft(@CurrentUser() user: AuthUser, @Body() dto: AnnouncementDto) { return this.platform.createAnnouncement(user, dto); }
  @Post("announcements/:id/send") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT")
  @ApiProtected("Send an announcement and record delivery failures")
  send(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.platform.sendAnnouncement(user, id); }
  @Get("health") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Platform health", "Services, app errors, upload queue, backups and incidents. No financial data.")
  health() { return this.platform.health(); }
  @Post("incidents") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Open a technical incident")
  incident(@CurrentUser() user: AuthUser, @Body() dto: IncidentDto) { return this.platform.createIncident(user, dto); }
  @Patch("incidents/:id") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Update an incident")
  updateIncident(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateIncidentDto) { return this.platform.updateIncident(user, id, dto); }
  @Post("uploads/:id/retry") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Retry a failed upload when it is eligible")
  retry(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.platform.retryUpload(user, id); }
  @Get("audit") @Roles("SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE")
  @ApiProtected("Audit history", "Account changes, moderation, billing and exports.")
  audit(@CurrentUser() user: AuthUser, @Query() query: PageQuery) { return this.platform.audit(user, query); }
  @Get("search") @ApiProtected("Header search across agencies, agents, properties and users")
  search(@CurrentUser() user: AuthUser, @Query("q") q: string) { return this.platform.search(user, q); }
}

@ApiTags("Exports")
@Controller("exports")
export class ExportsController {
  constructor(private platform: PlatformService) {}
  @Get(":kind")
  @ApiProtected("CSV export", "Uses the same permission rules as the on-screen records. The export is written to the audit log.")
  @Header("Content-Type", "text/csv")
  async csv(@CurrentUser() user: AuthUser, @Param("kind") kind: string, @Res() res: Response) {
    const body = await this.platform.export(user, kind);
    res.setHeader("Content-Disposition", `attachment; filename="${kind}.csv"`);
    res.send(body);
  }
}

@ApiTags("Uploads")
@Controller("uploads")
export class UploadsController {
  @Post()
  @ApiProtected("Upload a media file to local disk", "Returns a URL served from /uploads. There is no cloud bucket in the local setup.")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: "uploads",
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${extname(file.originalname) || ".bin"}`),
    }),
  }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}`, size: file.size, originalName: file.originalname };
  }
}

@ApiTags("Platform")
@Controller("plans")
export class PlansController {
  constructor(private directory: DirectoryService) {}
  @Get() @ApiProtected("Monthly plan catalogue")
  list() { return this.directory.planCatalog(); }
}
