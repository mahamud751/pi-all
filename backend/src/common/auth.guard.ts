import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { FINANCE_KEY, IS_PUBLIC, ROLES_KEY } from "./decorators";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("Sign in is required. Send the access token as a Bearer token.");
    }

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException("The session token is invalid or has expired. Sign in again.");
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revoked || session.expiresAt < new Date()) {
      if (isPublic) return true;
      throw new UnauthorizedException("This session has been revoked or has expired.");
    }

    request.user = payload;
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && payload.role !== "SUPER_ADMIN" && !roles.includes(payload.role)) {
      throw new ForbiddenException("Your role cannot open this section. Hiding the page is not enough; the API enforces the same rule.");
    }

    const finance = this.reflector.getAllAndOverride<boolean>(FINANCE_KEY, [context.getHandler(), context.getClass()]);
    if (finance && !payload.financeAccess) {
      throw new ForbiddenException("Financial records, invoices and billing exports are limited to staff with finance access.");
    }
    return true;
  }
}
