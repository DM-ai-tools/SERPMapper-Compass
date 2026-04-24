/**
 * https://trafficradius.com.au/contact-us/ — “Free audit” (header / processing), “Book a free strategy call” (home + report).
 * Server email CTA: override LEAD_CTA_BASE_URL in env (defaults to the same).
 */
export const TRAFFIC_RADIUS_CONTACT_URL = "https://trafficradius.com.au/contact-us/";

/** Primary Compass form — visible on the home / check card */
export const CTA_GET_REPORT = "Get my report";
/** Top nav + processing — Traffic Radius lead */
export const CTA_FREE_AUDIT = "Free audit";
/** Secondary — phone consult */
export const CTA_BOOK_STRATEGY_CALL = "Book a free strategy call";

/** Base without trailing slash (append `?query=...`). */
export const TRAFFIC_RADIUS_CONTACT_BASE = TRAFFIC_RADIUS_CONTACT_URL.replace(/\/$/, "");
