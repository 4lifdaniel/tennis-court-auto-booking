// ============================================================
//  Courtsite.my Midnight Booking Bot — All Courts
//  Usage: node book-courtsite.js
//
//  Run at ~11:50 PM. Waits until midnight, tries ALL courts
//  simultaneously, books the first available one, then opens
//  the payment page. Approve via Touch 'n Go / GrabPay.
// ============================================================

// ── CONFIG — only change these ───────────────────────────────

const EMAIL    = "email";
const PASSWORD = "password";  // ← fill this in

// Target date: Courtsite opens 14 days ahead at midnight.
// Format: "YYYY-MM-DD"
const BOOK_DATE      = "2026-07-04";   // ← change each time you run
const START_HOUR     = 17;             // 12 = noon (12:00 PM)
const DURATION_HOURS = 2;              // 2 hour session

// ── END CONFIG — do not edit below ───────────────────────────

const FIREBASE_API_KEY = "AIzaSyDNrencF1-myBWZRLNwPGUhKXdQiUoXyys";
const API              = "https://enjin-api.courtsite.my/graphql";
const TENANT_ID        = "clgd4kl4x0ni0079fqbsefbid";

// All courts — add more here if you find more IDs
const COURTS = [
  { name: "Court 1 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6kh7u0nhk079ydrqi3cto" },
  { name: "Court 2 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6kyzy0nhn079yax8o86i5" },
  { name: "Court 3 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6kx9j0og1079fmruwft9i" },
  { name: "Court 4 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6l6mu0p0z077n42l1gem8" },
  { name: "Court 5 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6l97c0p10077n2hevy7zf" },
  { name: "Court 6 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6lbub0nxq077zsf76poyl" },
  { name: "Court 7 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6lg6m0nxr077z4mddpdne" },
  { name: "Court 8 (Outdoor)", serviceId: "clgd6o6sn0nii079ysnisnpzh", resourceId: "clgd6limf0nho079yzb1kzhcw" },
  { name: "Court A (Indoor)",  serviceId: "clgd6mzl60oh3079fd6otah0f", resourceId: "clgd63pmk0o8c079f3epq70mt" },
  { name: "Court B (Indoor)",  serviceId: "clgd6mzl60oh3079fd6otah0f", resourceId: "clgd66owr0n94079y5zzmu56a" },
  { name: "Court C (Indoor)",  serviceId: "clgd6mzl60oh3079fd6otah0f", resourceId: "clgd66s4a0otz077n3ogtmbem" },
];

// Your profile
const YOUR_NAME  = "Alif Daniel";
const YOUR_PHONE = "0199331054";

// Persisted query hashes — do not change
const HASH_START_CHECKOUT = "4cd6cbaf5f1229a244455710e3d6433d58bb4248cf0adb85e2cbde73972e05ed";
const HASH_PAYMENT        = "ec5df0c24e7e46cadf0d028f2e6a3599a9511ce9e1bef55595a0f6021b75513f";

// ─────────────────────────────────────────────────────────────

function buildSlot(dateStr, startHour, durationHours) {
  const pad = n => String(n).padStart(2, "0");
  return {
    startDt: `${dateStr}T${pad(startHour)}:00:00.000+08:00`,
    endDt:   `${dateStr}T${pad(startHour + durationHours)}:00:00.000+08:00`,
  };
}

async function getFirebaseToken() {
  console.log("🔑 Logging in to get fresh token...");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://www.courtsite.my/",
        "Origin": "https://www.courtsite.my",
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) {
    console.error("\n❌ Login failed:", JSON.stringify(data, null, 2));
    console.error("\nWorkaround: grab token from DevTools at 11:30 PM and hardcode it:");
    console.error('  const token = "eyJhbGci...paste here...";');
    process.exit(1);
  }
  console.log("✅ Logged in successfully");
  return data.idToken;
}

