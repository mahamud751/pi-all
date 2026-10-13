import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiUnauthorizedResponse } from "@nestjs/swagger";

export const IS_PUBLIC = "isPublic";
export const ROLES_KEY = "roles";
export const FINANCE_KEY = "finance";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Finance = () => SetMetadata(FINANCE_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

export type AuthUser = {
  sub: string;
  sid: string;
  kind: "staff" | "agency";
  role: string;
  email: string;
  name: string;
  agencyId?: string;
  agencyName?: string;
  financeAccess: boolean;
};

export function ApiProtected(summary: string, description?: string) {
  return applyDecorators(
    ApiOperation({ summary, description }),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: "The caller is not signed in, or the session was revoked." }),
    ApiForbiddenResponse({ description: "The signed-in role, agency scope, or finance permission does not allow this action." }),
  );
}
