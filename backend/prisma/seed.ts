import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "PlaceIn2026!";

const photos = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdbc?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
];

function at(offsetDays: number, hours = 10, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function utcDay(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date;
}

async function clear() {
  const models = [
    "metricDefinition", "dailyMetric", "incident", "backupStatus", "uploadJob", "appError", "serviceStatus",
    "auditLog", "announcement", "notificationTemplate", "platformSetting", "moderationItem",
    "ticketNote", "ticketMessage", "supportTicket", "invoiceEvent", "paymentAttempt", "invoice",
    "subscriptionChange", "subscription", "outcomeReport", "appointment", "offer", "enquiry",
    "reel", "propertyStatusEvent", "propertyPhoto", "property", "projectAgent", "project",
    "passwordReset", "session", "freeUser", "agencyUser", "agency", "staffUser", "country",
  ];
  for (const model of models) await (prisma as any)[model].deleteMany();
}

async function main() {
  await clear();
  const hash = await bcrypt.hash(password, 10);

  const countryRows = await Promise.all([
    ["MY", "Malaysia", "MYR", "Asia/Kuala_Lumpur", "English"],
    ["PT", "Portugal", "EUR", "Europe/Lisbon", "Portuguese"],
    ["AE", "United Arab Emirates", "AED", "Asia/Dubai", "Arabic"],
    ["ES", "Spain", "EUR", "Europe/Madrid", "Spanish"],
    ["GB", "United Kingdom", "GBP", "Europe/London", "English"],
    ["JP", "Japan", "JPY", "Asia/Tokyo", "Japanese"],
  ].map(([code, name, currency, timezone, language]) =>
    prisma.country.create({ data: { code, name, currency, timezone, language } })));
  const country = Object.fromEntries(countryRows.map((row) => [row.code, row]));

  await prisma.staffUser.create({ data: { email: "ahad@placein.com", name: "Ahad", role: "SUPER_ADMIN", financeAccess: true, passwordHash: hash, lastLoginAt: at(0, 8, 12) } });
  const support = await prisma.staffUser.create({ data: { email: "support@placein.com", name: "Nora Aziz", role: "ADMIN_SUPPORT", financeAccess: false, passwordHash: hash, lastLoginAt: at(0, 8, 40) } });
  const tech = await prisma.staffUser.create({ data: { email: "tech@placein.com", name: "Technical lead", role: "MAINTENANCE", financeAccess: false, passwordHash: hash, lastLoginAt: at(0, 9, 5) } });

  const fees: Record<string, number> = { STARTER: 99, GROWTH: 249, PROFESSIONAL: 499, ENTERPRISE: 899 };
  const limits: Record<string, { agentAllowance: number; listingAllowance: number }> = {
    STARTER: { agentAllowance: 5, listingAllowance: 50 },
    GROWTH: { agentAllowance: 15, listingAllowance: 200 },
    PROFESSIONAL: { agentAllowance: 40, listingAllowance: 800 },
    ENTERPRISE: { agentAllowance: 100, listingAllowance: 5000 },
  };
  const agencySeed = [
    ["AG-001", "Amina Properties", "MY", "Kuala Lumpur", "Level 10, Menara KL Eco City", "enquiries@aminaproperties.my", "+60 3 2188 7600", "ACTIVE", "VERIFIED", "PROFESSIONAL", "A boutique agency for luxury homes in Kuala Lumpur."],
    ["AG-002", "Lisbon Living", "PT", "Lisbon", "Rua da Prata 18", "hello@lisbonliving.pt", "+351 21 000 1100", "ACTIVE", "VERIFIED", "GROWTH", "City apartments and river homes."],
    ["AG-003", "Palm Estates", "AE", "Dubai", "Marina Plaza, Dubai Marina", "hello@palmestates.ae", "+971 4 000 2200", "ACTIVE", "VERIFIED", "ENTERPRISE", "Waterfront and villa specialist."],
    ["AG-004", "Riviera Estates", "ES", "Marbella", "Avenida del Mar 4", "hola@riviera.es", "+34 95 000 3300", "REVIEW", "PENDING", "GROWTH", "Awaiting verification documents."],
    ["AG-005", "Harbour & Co", "GB", "London", "12 King Street", "hello@harbour.test", "+44 20 7946 0991", "ACTIVE", "VERIFIED", "STARTER", "London sales and lettings."],
    ["AG-006", "Sakura Homes", "JP", "Tokyo", "2-1 Shibuya", "hello@sakura.jp", "+81 3 0000 4400", "RESTRICTED", "VERIFIED", "GROWTH", "Temporarily restricted after a moderation review."],
  ] as const;

  const agencies: Record<string, { id: string; name: string; currency: string }> = {};
  for (const row of agencySeed) {
    const [code, name, cc, city, address, email, phone, status, verification, plan, description] = row;
    const created = await prisma.agency.create({
      data: {
        code, name, countryId: country[cc].id, city, address, email, phone, description,
        status: status as any, verification, plan: plan as any, ...limits[plan],
        website: `https://www.${code.toLowerCase()}.example`, joinedAt: code === "AG-004" ? at(-4) : at(-120), lastActivityAt: at(-1, 16),
      },
    });
    agencies[code] = { id: created.id, name, currency: country[cc].currency };
    const trial = status === "REVIEW";
    await prisma.subscription.create({
      data: {
        agencyId: created.id, plan: plan as any, monthlyFee: fees[plan], currency: country[cc].currency,
        status: trial ? "TRIAL" : code === "AG-005" ? "PAST_DUE" : "ACTIVE",
        startedAt: at(-120), renewsAt: at(trial ? 6 : 18), trialEndsAt: trial ? at(6) : null,
      },
    });
  }

  async function agent(agencyCode: string, email: string, name: string, role: any, extra: Record<string, unknown> = {}) {
    return prisma.agencyUser.create({
      data: {
        agencyId: agencies[agencyCode].id, email, name, role, passwordHash: hash, status: "ACTIVE",
        title: role === "OWNER" ? "Agency owner" : "Property consultant", city: "Kuala Lumpur", lastActivityAt: at(-1),
        ...extra,
      },
    });
  }

  const sarah = await agent("AG-001", "sarah@aminaproperties.my", "Sarah Lim", "OWNER", { publishRequiresApproval: false });
  const daniel = await agent("AG-001", "daniel@aminaproperties.my", "Daniel Tan", "AGENT");
  const marcus = await agent("AG-001", "marcus@aminaproperties.my", "Marcus Lee", "AGENT");
  const priya = await agent("AG-001", "priya@aminaproperties.my", "Priya Nair", "MANAGER");
  await agent("AG-001", "aisyah@example.com", "Aisyah Rahman", "AGENT", {
    status: "INVITED", inviteToken: "invite-aisyah-demo", inviteExpiresAt: at(6), title: "Agent",
  });
  const lisbonAgent = await agent("AG-002", "rita@lisbonliving.pt", "Rita Costa", "OWNER", { city: "Lisbon" });
  const palmAgent = await agent("AG-003", "omar@palmestates.ae", "Omar Hassan", "OWNER", { city: "Dubai" });
  await agent("AG-004", "lucia@riviera.es", "Lucia Romero", "OWNER", { city: "Marbella", status: "REVIEW" });
  const harbourAgent = await agent("AG-005", "james@harbour.test", "James Wright", "OWNER", { city: "London" });
  await agent("AG-006", "yuki@sakura.jp", "Yuki Sato", "OWNER", { city: "Tokyo", status: "RESTRICTED" });

  const palm = await prisma.project.create({ data: { agencyId: agencies["AG-001"].id, name: "Palm Villas", city: "Kuala Lumpur", area: "Mont Kiara", description: "Resort-style villas with a private pool and landscaped gardens.", units: 48, propertyTypes: 5, completion: "Q4 2026", imageUrl: photos[0], status: "ACTIVE" } });
  const skyline = await prisma.project.create({ data: { agencyId: agencies["AG-001"].id, name: "Skyline Residences", city: "Kuala Lumpur", area: "KLCC", description: "High-rise residences above the city centre.", units: 120, propertyTypes: 3, completion: "Ready", imageUrl: photos[1], status: "ACTIVE" } });
  const city = await prisma.project.create({ data: { agencyId: agencies["AG-001"].id, name: "KL City Collection", city: "Kuala Lumpur", area: "Bukit Bintang", description: "A small collection of city condominiums.", units: 18, propertyTypes: 2, imageUrl: photos[2], status: "ACTIVE" } });
  for (const pair of [[palm.id, daniel.id], [palm.id, sarah.id], [skyline.id, marcus.id], [city.id, priya.id]]) {
    await prisma.projectAgent.create({ data: { projectId: pair[0], agentId: pair[1] } });
  }

  const propertySeed = [
    ["PR0001", "AG-001", palm.id, daniel.id, "Villa Mont Kiara", "SALE", "Bungalow", 2800000, "MYR", 5, 6, 7200, "Malaysia", "Kuala Lumpur", "Mont Kiara", "50480", "LIVE", "AVAILABLE", "PASS", 0],
    ["PR0002", "AG-001", skyline.id, marcus.id, "Skyline Heights Apartment", "SALE", "Condominium", 2950000, "MYR", 3, 3, 1860, "Malaysia", "Kuala Lumpur", "KLCC", "50088", "LIVE", "AVAILABLE", "PASS", 1],
    ["PR0003", "AG-001", city.id, priya.id, "City Centre Condo", "SALE", "Condominium", 1850000, "MYR", 2, 2, 1100, "Malaysia", "Kuala Lumpur", "Bukit Bintang", "55100", "LIVE", "UNDER_OFFER", "PASS", 2],
    ["PR0004", "AG-001", palm.id, daniel.id, "Sea View Apartment", "SALE", "Apartment", 3200000, "MYR", 4, 4, 2400, "Malaysia", "Kuala Lumpur", "Mont Kiara", "50480", "DRAFT", "AVAILABLE", "PENDING", 3],
    ["PR0005", "AG-001", palm.id, daniel.id, "Seaview Penthouse", "SALE", "Penthouse", 6400000, "MYR", 4, 5, 4100, "Malaysia", "Kuala Lumpur", "Mont Kiara", "50480", "PENDING_REVIEW", "AVAILABLE", "FAIL", 4],
    ["PR0006", "AG-001", skyline.id, marcus.id, "Garden Terrace", "RENT", "Condominium", 12000, "MYR", 3, 2, 1500, "Malaysia", "Kuala Lumpur", "KLCC", "50088", "CHANGES_REQUESTED", "AVAILABLE", "PASS", 1],
    ["PR0007", "AG-001", city.id, priya.id, "Damansara Heights Bungalow", "SALE", "Bungalow", 5100000, "MYR", 5, 5, 5400, "Malaysia", "Kuala Lumpur", "Damansara", "50490", "UNPUBLISHED", "WITHDRAWN", "PASS", 5],
    ["PR0008", "AG-001", palm.id, sarah.id, "Mont Kiara Studio", "RENT", "Studio", 4200, "MYR", 1, 1, 560, "Malaysia", "Kuala Lumpur", "Mont Kiara", "50480", "UNPUBLISHED", "LET", "PASS", 2],
    ["PR0009", "AG-002", null, lisbonAgent.id, "Alfama Apartment", "SALE", "Apartment", 890000, "EUR", 2, 2, 980, "Portugal", "Lisbon", "Alfama", "1100", "UNPUBLISHED", "SOLD", "PASS", 3],
    ["PR0010", "AG-002", null, lisbonAgent.id, "Riverside Condo", "RENT", "Apartment", 2400, "EUR", 1, 1, 640, "Portugal", "Lisbon", "Santos", "1200", "LIVE", "AVAILABLE", "PASS", 0],
    ["PR0011", "AG-003", null, palmAgent.id, "Marina Gate Residence", "SALE", "Apartment", 3100000, "AED", 2, 3, 1450, "United Arab Emirates", "Dubai", "Dubai Marina", "00000", "LIVE", "AVAILABLE", "PASS", 1],
    ["PR0012", "AG-003", null, palmAgent.id, "Palm Jumeirah Villa", "SALE", "Villa", 18500000, "AED", 6, 7, 8200, "United Arab Emirates", "Dubai", "Palm Jumeirah", "00000", "LIVE", "UNDER_OFFER", "PASS", 5],
    ["PR0013", "AG-004", null, null, "Golden Mile Villa", "SALE", "Villa", 2400000, "EUR", 5, 5, 4600, "Spain", "Marbella", "Golden Mile", "29602", "DRAFT", "AVAILABLE", "PENDING", 4],
    ["PR0014", "AG-005", null, harbourAgent.id, "Notting Hill Flat", "SALE", "Flat", 1750000, "GBP", 2, 2, 900, "United Kingdom", "London", "Notting Hill", "W11", "LIVE", "AVAILABLE", "PASS", 2],
    ["PR0015", "AG-005", null, harbourAgent.id, "Harbour Loft", "RENT", "Loft", 4200, "GBP", 2, 2, 1100, "United Kingdom", "London", "Wapping", "E1W", "LIVE", "EXPIRED", "PASS", 3],
    ["PR0016", "AG-006", null, null, "Shibuya Residence", "SALE", "Apartment", 128000000, "JPY", 2, 1, 780, "Japan", "Tokyo", "Shibuya", "150-0002", "TAKEN_DOWN", "AVAILABLE", "PASS", 0],
  ] as const;

  const properties: Record<string, { id: string; agencyId: string; title: string }> = {};
  for (const row of propertySeed) {
    const [reference, code, projectId, agentId, title, listingType, propertyType, price, currency, beds, baths, sizeSqft, countryName, cityName, area, postcode, publication, status, mediaQuality, photoIndex] = row;
    const small = mediaQuality === "FAIL";
    const created = await prisma.property.create({
      data: {
        reference, agencyId: agencies[code].id, projectId, agentId, title, listingType: listingType as any, propertyType,
        price, currency, beds, baths, sizeSqft, description: `${title} is listed by ${agencies[code].name}.`,
        countryName, city: cityName, area, postcode, addressPrivate: `${area}, ${cityName}`,
        publication: publication as any, status: status as any, mediaQuality, coverUrl: photos[photoIndex],
        views: 400 + photoIndex * 320, uniqueViewers: 180 + photoIndex * 40, saves: 12 + photoIndex * 3,
        uploadedAt: at(-40 + photoIndex),
        photos: {
          create: [{ url: photos[photoIndex], width: small ? 800 : 1920, height: small ? 600 : 1280, isCover: true, quality: small ? "TOO_SMALL" : "READY" }],
        },
        events: { create: { toStatus: status, publication, actorName: "Seed", reason: "Opening position for the local dataset" } },
      },
    });
    properties[reference] = { id: created.id, agencyId: agencies[code].id, title };
  }

  const reelSeed = [
    ["AG-001", daniel.id, "PR0001", "Sunset views at Palm Villas", "LIVE", 18600],
    ["AG-001", marcus.id, "PR0002", "Spacious living, city views", "LIVE", 9400],
    ["AG-001", priya.id, "PR0003", "Modern design, tropical charm", "DRAFT", 0],
    ["AG-001", daniel.id, "PR0005", "Master bedroom tour", "PENDING_REVIEW", 0],
    ["AG-002", lisbonAgent.id, "PR0010", "Morning light on the river", "LIVE", 4200],
    ["AG-003", palmAgent.id, "PR0012", "Palm Jumeirah walkthrough", "LIVE", 12800],
  ] as const;
  for (const [code, agentId, ref, caption, publication, plays] of reelSeed) {
    await prisma.reel.create({
      data: {
        agencyId: agencies[code].id, agentId, propertyId: properties[ref].id, caption, coverUrl: photos[plays % photos.length],
        videoUrl: publication === "DRAFT" ? null : "https://example.local/reel.mp4", kind: caption.includes("walkthrough") ? "WALKTHROUGH" : "REEL",
        processing: publication === "DRAFT" ? "QUEUED" : "READY", quality: "PASS", publication: publication as any,
        plays, uniqueViewers: Math.round(plays * 0.62), watchTimeSec: plays * 8, completionRate: 0.46, likes: Math.round(plays * 0.04), saves: Math.round(plays * 0.01),
      },
    });
  }

  const seekers = [
    ["James Wong", "james.wong@seeker.test", "Malaysia"],
    ["Nadia Khan", "nadia.khan@seeker.test", "Malaysia"],
    ["Alex Chen", "alex.chen@seeker.test", "Malaysia"],
    ["Jason Tan", "jason.tan@seeker.test", "Malaysia"],
    ["Mei Lin", "mei.lin@seeker.test", "Malaysia"],
    ["Sofia Almeida", "sofia@seeker.test", "Portugal"],
    ["Hugo Martins", "hugo@seeker.test", "Portugal"],
    ["Layla Farouk", "layla@seeker.test", "United Arab Emirates"],
    ["Adam Cole", "adam@seeker.test", "United Kingdom"],
    ["Emma Brooks", "emma@seeker.test", "United Kingdom"],
    ["Lucia Vega", "lucia.v@seeker.test", "Spain"],
    ["Haruto Mori", "haruto@seeker.test", "Japan"],
    ["Aisha Noor", "aisha@seeker.test", "Malaysia"],
    ["Ben Carter", "ben@seeker.test", "United Kingdom"],
    ["Ines Rocha", "ines@seeker.test", "Portugal"],
    ["Farid Al Maz", "farid@seeker.test", "United Arab Emirates"],
  ] as const;
  const users: Record<string, string> = {};
  for (let i = 0; i < seekers.length; i++) {
    const [name, email, countryName] = seekers[i];
    const created = await prisma.freeUser.create({
      data: { name, email, countryName, phone: `+6000000${100 + i}`, registeredAt: at(-80 + i), lastActivityAt: at(-i), status: i === 15 ? "DELETION_REQUESTED" : "ACTIVE", deletionRequestedAt: i === 15 ? at(-1) : null },
    });
    users[name] = created.id;
  }

  const enquirySeed = [
    ["PROPERTY", "PR0001", "James Wong", "AG-001", daniel.id, "IN_APP", "ANSWERED", "Asked for a Saturday viewing."],
    ["PROPERTY", "PR0002", "Nadia Khan", "AG-001", null, "CALL_REQUEST", "UNANSWERED", "Requested a call about the price."],
    ["PROPERTY", "PR0003", "Alex Chen", "AG-001", priya.id, "CONVERSATION", "ASSIGNED", "Started a conversation about an offer."],
    ["PROPERTY", "PR0001", "Jason Tan", "AG-001", daniel.id, "CONTACT_TAP", "NEW", "Tapped the contact button."],
    ["PROPERTY", "PR0010", "Sofia Almeida", "AG-002", lisbonAgent.id, "IN_APP", "ANSWERED", "Asked if the rent includes parking."],
    ["PROPERTY", "PR0011", "Layla Farouk", "AG-003", palmAgent.id, "IN_APP", "NEW", "Asked for the service charge."],
    ["PROPERTY", "PR0014", "Adam Cole", "AG-005", harbourAgent.id, "CALL_REQUEST", "UNANSWERED", "Requested a call this week."],
    ["REEL", "PR0001", "Mei Lin", "AG-001", daniel.id, "IN_APP", "NEW", "Enquiry started from the Palm Villas reel."],
    ["PROPERTY", "PR0012", "Farid Al Maz", "AG-003", palmAgent.id, "CONVERSATION", "ASSIGNED", "Wants a video call before travelling."],
    ["PROPERTY", "PR0002", "Aisha Noor", "AG-001", marcus.id, "IN_APP", "CLOSED", "Already viewed another unit."],
  ] as const;
  for (let i = 0; i < enquirySeed.length; i++) {
    const [source, ref, person, code, agentId, channel, status, summary] = enquirySeed[i];
    const createdAt = at(-i, 9, 15);
    await prisma.enquiry.create({
      data: {
        source, propertyId: properties[ref].id, freeUserId: users[person], agencyId: agencies[code].id, agentId,
        channel: channel as any, status: status as any, summary, createdAt,
        respondedAt: status === "ANSWERED" || status === "CLOSED" ? new Date(createdAt.getTime() + 90 * 60000) : null,
      },
    });
  }

  await prisma.offer.create({ data: { propertyId: properties.PR0003.id, freeUserId: users["Alex Chen"], agencyId: agencies["AG-001"].id, amount: 1780000, currency: "MYR", status: "ACCEPTED", createdAt: at(-2) } });
  await prisma.offer.create({ data: { propertyId: properties.PR0002.id, freeUserId: users["Jason Tan"], agencyId: agencies["AG-001"].id, amount: 2700000, currency: "MYR", status: "SUBMITTED", createdAt: at(-1) } });
  await prisma.offer.create({ data: { propertyId: properties.PR0012.id, freeUserId: users["Layla Farouk"], agencyId: agencies["AG-003"].id, amount: 17000000, currency: "AED", status: "ACKNOWLEDGED", createdAt: at(-3) } });
  await prisma.offer.create({ data: { propertyId: properties.PR0014.id, freeUserId: users["Emma Brooks"], agencyId: agencies["AG-005"].id, amount: 1680000, currency: "GBP", status: "DECLINED", createdAt: at(-8) } });
  await prisma.offer.create({ data: { propertyId: properties.PR0010.id, freeUserId: users["Hugo Martins"], agencyId: agencies["AG-002"].id, amount: 2200, currency: "EUR", status: "WITHDRAWN", createdAt: at(-5) } });

  const appointmentSeed = [
    ["VIEWING", "PR0001", "James Wong", "AG-001", daniel.id, 0, 9, 30, "CONFIRMED", "Asia/Kuala_Lumpur"],
    ["VIEWING", "PR0002", "Nadia Khan", "AG-001", marcus.id, 0, 11, 0, "REQUESTED", "Asia/Kuala_Lumpur"],
    ["VIDEO_CALL", "PR0003", "Alex Chen", "AG-001", priya.id, 0, 14, 30, "CONFIRMED", "Asia/Kuala_Lumpur"],
    ["OFFICE", "PR0014", "Adam Cole", "AG-005", harbourAgent.id, 1, 15, 0, "RESCHEDULE_PROPOSED", "Europe/London"],
    ["VIEWING", "PR0011", "Layla Farouk", "AG-003", palmAgent.id, -1, 17, 0, "COMPLETED", "Asia/Dubai"],
    ["VIEWING", "PR0010", "Sofia Almeida", "AG-002", lisbonAgent.id, -2, 11, 0, "NO_SHOW", "Europe/Lisbon"],
    ["VIDEO_CALL", "PR0001", "Mei Lin", "AG-001", daniel.id, 2, 16, 0, "REQUESTED", "Asia/Kuala_Lumpur"],
  ] as const;
  for (const row of appointmentSeed) {
    const [kind, ref, person, code, agentId, dayOffset, hours, minutes, status, timezone] = row;
    await prisma.appointment.create({
      data: { kind: kind as any, propertyId: properties[ref].id, freeUserId: users[person], agencyId: agencies[code].id, agentId, startsAt: at(dayOffset, hours, minutes), timezone, status: status as any },
    });
  }

  await prisma.outcomeReport.create({ data: { propertyId: properties.PR0009.id, agencyId: agencies["AG-002"].id, outcome: "SOLD", statusDate: at(-12), advertisedDays: 46, leadAttributedToPlaceIn: true, note: "Buyer first enquired in the app." } });
  await prisma.outcomeReport.create({ data: { propertyId: properties.PR0008.id, agencyId: agencies["AG-001"].id, outcome: "LET", statusDate: at(-6), advertisedDays: 21, leadAttributedToPlaceIn: false, note: "Existing landlord referral." } });
  await prisma.outcomeReport.create({ data: { propertyId: properties.PR0007.id, agencyId: agencies["AG-001"].id, outcome: "WITHDRAWN", statusDate: at(-3), advertisedDays: 15, leadAttributedToPlaceIn: null, note: "Owner paused the sale." } });

  const month = `${at(0).getFullYear()}-${String(at(0).getMonth() + 1).padStart(2, "0")}`;
  const previous = `${at(-32).getFullYear()}-${String(at(-32).getMonth() + 1).padStart(2, "0")}`;
  async function invoice(code: string, number: string, billingMonth: string, amount: number, status: any, paid: number) {
    const row = await prisma.invoice.create({
      data: { number, agencyId: agencies[code].id, billingMonth, amount, currency: agencies[code].currency, dueDate: at(status === "OVERDUE" ? -8 : 10), amountPaid: paid, status },
    });
    if (paid > 0) {
      await prisma.paymentAttempt.create({ data: { invoiceId: row.id, providerRef: `pay_${number}`, status: "SUCCESS", amount: paid } });
    }
    if (status === "OVERDUE") {
      await prisma.paymentAttempt.create({ data: { invoiceId: row.id, providerRef: `fail_${number}`, status: "FAILED", amount, failureReason: "Card declined" } });
    }
    return row;
  }
  await invoice("AG-001", "INV-2026-0901", previous, 499, "PAID", 499);
  await invoice("AG-001", "INV-2026-1001", month, 499, "UNPAID", 0);
  await invoice("AG-002", "INV-2026-1002", month, 249, "PAID", 249);
  await invoice("AG-003", "INV-2026-1003", month, 899, "PARTIALLY_PAID", 400);
  await invoice("AG-005", "INV-2026-1005", month, 99, "OVERDUE", 0);
  await invoice("AG-004", "INV-2026-1004", month, 0, "VOID", 0);

  const ticket = await prisma.supportTicket.create({
    data: {
      number: "SUP1042", requesterType: "AGENCY", agencyId: agencies["AG-001"].id, category: "Technical", priority: "HIGH", status: "IN_PROGRESS",
      subject: "Video still processing after upload", assigneeId: tech.id,
      messages: { create: [{ authorName: "Sarah Lim", body: "A completed reel has been waiting in processing since this morning." }] },
      notes: { create: [{ authorId: tech.id, authorName: tech.name, body: "Queue delay confirmed. Drafts are retained. Not sent to the agency." }] },
    },
  });
  await prisma.supportTicket.create({
    data: {
      number: "SUP1048", requesterType: "FREE_USER", freeUserId: users["Jason Tan"], category: "Account", priority: "NORMAL", status: "OPEN",
      subject: "Cannot update saved searches", assigneeId: support.id,
      messages: { create: [{ authorName: "Jason Tan", body: "Saved searches disappear after I sign out." }] },
    },
  });
  await prisma.supportTicket.create({
    data: {
      number: "SUP1051", requesterType: "AGENCY", agencyId: agencies["AG-005"].id, category: "Billing", priority: "HIGH", status: "AWAITING_CUSTOMER",
      subject: "Invoice looks overdue after a failed card", assigneeId: support.id,
      messages: { create: [{ authorName: "James Wright", body: "The card was replaced. Please confirm the invoice." }] },
    },
  });

  await prisma.moderationItem.create({ data: { queue: "CONTENT_REVIEW", priority: "Normal", subject: "Garden Terrace", reason: "Description needs the tenure", entityType: "property", entityId: properties.PR0006.id, agencyId: agencies["AG-001"].id } });
  await prisma.moderationItem.create({ data: { queue: "QUALITY_FAILURE", priority: "High", subject: "Seaview Penthouse", reason: "Cover photo is 800×600, below 1600×1200", entityType: "property", entityId: properties.PR0005.id, agencyId: agencies["AG-001"].id } });
  await prisma.moderationItem.create({ data: { queue: "AGENCY_VERIFICATION", priority: "Normal", subject: "Riviera Estates", reason: "Company documents not checked", entityType: "agency", entityId: agencies["AG-004"].id, agencyId: agencies["AG-004"].id } });
  await prisma.moderationItem.create({ data: { queue: "USER_REPORT", priority: "High", subject: "Shibuya Residence", reason: "Listing price does not match the photos", entityType: "property", entityId: properties.PR0016.id, agencyId: agencies["AG-006"].id, decision: "TAKEN_DOWN", decisionReason: "Removed while the agency confirms the price", decidedAt: at(-4) } });
  await prisma.moderationItem.create({ data: { queue: "APPEAL", priority: "Normal", subject: "Shibuya Residence appeal", reason: "Agency says the price is correct", entityType: "property", entityId: properties.PR0016.id, agencyId: agencies["AG-006"].id } });
  await prisma.moderationItem.create({ data: { queue: "CONTENT_REVIEW", priority: "Normal", subject: "Master bedroom tour", reason: "Reel submitted", entityType: "reel", entityId: (await prisma.reel.findFirst({ where: { caption: "Master bedroom tour" } }))!.id, agencyId: agencies["AG-001"].id } });

  await prisma.platformSetting.create({
    data: {
      id: "default", mediaMinWidth: 1600, mediaMinHeight: 1200, maxVideoMb: 200, reportingCurrency: "GBP",
      fxRates: { GBP: 1, MYR: 5.6, EUR: 1.17, AED: 4.7, JPY: 190, USD: 1.27 },
      privacyPolicyVersion: "2026-08-01",
      integrations: { appStore: "connected", googlePlay: "connected", paymentProvider: "manual-ledger", email: "local-only", push: "not-connected" },
      billingRules: {
        trialDays: "14",
        onTrialExpiry: "Subscription becomes PAST_DUE. New publication is blocked. Existing live listings stay up. Free users are never billed.",
        onOverdue: "After the due date with no successful payment, the invoice becomes OVERDUE and new publication is blocked.",
        commission: "PlaceIn does not charge commission.",
      },
      effectiveOn: at(-30),
    },
  });

  const templates = [
    ["enquiry.received", "EMAIL", "New enquiry", "A property seeker enquired about {{property}}."],
    ["appointment.booked", "PUSH", "Appointment booked", "A {{kind}} is booked for {{when}} ({{timezone}})."],
    ["approval.decision", "IN_APP", "Review decision", "Your submission was {{decision}}. {{reason}}"],
    ["upload.failed", "EMAIL", "Upload needs attention", "Upload {{reference}} failed. {{detail}}"],
    ["invoice.due", "EMAIL", "Invoice {{number}}", "Amount due {{amount}} {{currency}} by {{due}}."],
    ["payment.reminder", "EMAIL", "Payment reminder", "Invoice {{number}} is still open."],
  ] as const;
  for (const [key, channel, subject, body] of templates) {
    await prisma.notificationTemplate.create({ data: { key, channel, subject, body } });
  }
  await prisma.announcement.create({ data: { title: "September product note", body: "Reported outcomes are now separate from offers.", channel: "IN_APP", audience: "All agencies", status: "SENT", delivered: 48, failed: 0, createdAt: at(-20) } });
  await prisma.announcement.create({ data: { title: "Media processing delay", body: "Some reels are waiting in the processing queue. Drafts are retained.", channel: "EMAIL", audience: "Agencies with failed uploads", status: "DRAFT" } });

  await prisma.serviceStatus.createMany({ data: [
    { name: "Consumer app", status: "OPERATIONAL", detail: "240 ms" },
    { name: "Agency portal", status: "OPERATIONAL", detail: "180 ms" },
    { name: "Head-office portal", status: "OPERATIONAL", detail: "160 ms" },
    { name: "Media processing", status: "DEGRADED", detail: "Queue: 48 jobs" },
    { name: "Notifications", status: "OPERATIONAL", detail: "Queue: 128 messages" },
    { name: "Authentication", status: "OPERATIONAL", detail: "120 ms" },
  ] });
  await prisma.appError.createMany({ data: [
    { reference: "ERR041", platform: "Android", appVersion: "2.4.1", category: "Video playback", severity: "Medium", occurrences: 42, lastSeen: at(0, 11, 52) },
    { reference: "ERR042", platform: "iOS", appVersion: "2.4.0", category: "Upload processing", severity: "High", occurrences: 31, lastSeen: at(0, 11, 48) },
    { reference: "ERR043", platform: "Android", appVersion: "2.4.1", category: "Appointment loading", severity: "Low", occurrences: 18, lastSeen: at(0, 11, 40) },
  ] });
  await prisma.uploadJob.createMany({ data: [
    { reference: "RE003", status: "FAILED", progress: 0, detail: "Processing failed", retryEligible: true },
    { reference: "RE201", status: "FAILED", progress: 0, detail: "Resolution below minimum", retryEligible: false },
    { reference: "VD301", status: "PROCESSING", progress: 62, detail: "Transcoding", retryEligible: false },
  ] });
  await prisma.backupStatus.createMany({ data: [
    { label: "Last backup", value: "Today 02:00 local", ok: true },
    { label: "Last restore test", value: "15 September 2026", ok: true },
    { label: "Retention", value: "Configured", ok: true },
    { label: "Recovery runbook", value: "Available", ok: true },
  ] });
  await prisma.incident.create({
    data: {
      reference: "INC003", service: "Media processing", severity: "HIGH", status: "Investigating",
      summary: "Media processing delay", symptom: "Some completed uploads are waiting for video processing.",
      impact: "Drafts retained; publication delayed.", assignee: "Technical lead", ticketNumber: ticket.number, uploadReference: "RE003", openedAt: at(0, 10, 35),
    },
  });

  const metricRows = [];
  for (let offset = 29; offset >= 0; offset--) {
    for (const code of ["MY", "PT", "AE", "ES", "GB", "JP"]) {
      const weight = code === "MY" ? 1.5 : code === "GB" ? 1.15 : code === "AE" ? 1 : 0.7;
      const wave = 1 + ((29 - offset) % 7) / 10;
      metricRows.push({
        date: utcDay(offset), countryCode: code,
        downloadsIos: Math.round(40 * weight * wave), downloadsAndroid: Math.round(55 * weight * wave),
        registrations: Math.round(25 * weight), logins: Math.round(80 * weight * wave), guestUsers: Math.round(30 * weight),
        dau: Math.round(220 * weight * wave), sessions: Math.round(340 * weight), avgSessionSec: 260,
        propertyViews: Math.round(900 * weight * wave), reelPlays: Math.round(1400 * weight), watchTimeSec: Math.round(8000 * weight),
        completions: Math.round(400 * weight), likes: Math.round(120 * weight), saves: Math.round(40 * weight),
        enquiries: Math.round(18 * weight), offers: Math.round(4 * weight), bookings: Math.round(6 * weight), searches: Math.round(300 * weight),
      });
    }
  }
  await prisma.dailyMetric.createMany({ data: metricRows });

  await prisma.metricDefinition.createMany({ data: [
    { key: "downloads", title: "Downloads", definition: "Installs imported from App Store and Google Play reports. Separate from registered accounts and active users.", source: "Store reports" },
    { key: "logins", title: "Logged-in users", definition: "Unique authenticated users in the period. Not the number of login events.", source: "Authentication events" },
    { key: "active", title: "Active users", definition: "Registered users with a qualifying foreground action. Guest users are estimated separately.", source: "App activity" },
    { key: "time", title: "Time spent", definition: "Foreground active use. Time while the app is open in the background is excluded.", source: "Session timer" },
    { key: "views", title: "Views and plays", definition: "A view or play must pass the threshold. Retries, internal previews and known automated traffic are excluded.", source: "Content events" },
    { key: "calls", title: "Calls", definition: "Contact taps and call requests. A call is completed only when an integration or an explicit report confirms it.", source: "Contact events" },
    { key: "offers", title: "Offers", definition: "Submitted in the consumer app and answered in the agency portal. Acceptance does not sell the property.", source: "Offer records" },
    { key: "outcomes", title: "Sold and let", definition: "Agency status updates with a reporting date and correction history. The transaction happens outside PlaceIn.", source: "Outcome reports" },
  ] });

  await prisma.auditLog.createMany({ data: [
    { actorName: "Daniel Tan", actorRole: "AGENT", action: "PROPERTY_STATUS", entityType: "property", entityId: properties.PR0008.id, detail: "Daniel Tan marked Mont Kiara Studio as let.", createdAt: at(0, 14, 20) },
    { actorName: "Ahad", actorRole: "SUPER_ADMIN", action: "PAYMENT_RECORDED", entityType: "invoice", detail: "September invoice INV-2026-0901 paid.", createdAt: at(0, 15, 10) },
    { actorName: "Sarah Lim", actorRole: "OWNER", action: "REEL_CREATED", entityType: "reel", detail: "Sarah Lim uploaded a new reel.", createdAt: at(-1, 16, 5) },
    { actorName: "Ahad", actorRole: "SUPER_ADMIN", action: "AGENT_UPDATED", entityType: "agent", entityId: marcus.id, detail: "Permissions updated for Marcus Lee.", createdAt: at(-1, 11, 40) },
  ] });

  console.log("Seeded PlaceIn.");
  console.log("Super admin  ahad@placein.com");
  console.log("Support      support@placein.com");
  console.log("Maintenance  tech@placein.com");
  console.log("Agency owner sarah@aminaproperties.my");
  console.log("Password     " + password);
  console.log("Invite token invite-aisyah-demo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
