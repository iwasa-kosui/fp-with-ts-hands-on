export type BookingChannel = "web" | "phone" | "walkIn";

export const isBookedOnWeb = (channel: BookingChannel): boolean =>
  channel === "web";
