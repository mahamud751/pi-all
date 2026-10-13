import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

const STATUSES = ["ACTIVE", "INVITED", "REVIEW", "RESTRICTED", "SUSPENDED", "DEACTIVATED", "DELETION_REQUESTED"];
const PLANS = ["STARTER", "GROWTH", "PROFESSIONAL", "ENTERPRISE"];
const PUBLICATION = ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "LIVE", "UNPUBLISHED", "REJECTED", "TAKEN_DOWN"];
const PROPERTY_STATUS = ["AVAILABLE", "UNDER_OFFER", "SOLD", "LET", "WITHDRAWN", "EXPIRED"];
const LISTING = ["SALE", "RENT"];

export class PageQuery {
  @ApiPropertyOptional({ description: "Page number, starting at 1.", example: 1, default: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Rows per page. Maximum 100 so a directory of a million users stays server-paged.", example: 20, default: 20 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: "Case-insensitive search text.", example: "Amina" })
  @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ description: "Country name or ISO code. Leave empty for every country.", example: "MY" })
  @IsOptional() @IsString()
  country?: string;

  @ApiPropertyOptional({ description: "Inclusive range start, ISO date.", example: "2026-09-01" })
  @IsOptional() @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "Inclusive range end, ISO date.", example: "2026-10-13" })
  @IsOptional() @IsString()
  to?: string;
}

export class LoginDto {
  @ApiProperty({ example: "ahad@placein.com", description: "Staff or agency email address." })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "PlaceIn2026!", minLength: 8 })
  @IsString() @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: "Required only when the account has two-factor authentication enabled.", example: "483920" })
  @IsOptional() @IsString()
  otp?: string;
}

export class ForgotDto {
  @ApiProperty({ example: "sarah@aminaproperties.my" })
  @IsEmail()
  email: string;
}

export class ResetDto {
  @ApiProperty({ description: "Reset token from the forgot-password response. Production would email this instead of returning it." })
  @IsString() @MinLength(10)
  token: string;

  @ApiProperty({ example: "PlaceIn2026!", minLength: 8 })
  @IsString() @MinLength(8)
  password: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: "Invitation token issued to the agent.", example: "invite-aisyah-demo" })
  @IsString()
  token: string;

  @ApiProperty({ example: "Aisyah Rahman" })
  @IsString() @MinLength(2)
  name: string;

  @ApiProperty({ example: "PlaceIn2026!" })
  @IsString() @MinLength(8)
  password: string;
}

export class ReasonDto {
  @ApiProperty({ description: "Why this change is being made. Stored on the audit trail.", example: "Verification documents checked." })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class AgencyStatusDto extends ReasonDto {
  @ApiProperty({ enum: STATUSES, example: "ACTIVE" })
  @IsIn(STATUSES)
  status: string;
}

export class CreateAgencyDto {
  @ApiProperty({ example: "Harbour & Co" }) @IsString() @MinLength(2) name: string;
  @ApiProperty({ example: "GB", description: "ISO country code." }) @IsString() countryCode: string;
  @ApiProperty({ example: "London" }) @IsString() city: string;
  @ApiProperty({ example: "12 King Street" }) @IsString() address: string;
  @ApiProperty({ example: "hello@harbour.test" }) @IsEmail() email: string;
  @ApiProperty({ example: "+44 20 7946 0000" }) @IsString() phone: string;
  @ApiPropertyOptional({ example: "https://harbour.test" }) @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: PLANS, default: "GROWTH" }) @IsOptional() @IsIn(PLANS) plan?: string;
}

export class UpdateAgencyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireApproval?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enforceImageQuality?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyEnquiries?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyAppointments?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyTeam?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() twoFactorRequired?: boolean;
  @ApiPropertyOptional({ description: "ISO date the saved rules take effect.", example: "2026-10-13" })
  @IsOptional() @IsString() effectiveOn?: string;
}

export class InviteAgentDto {
  @ApiProperty({ example: "marcus@aminaproperties.my" }) @IsEmail() email: string;
  @ApiProperty({ example: "Marcus Lee" }) @IsString() name: string;
  @ApiPropertyOptional({ enum: ["OWNER", "MANAGER", "AGENT"], default: "AGENT" }) @IsOptional() @IsIn(["OWNER", "MANAGER", "AGENT"]) role?: string;
  @ApiPropertyOptional({ example: "Property consultant" }) @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional({ example: "Kuala Lumpur" }) @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ description: "Project ids to assign on acceptance.", type: [String] }) @IsOptional() projectIds?: string[];
}

