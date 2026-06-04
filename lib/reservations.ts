/* Reservation & booking handoffs. We pre-fill as much as a deep link allows so
 * it's one tap to confirm. The final confirm step is a deliberate SEAM: a
 * browser-automation agent can later consume `toAgentTask` to actually
 * complete the booking without any caller changing. OpenTable/Resy have no open
 * booking API, so a pre-filled handoff is the honest ceiling for a web app. */

export type ReservationRequest = {
  place: string;
  city?: string;
  area?: string;
  date?: string;   // YYYY-MM-DD
  time?: string;   // HH:mm (24h)
  party?: number;
};

/* OpenTable accepts a search deep link with term + covers + dateTime that lands
 * the user on the restaurant with the slot pre-selected. */
export function buildReservationUrl(req: ReservationRequest): { url: string; provider: string } {
  const term = [req.place, req.city].filter(Boolean).join(" ").trim();
  const params = new URLSearchParams();
  if (term) params.set("term", term);
  if (req.party && req.party > 0) params.set("covers", String(req.party));
  if (req.date && req.time) params.set("dateTime", `${req.date}T${req.time}`);
  return { url: `https://www.opentable.com/s?${params.toString()}`, provider: "OpenTable" };
}

/* The agent seam. This typed contract is what a future browser agent would
 * receive to finish the booking; today it just carries the pre-filled URL. */
export type AgentBookingTask = {
  type: "reservation";
  request: ReservationRequest;
  handoffUrl: string;
};
export function toAgentTask(req: ReservationRequest): AgentBookingTask {
  return { type: "reservation", request: req, handoffUrl: buildReservationUrl(req).url };
}
