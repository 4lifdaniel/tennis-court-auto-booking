// ============================================================
//  Courtsite.my Midnight Booking Bot — Court 1
//  Usage: node book-courtsite.js
//
//  Run at ~11:50 PM. It waits until midnight, grabs the
//  court, then opens the payment page automatically.
//  Approve payment via Touch 'n Go / GrabPay on your phone.
// ============================================================

// ── CONFIG — only change these ───────────────────────────────

const EMAIL    = "alifdaniel279@gmail.com";
const PASSWORD = "Abcd1234!";  // ← fill this in

// Target date: Courtsite opens bookings 14 days ahead at midnight.
// Tonight at midnight you're booking 14 days from now.
// Format: "YYYY-MM-DD"
const BOOK_DATE      = "2026-01-01";   // ← change each time you run
const START_HOUR     = 12;             // 12 = noon (12:00 PM)
const DURATION_HOURS = 1;              // 1 hour session

// ── END CONFIG — do not edit below ───────────────────────────

const FIREBASE_API_KEY = "AIzaSyDNrencF1-myBWZRLNwPGUhKXdQiUoXyys";
const API              = "https://enjin-api.courtsite.my/graphql";

// Court 1 — extracted from your DevTools
const TENANT_ID   = "clgd4kl4x0ni0079fqbsefbid";
const SERVICE_ID  = "clgd6o6sn0nii079ysnisnpzh";
const RESOURCE_ID = "clgd6kh7u0nhk079ydrqi3cto";

// Your profile — pre-filled from your requests
const YOUR_NAME  = "Alif Daniel Alee Ma-ae";
const YOUR_PHONE = "+60199331054";

// Persisted query hashes — do not change
const HASH_START_CHECKOUT = "4cd6cbaf5f1229a244455710e3d6433d58bb4248cf0adb85e2cbde73972e05ed";
const HASH_PAYMENT        = "ec5df0c24e7e46cadf0d028f2e6a3599a9511ce9e1bef55595a0f6021b75513f";

// ─────────────────────────────────────────────────────────────

function buildSlot(dateStr, startHour, durationHours) {
  const pad = n => String(n).padStart(2, "0");
  const endHour = startHour + durationHours;
  return {
    startDt: `${dateStr}T${pad(startHour)}:00:00.000+08:00`,
    endDt:   `${dateStr}T${pad(endHour)}:00:00.000+08:00`,
  };
}

async function getFirebaseToken() {
  console.log("🔑 Logging in to get fresh token...");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!data.idToken) {
    console.error("\n❌ Login failed:", JSON.stringify(data, null, 2));
    console.error("\nIf you use Google login (no password set), use the workaround:");
    console.error("  1. Open DevTools on courtsite.my at 11:30 PM");
    console.error("  2. Network tab → any graphql request → Headers → copy Authorization value");
    console.error("  3. Replace the getFirebaseToken() call in main() with:");
    console.error('     const token = "eyJhbGci...paste here...";');
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
  if (json.errors) {
    throw new Error(`[${operationName}] ${json.errors[0].message}`);
  }
  return json.data;
}

async function startCheckout(token, slot) {
  console.log(`📋 startCheckout: ${slot.startDt} → ${slot.endDt}`);
  return gql(token, "startCheckout", {
    tenantId: TENANT_ID,
    slots: [{
      startDt:             slot.startDt,
      endDt:               slot.endDt,
      selectedResourceIds: [RESOURCE_ID],
      serviceId:           SERVICE_ID,
      addons:              [],
    }],
    name:        YOUR_NAME,
    phoneNumber: YOUR_PHONE,
    email:       EMAIL,
    addOns:      [],
  }, HASH_START_CHECKOUT);
}

async function initiatePayment(token, workflowID) {
  console.log(`💳 pelangganCheckoutWorkflowPayment: ${workflowID}`);
  return gql(token, "pelangganCheckoutWorkflowPayment",
    { workflowID },
    HASH_PAYMENT
  );
}