export class UpdateAgentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ enum: ["OWNER", "MANAGER", "AGENT"] }) @IsOptional() @IsIn(["OWNER", "MANAGER", "AGENT"]) role?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canCreateListings?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canUploadReels?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canManageEnquiries?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canViewProjects?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() publishRequiresApproval?: boolean;
}

export class ReassignDto extends ReasonDto {
  @ApiProperty({ description: "Agent who will take the open work." }) @IsString() toAgentId: string;
  @ApiPropertyOptional({ description: "Deactivate the departing agent after work is moved.", default: true })
  @IsOptional() @IsBoolean() deactivate?: boolean;
}

export class PhotoDto {
  @ApiProperty({ example: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80" })
  @IsString() url: string;
  @ApiProperty({ example: 1920, description: "Pixel width. Compared with the platform minimum." }) @IsInt() @Min(1) width: number;
  @ApiProperty({ example: 1280 }) @IsInt() @Min(1) height: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCover?: boolean;
}

export class CreatePropertyDto {
  @ApiPropertyOptional({ description: "Required for head-office staff. Ignored for an agency user, who is always scoped to their own agency." })
  @IsOptional() @IsString() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentId?: string;
  @ApiProperty({ example: "Villa Mont Kiara" }) @IsString() @MinLength(3) title: string;
  @ApiProperty({ enum: LISTING, example: "SALE" }) @IsIn(LISTING) listingType: string;
  @ApiProperty({ example: "Bungalow" }) @IsString() propertyType: string;
  @ApiProperty({ example: 2800000 }) @IsNumber() @Min(0) price: number;
  @ApiProperty({ example: "MYR" }) @IsString() currency: string;
  @ApiProperty({ example: 5 }) @IsInt() @Min(0) beds: number;
  @ApiProperty({ example: 6 }) @IsInt() @Min(0) baths: number;
  @ApiProperty({ example: 7200 }) @IsInt() @Min(1) sizeSqft: number;
  @ApiProperty({ example: "Contemporary villa with a private pool in Mont Kiara." }) @IsString() @MinLength(10) description: string;
  @ApiPropertyOptional({ example: "Malaysia" }) @IsOptional() @IsString() countryName?: string;
  @ApiPropertyOptional({ example: "Kuala Lumpur" }) @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ example: "Mont Kiara" }) @IsOptional() @IsString() area?: string;
  @ApiPropertyOptional({ example: "50480" }) @IsOptional() @IsString() postcode?: string;
  @ApiPropertyOptional({ description: "Full address. Shown to the agency, not in public reporting.", example: "Jalan Kiara 3, Mont Kiara" })
  @IsOptional() @IsString() addressPrivate?: string;
  @ApiPropertyOptional({ type: [PhotoDto] }) @IsOptional() @Type(() => PhotoDto) photos?: PhotoDto[];
}

export class PhotosDto {
  @ApiProperty({ type: [PhotoDto], description: "Each photo is scored against the platform minimum width and height." })
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos: PhotoDto[];
}

export class UpdatePropertyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional({ enum: LISTING }) @IsOptional() @IsIn(LISTING) listingType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() propertyType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() beds?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() baths?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() sizeSqft?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() countryName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressPrivate?: string;
}

export class PropertyStatusDto extends ReasonDto {
  @ApiProperty({ enum: PROPERTY_STATUS, description: "Commercial outcome. Separate from publication. An accepted offer must not set this by itself." })
  @IsIn(PROPERTY_STATUS) status: string;
  @ApiPropertyOptional({ description: "Whether the agency attributes the lead to PlaceIn. Unknown when omitted." })
  @IsOptional() @IsBoolean() leadAttributedToPlaceIn?: boolean;
}

export class PublicationDto extends ReasonDto {
  @ApiProperty({ enum: PUBLICATION }) @IsIn(PUBLICATION) publication: string;
}

