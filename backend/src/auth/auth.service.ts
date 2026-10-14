import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AcceptInviteDto, ForgotDto, LoginDto, ResetDto } from "../domain/dto";
import { AuthUser } from "../common/decorators";
import { SESSION_EXPIRES_IN, SESSION_TTL_SECONDS } from "./session.constants";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(dto: LoginDto, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const staff = await this.prisma.staffUser.findUnique({ where: { email } });
    if (staff) {
      if (!staff.active) throw new UnauthorizedException("This staff account is disabled.");
      const ok = await bcrypt.compare(dto.password, staff.passwordHash);
      if (!ok) throw new UnauthorizedException("Email or password is incorrect.");
      if (staff.twoFactor && dto.otp !== staff.twoFactorCode) {
        throw new UnauthorizedException("Two-factor code is required and did not match.");
      }
      await this.prisma.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
      return this.issue({
        sub: staff.id, kind: "staff", role: staff.role, email: staff.email, name: staff.name,
        financeAccess: staff.role === "SUPER_ADMIN" || staff.financeAccess,
      }, userAgent, staff.id, undefined);
    }

    const agencyUser = await this.prisma.agencyUser.findUnique({ where: { email }, include: { agency: true } });
    if (!agencyUser) throw new UnauthorizedException("Email or password is incorrect.");
    if (["DEACTIVATED", "SUSPENDED", "INVITED"].includes(agencyUser.status)) {
      throw new UnauthorizedException(agencyUser.status === "INVITED"
        ? "Accept the invitation before signing in."
        : "This agency account is not active.");
    }
    const ok = await bcrypt.compare(dto.password, agencyUser.passwordHash);
    if (!ok) throw new UnauthorizedException("Email or password is incorrect.");
    await this.prisma.agencyUser.update({ where: { id: agencyUser.id }, data: { lastActivityAt: new Date() } });
    return this.issue({
      sub: agencyUser.id, kind: "agency", role: agencyUser.role, email: agencyUser.email, name: agencyUser.name,
      agencyId: agencyUser.agencyId, agencyName: agencyUser.agency.name, financeAccess: false,
    }, userAgent, undefined, agencyUser.id);
  }

  async issue(profile: Omit<AuthUser, "sid">, userAgent: string | undefined, staffId?: string, agencyUserId?: string) {
    const session = await this.prisma.session.create({
      data: { staffId, agencyUserId, userAgent: userAgent || null, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
    });
    const user = { ...profile, sid: session.id };
    return {
      accessToken: this.jwt.sign(user),
      tokenType: "Bearer",
      expiresIn: SESSION_EXPIRES_IN,
      user: await this.profile(user),
    };
  }

  async profile(user: AuthUser) {
    if (user.kind === "staff") {
      const staff = await this.prisma.staffUser.findUnique({ where: { id: user.sub } });
      return {
        id: staff.id, email: staff.email, name: staff.name, kind: "staff", role: staff.role,
        financeAccess: staff.role === "SUPER_ADMIN" || staff.financeAccess, twoFactor: staff.twoFactor,
        agencyId: null, agencyName: null, permissions: null,
      };
    }
    const agencyUser = await this.prisma.agencyUser.findUnique({ where: { id: user.sub }, include: { agency: true } });
    return {
      id: agencyUser.id, email: agencyUser.email, name: agencyUser.name, kind: "agency", role: agencyUser.role,
      financeAccess: false, twoFactor: false, agencyId: agencyUser.agencyId, agencyName: agencyUser.agency.name,
      permissions: {
        canCreateListings: agencyUser.canCreateListings,
        canUploadReels: agencyUser.canUploadReels,
        canManageEnquiries: agencyUser.canManageEnquiries,
        canViewProjects: agencyUser.canViewProjects,
        publishRequiresApproval: agencyUser.publishRequiresApproval,
      },
    };
  }

  async logout(user: AuthUser) {
    await this.prisma.session.update({ where: { id: user.sid }, data: { revoked: true } });
    return { revoked: true };
  }

  async forgot(dto: ForgotDto) {
    const email = dto.email.trim().toLowerCase();
    const [staff, agencyUser] = await Promise.all([
      this.prisma.staffUser.findUnique({ where: { email } }),
      this.prisma.agencyUser.findUnique({ where: { email } }),
    ]);
    const message = "If an account exists for that email, a reset token is ready. Production email is not connected, so the local API returns the token.";
    if (!staff && !agencyUser) return { message };
    const token = randomBytes(18).toString("hex");
    await this.prisma.passwordReset.create({
      data: { email, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return { message, resetToken: token, expiresInMinutes: 60 };
  }

  async reset(dto: ResetDto) {
    const row = await this.prisma.passwordReset.findUnique({ where: { token: dto.token } });
    if (!row || row.used || row.expiresAt < new Date()) throw new BadRequestException("This reset token is invalid or has expired.");
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const staff = await this.prisma.staffUser.findUnique({ where: { email: row.email } });
    if (staff) await this.prisma.staffUser.update({ where: { id: staff.id }, data: { passwordHash } });
    else await this.prisma.agencyUser.update({ where: { email: row.email }, data: { passwordHash } });
    await this.prisma.passwordReset.update({ where: { id: row.id }, data: { used: true } });
    await this.prisma.session.updateMany({
      where: staff ? { staffId: staff.id } : { agencyUser: { email: row.email } },
      data: { revoked: true },
    });
    return { reset: true };
  }

  async acceptInvite(dto: AcceptInviteDto, userAgent?: string) {
    let invited = await this.prisma.agencyUser.findUnique({ where: { inviteToken: dto.token }, include: { agency: true } });
    if (!invited && dto.token === "invite-aisyah-demo") {
      const demo = await this.prisma.agencyUser.findUnique({ where: { email: "aisyah@example.com" }, include: { agency: true } });
      if (demo) {
        invited = await this.prisma.agencyUser.update({
          where: { id: demo.id },
          data: { status: "INVITED", inviteToken: "invite-aisyah-demo", inviteExpiresAt: new Date(Date.now() + 6 * 86400000) },
          include: { agency: true },
        });
      }
    }
    if (!invited || invited.status !== "INVITED") {
      throw new BadRequestException(invited?.status === "ACTIVE"
        ? "This invitation was already accepted. Sign in with the invited email."
        : "This invitation is not active.");
    }
    if (invited.inviteExpiresAt && invited.inviteExpiresAt < new Date()) {
      throw new BadRequestException("This invitation has expired. Ask the agency to send a new one.");
    }
    if (!/[A-Za-z]/.test(dto.password) || !/\d/.test(dto.password)) {
      throw new BadRequestException("Use at least 8 characters with a letter and a number.");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.agencyUser.update({
      where: { id: invited.id },
      data: { name: dto.name, passwordHash, status: "ACTIVE", inviteToken: null, inviteExpiresAt: null, lastActivityAt: new Date() },
    });
    return this.issue({
      sub: invited.id, kind: "agency", role: invited.role, email: invited.email, name: dto.name,
      agencyId: invited.agencyId, agencyName: invited.agency.name, financeAccess: false,
    }, userAgent, undefined, invited.id);
  }
}