async function gql(token, operationName, variables, sha256Hash) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Firebase ${token}`,
      "accept": "*/*",
    },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`[${operationName}] ${json.errors[0].message}`);
  return json.data;
}

async function tryBookCourt(token, court, slot) {
  console.log(`  📋 Trying ${court.name}...`);
  const data = await gql(token, "startCheckout", {
    tenantId: TENANT_ID,
    slots: [{
      startDt:             slot.startDt,
      endDt:               slot.endDt,
      selectedResourceIds: [court.resourceId],
      serviceId:           court.serviceId,
      addons:              [],
    }],
    name:        YOUR_NAME,
    phoneNumber: YOUR_PHONE,
    email:       EMAIL,
    addOns:      [],
  }, HASH_START_CHECKOUT);

  const typename = data?.startCourtsiteCheckout?.__typename || "";
  if (typename.includes("Unavailable") || typename.includes("unavailable")) {
    throw new Error(`${court.name} unavailable`);
  }

  const workflowID =
    data?.startCourtsiteCheckout?.state?.id ||
    data?.startCourtsiteCheckout?.workflowID ||
    data?.startCourtsiteCheckout?.id ||
    null;

  if (!workflowID) {
    console.log("  Raw response:", JSON.stringify(data, null, 2));
    throw new Error(`${court.name}: could not extract workflowID`);
  }

  return { court, workflowID };
}

async function initiatePayment(token, workflowID) {
  return gql(token, "pelangganCheckoutWorkflowPayment", { workflowID }, HASH_PAYMENT);
}

function openInBrowser(url) {
  const { exec } = require("child_process");
  exec(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || start "" "${url}"`);
}

function extractPaymentUrl(data) {
  const node = data?.pelangganCheckoutWorkflowPayment || data?.checkoutWorkflowPayment || null;
  return node?.paymentUrl || node?.redirectUrl || node?.url || null;
}

// For testing: fires after 5 seconds instead of waiting until midnight
// async function waitUntilMidnight() {
//   console.log("⚡ TEST MODE — firing in 5 seconds...\n");
//   await new Promise(r => setTimeout(r, 5000));
//   process.stdout.write("\r🚀 TEST FIRING!          \n\n");
// }

//Use this for production — waits until midnight
async function waitUntilMidnight() {
  const now      = new Date();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 50);
  if (midnight <= now) midnight.setDate(midnight.getDate() + 1);

  const waitMs = midnight - now;
  const myt    = t => t.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: true });
  console.log(`\n🕐 Now:     ${myt(now)}`);
  console.log(`🎯 Target:  ${myt(midnight)}`);
  console.log(`⏳ Waiting  ${(waitMs / 60000).toFixed(1)} minutes...\n`);

  const iv = setInterval(() => {
    const s = ((midnight - Date.now()) / 1000).toFixed(0);
    if (s > 0) process.stdout.write(`\r⏳ ${s}s remaining...   `);
  }, 1000);

  await new Promise(r => setTimeout(r, waitMs));
  clearInterval(iv);
  process.stdout.write("\r🚀 MIDNIGHT — FIRING!          \n\n");
}

async function main() {
  console.log("=".repeat(56));
  console.log("  🎾  Courtsite Midnight Booking Bot");
  console.log("=".repeat(56));

  const slot = buildSlot(BOOK_DATE, START_HOUR, DURATION_HOURS);
  console.log(`\n📅 Booking:  ${BOOK_DATE}  ${START_HOUR}:00 – ${START_HOUR + DURATION_HOURS}:00 MYT`);
  console.log(`🏟  Trying ${COURTS.length} courts: ${COURTS.map(c => c.name).join(", ")}\n`);

  const token = await getFirebaseToken();
  await waitUntilMidnight();

  // Try all courts simultaneously — first one to succeed wins
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`--- Attempt ${attempt}/3 — racing all courts simultaneously ---`);

    try {
      // Fire all court bookings at the exact same time
      const result = await Promise.any(
        COURTS.map(court => tryBookCourt(token, court, slot))
      );

      console.log(`\n✅ ${result.court.name} secured! workflowID: ${result.workflowID}`);

      // Move to payment
      console.log("💳 Initiating payment...");
      const paymentData = await initiatePayment(token, result.workflowID);

      const paymentUrl  = extractPaymentUrl(paymentData);
      const fallbackUrl = `https://www.courtsite.my/checkout/${result.workflowID}/payment`;
      const urlToOpen   = paymentUrl || fallbackUrl;

      console.log("\n" + "=".repeat(56));
      console.log(`🎉  ${result.court.name} BOOKED! Pay now before it expires.`);
      console.log("=".repeat(56));
      console.log(`\n👉  ${urlToOpen}\n`);
      console.log("→ Select Touch 'n Go or GrabPay");
      console.log("→ Approve the push notification on your phone");
      console.log("→ You have ~10 minutes before checkout expires\n");

      openInBrowser(urlToOpen);
      return;

    } catch (err) {
      // Promise.any throws AggregateError if ALL courts failed
      const messages = err.errors
        ? err.errors.map(e => e.message).join(" | ")
        : err.message;
      console.error(`\n❌ Attempt ${attempt} failed: ${messages}`);
      if (attempt < 3) {
        console.log("Retrying in 300ms...");
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  console.error("\n💀 All attempts failed on all courts.");
  console.error("  • Slots may already be fully taken");
  console.error("  • Token may have expired — grab a fresh one from DevTools");
}

main();