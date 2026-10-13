import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { mkdirSync } from "fs";
import { AppModule } from "./app.module";

async function bootstrap() {
  mkdirSync(join(process.cwd(), "uploads"), { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, allowedHeaders: ["content-type", "authorization"] });
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  const config = new DocumentBuilder()
    .setTitle("PlaceIn Admin API")
    .setDescription(`Head-office and agency API for PlaceIn.

PlaceIn charges agencies a monthly fee. Property seekers use the app free of charge. Sales and lets happen outside PlaceIn, so this API never records a commission.

Roles
- SUPER_ADMIN: every section, finance, staff permissions, deletion confirmation and audit.
- ADMIN_SUPPORT: onboarding, listings, moderation, support, enquiries and appointments. Finance is off unless a super admin grants it.
- MAINTENANCE: platform health, technical tickets and upload retries. No revenue, invoices or user export.
- Agency OWNER, MANAGER and AGENT: one agency only. The API rejects another agency's id even if the caller sends it.

Publication state and property outcome are separate. An accepted offer does not mark a property sold. Photo quality failures block publication. Overdue subscriptions block new publication and leave existing live listings in place.

Local authentication
- Password hashes use bcrypt.
- Sessions can be revoked.
- Forgot-password and invitations return tokens because outbound email is not configured.
- Demo password for every seeded account: PlaceIn2026!

Swagger
- Authorise with the accessToken from POST /api/auth/login.
- Every protected route checks the bearer token, the session row and the role.`)
    .setVersion("1.0.0")
    .addBearerAuth()
    .addServer("http://localhost:4000", "Local PostgreSQL")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: "PlaceIn Admin API",
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`PlaceIn admin API http://localhost:${port}/api/docs`);
}

bootstrap();
