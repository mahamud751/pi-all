import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AcceptInviteDto, ForgotDto, LoginDto, ResetDto } from "../domain/dto";
import { ApiProtected, AuthUser, CurrentUser, Public } from "../common/decorators";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("login")
  @ApiOkResponse({ description: "Bearer token plus the signed-in profile. Agency users never receive finance access." })
  login(@Body() dto: LoginDto, @Headers("user-agent") userAgent?: string) {
    return this.auth.login(dto, userAgent);
  }

  @Public()
  @Post("forgot-password")
  @ApiOkResponse({ description: "Local development returns resetToken when the email exists. A production deployment would send email and omit the token." })
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgot(dto);
  }

  @Public()
  @Post("reset-password")
  reset(@Body() dto: ResetDto) {
    return this.auth.reset(dto);
  }

  @Public()
  @Post("accept-invite")
  @ApiOkResponse({ description: "Activates an invited agent and returns a session. Passwords are stored only as a hash." })
  accept(@Body() dto: AcceptInviteDto, @Headers("user-agent") userAgent?: string) {
    return this.auth.acceptInvite(dto, userAgent);
  }

  @Get("me")
  @ApiProtected("Current profile", "Fresh permissions for the signed-in staff member or agency user. Password hashes and two-factor codes are never returned.")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user);
  }

  @Post("logout")
  @ApiProtected("Revoke the current session")
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user);
  }
}