export class CreateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
  @ApiProperty({ example: "Palm Villas" }) @IsString() name: string;
  @ApiProperty({ example: "Kuala Lumpur" }) @IsString() city: string;
  @ApiProperty({ example: "Mont Kiara" }) @IsString() area: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ example: "Q4 2026" }) @IsOptional() @IsString() completion?: string;
  @ApiPropertyOptional({ example: 48 }) @IsOptional() @IsInt() units?: number;
  @ApiPropertyOptional({ example: 5 }) @IsOptional() @IsInt() propertyTypes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() agentIds?: string[];
}

export class CreateReelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() propertyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentId?: string;
  @ApiProperty({ enum: ["REEL", "WALKTHROUGH"], example: "REEL" }) @IsIn(["REEL", "WALKTHROUGH"]) kind: string;
  @ApiProperty({ example: "Luxury living at Villa Mont Kiara." }) @IsString() @MinLength(3) caption: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
}

export class UpdateEnquiryDto {
  @ApiPropertyOptional({ enum: ["NEW", "ASSIGNED", "ANSWERED", "UNANSWERED", "CLOSED"] })
  @IsOptional() @IsIn(["NEW", "ASSIGNED", "ANSWERED", "UNANSWERED", "CLOSED"]) status?: string;
  @ApiPropertyOptional({ description: "Agent who should follow up. Private message text is not stored." })
  @IsOptional() @IsString() agentId?: string;
}

