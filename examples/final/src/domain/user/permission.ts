import type { User } from "./user.js";

const isAdmin = (user: User) => user.kind === "Admin";

const canManageUsers = (user: User): boolean => isAdmin(user);
const canStartExamination = (user: User): boolean =>
  user.kind === "Admin" || user.kind === "Veterinarian";
const canRecordExamResult = (user: User): boolean =>
  user.kind === "Admin" || user.kind === "Veterinarian";
const canManageClinic = (user: User): boolean =>
  user.kind === "Admin" || user.kind === "Receptionist";
const canViewEvents = (user: User): boolean => isAdmin(user);

export const Permission = {
  isAdmin,
  canManageUsers,
  canStartExamination,
  canRecordExamResult,
  canManageClinic,
  canViewEvents,
} as const;
