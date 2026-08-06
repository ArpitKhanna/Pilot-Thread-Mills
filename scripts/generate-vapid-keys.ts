/**
 * Generate VAPID keys for Web Push approval notifications.
 *
 * Usage:
 *   npm run push:generate-vapid-keys
 *
 * Add the output to .env.local and Vercel:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:you@example.com
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nAdd these to .env.local and your deployment environment:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@pilotthreadmills.internal");
console.log("");