export class UpdateOfferDto {
  @ApiProperty({ enum: ["SUBMITTED", "ACKNOWLEDGED", "ACCEPTED", "DECLINED", "WITHDRAWN"] })
  @IsIn(["SUBMITTED", "ACKNOWLEDGED", "ACCEPTED", "DECLINED", "WITHDRAWN"]) status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateAppointmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
  @ApiProperty({ enum: ["VIEWING", "VIDEO_CALL", "OFFICE"] }) @IsIn(["VIEWING", "VIDEO_CALL", "OFFICE"]) kind: string;
  @ApiProperty() @IsString() freeUserId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() propertyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentId?: string;
  @ApiProperty({ description: "ISO datetime in the appointment timezone.", example: "2026-10-14T09:30:00" })
  @IsString() startsAt: string;
  @ApiProperty({ example: "Asia/Kuala_Lumpur" }) @IsString() timezone: string;
  @ApiPropertyOptional({ enum: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED", "COMPLETED", "CANCELLED", "NO_SHOW"] })
  @IsOptional() @IsIn(["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED", "COMPLETED", "CANCELLED", "NO_SHOW"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ enum: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED", "COMPLETED", "CANCELLED", "NO_SHOW"] })
  @IsOptional() @IsIn(["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED", "COMPLETED", "CANCELLED", "NO_SHOW"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CorrectOutcomeDto extends ReasonDto {
  @ApiProperty({ enum: PROPERTY_STATUS }) @IsIn(PROPERTY_STATUS) outcome: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() leadAttributedToPlaceIn?: boolean;
}

export class DecisionDto extends ReasonDto {
  @ApiProperty({ enum: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "TAKEN_DOWN"] })
  @IsIn(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "TAKEN_DOWN"]) decision: string;
}

export class UserActionDto extends ReasonDto {}

export class PlanChangeDto extends ReasonDto {
  @ApiProperty({ enum: PLANS }) @IsIn(PLANS) plan: string;
  @ApiProperty({ example: "2026-11-01", description: "Date the new plan takes effect." }) @IsString() effectiveOn: string;
}

export class InvoiceAdjustDto extends ReasonDto {
  @ApiProperty({ example: 249, description: "Replacement invoice amount in the invoice currency." }) @IsNumber() @Min(0) amount: number;
}

export class PaymentAttemptDto {
  @ApiProperty({ example: "pay_local_1001", description: "Reference from the payment provider. This record decides the paid state." })
  @IsString() providerRef: string;
  @ApiProperty({ enum: ["SUCCESS", "FAILED"] }) @IsIn(["SUCCESS", "FAILED"]) status: string;
  @ApiProperty({ example: 249 }) @IsNumber() @Min(0) amount: number;
  @ApiPropertyOptional({ example: "Card declined" }) @IsOptional() @IsString() failureReason?: string;
}

export class CreateTicketDto {
  @ApiProperty({ enum: ["AGENCY", "FREE_USER"] }) @IsIn(["AGENCY", "FREE_USER"]) requesterType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() freeUserId?: string;
  @ApiProperty({ example: "Technical", description: "Technical issues are routed to maintenance staff." }) @IsString() category: string;
  @ApiProperty({ enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }) @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority: string;
  @ApiProperty({ example: "Video still processing after upload" }) @IsString() subject: string;
  @ApiProperty({ description: "First message the customer can see." }) @IsString() @MinLength(3) body: string;
}

export class TicketMessageDto {
  @ApiProperty() @IsString() @MinLength(1) body: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: ["OPEN", "AWAITING_CUSTOMER", "IN_PROGRESS", "RESOLVED", "CLOSED"] })
  @IsOptional() @IsIn(["OPEN", "AWAITING_CUSTOMER", "IN_PROGRESS", "RESOLVED", "CLOSED"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeId?: string;
  @ApiPropertyOptional({ enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }) @IsOptional() @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority?: string;
}

export class CreateStaffDto {
  @ApiProperty({ example: "lina@placein.com" }) @IsEmail() email: string;
  @ApiProperty({ example: "Lina Rahman" }) @IsString() name: string;
  @ApiProperty({ enum: ["SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE"] }) @IsIn(["SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE"]) role: string;
  @ApiProperty({ example: "PlaceIn2026!" }) @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional({ description: "Only a super admin can grant finance access. Maintenance can never have it.", default: false })
  @IsOptional() @IsBoolean() financeAccess?: boolean;
}

export class UpdateStaffDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: ["SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE"] })
  @IsOptional() @IsIn(["SUPER_ADMIN", "ADMIN_SUPPORT", "MAINTENANCE"]) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() financeAccess?: boolean;
  @ApiPropertyOptional({ description: "Turn the local second factor on or off." }) @IsOptional() @IsBoolean() twoFactor?: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 1600 }) @IsOptional() @IsInt() mediaMinWidth?: number;
  @ApiPropertyOptional({ example: 1200 }) @IsOptional() @IsInt() mediaMinHeight?: number;
  @ApiPropertyOptional({ example: 200 }) @IsOptional() @IsInt() maxVideoMb?: number;
  @ApiPropertyOptional({ example: "GBP" }) @IsOptional() @IsString() reportingCurrency?: string;
  @ApiPropertyOptional({ description: "Units of local currency for 1 GBP. Used only as a stored conversion basis." })
  @IsOptional() fxRates?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsString() privacyPolicyVersion?: string;
  @ApiPropertyOptional() @IsOptional() integrations?: Record<string, string>;
  @ApiPropertyOptional({ description: "Billing rules. Rejected for roles without finance access. Does not unpublish existing content." })
  @IsOptional() billingRules?: Record<string, string>;
  @ApiPropertyOptional({ example: "2026-10-13" }) @IsOptional() @IsString() effectiveOn?: string;
  @ApiProperty({ description: "Why the configuration is changing." }) @IsString() @MinLength(3) reason: string;
}

export class CountryDto {
  @ApiProperty() @IsBoolean() active: boolean;
  @ApiProperty() @IsString() @MinLength(3) reason: string;
}

export class TemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}

export class AnnouncementDto {
  @ApiProperty({ example: "Scheduled maintenance" }) @IsString() title: string;
  @ApiProperty() @IsString() body: string;
  @ApiProperty({ enum: ["PUSH", "EMAIL", "IN_APP"], example: "EMAIL" }) @IsIn(["PUSH", "EMAIL", "IN_APP"]) channel: string;
  @ApiProperty({ example: "All agencies", description: "Who should receive the message." }) @IsString() audience: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scheduledAt?: string;
}

export class IncidentDto {
  @ApiProperty({ example: "Media processing" }) @IsString() service: string;
  @ApiProperty({ enum: ["LOW", "MEDIUM", "HIGH"] }) @IsIn(["LOW", "MEDIUM", "HIGH"]) severity: string;
  @ApiProperty({ example: "Some completed uploads are waiting for video processing." }) @IsString() summary: string;
  @ApiProperty() @IsString() symptom: string;
  @ApiProperty() @IsString() impact: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignee?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() uploadReference?: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({ example: "Investigating" }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() impact?: string;
}