function openInBrowser(url) {
  const { exec } = require("child_process");
  exec(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || start "" "${url}"`);
}

function extractWorkflowID(data) {
  return (
    data?.startCheckout?.workflowID ||
    data?.startCheckout?.id          ||
    data?.createCheckout?.workflowID ||
    data?.checkout?.workflowID       ||
    null
  );
}

function extractPaymentUrl(data) {
  const node =
    data?.pelangganCheckoutWorkflowPayment ||
    data?.checkoutWorkflowPayment          ||
    null;
  return node?.paymentUrl || node?.redirectUrl || node?.url || null;
}


// For testing: fires after 5 seconds instead of waiting until midnight
async function waitUntilMidnight() {
  console.log("⚡ TEST MODE — firing in 5 seconds...\n");
  await new Promise(r => setTimeout(r, 5000));
  process.stdout.write("\r🚀 TEST FIRING!          \n\n");
}

// Waits until 12:00:00.050 AM Malaysia Time, then resolves. (Production Use This)
// async function waitUntilMidnight() {
//   const now      = new Date();
//   const midnight = new Date();
//   midnight.setHours(0, 0, 0, 50); // 50ms after midnight
//   if (midnight <= now) midnight.setDate(midnight.getDate() + 1);

//   const waitMs = midnight - now;
//   const myt    = t => t.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: true });
//   console.log(`\n🕐 Now:     ${myt(now)}`);
//   console.log(`🎯 Target:  ${myt(midnight)}`);
//   console.log(`⏳ Waiting  ${(waitMs / 60000).toFixed(1)} minutes...\n`);

//   // Live countdown
//   const iv = setInterval(() => {
//     const s = ((midnight - Date.now()) / 1000).toFixed(0);
//     if (s > 0) process.stdout.write(`\r⏳ ${s}s remaining...   `);
//   }, 1000);

//   await new Promise(r => setTimeout(r, waitMs));
//   clearInterval(iv);
//   process.stdout.write("\r🚀 MIDNIGHT — FIRING!          \n\n");
// }

async function main() {
  console.log("=".repeat(56));
  console.log("  🎾  Courtsite Midnight Booking Bot");
  console.log("=".repeat(56));

  const slot = buildSlot(BOOK_DATE, START_HOUR, DURATION_HOURS);
  console.log(`\n📅 Booking:  ${BOOK_DATE}  ${START_HOUR}:00 – ${START_HOUR + DURATION_HOURS}:00 MYT`);
  console.log(`🏟  Court 1  (${SERVICE_ID})\n`);

  // Log in BEFORE midnight so token is ready instantly at 12:00 AM
  const token = await getFirebaseToken();

  // Sleep until midnight
  await waitUntilMidnight();

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`--- Attempt ${attempt}/3 ---`);

      // Step 1: Reserve the slot
      const checkoutData = await startCheckout(token, slot);
      console.log("\nstartCheckout response:");
      console.log(JSON.stringify(checkoutData, null, 2));

      const workflowID = extractWorkflowID(checkoutData);
      if (!workflowID) {
        console.error("\n⚠️  Could not find workflowID in response above.");
        console.error("Look at the response keys and update extractWorkflowID().");
        process.exit(1);
      }
      console.log(`\n✅ Slot reserved! workflowID: ${workflowID}`);

      // Step 2: Move to payment
      const paymentData = await initiatePayment(token, workflowID);
      console.log("\nPayment response:");
      console.log(JSON.stringify(paymentData, null, 2));

      const paymentUrl  = extractPaymentUrl(paymentData);
      const fallbackUrl = `https://www.courtsite.my/checkout/${workflowID}/payment`;
      const urlToOpen   = paymentUrl || fallbackUrl;

      console.log("\n" + "=".repeat(56));
      console.log("🎉  COURT GRABBED! Pay now before it expires.");
      console.log("=".repeat(56));
      console.log(`\n👉  ${urlToOpen}\n`);
      console.log("→ Select Touch 'n Go or GrabPay");
      console.log("→ Approve the push notification on your phone");
      console.log("→ You have ~10 minutes before checkout expires\n");

      openInBrowser(urlToOpen);
      return;

    } catch (err) {
      lastError = err;
      console.error(`\n❌ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        console.log("Retrying in 300ms...");
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  console.error("\n💀 All 3 attempts failed. Last error:", lastError?.message);
  console.error("\nPossible causes:");
  console.error("  • Slot already full (someone else was faster)");
  console.error("  • Token expired — grab a fresh one from DevTools");
  console.error("  • API response shape changed — check raw output above");
}

main();
