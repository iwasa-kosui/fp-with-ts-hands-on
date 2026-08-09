import type { ReactElement } from "react";

export type IconName =
  | "activity"
  | "calendar"
  | "dashboard"
  | "events"
  | "followUp"
  | "logout"
  | "menu"
  | "owners"
  | "paw"
  | "plus"
  | "reception"
  | "users";

const paths: Readonly<Record<IconName, ReactElement>> = {
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  calendar: <path d="M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  dashboard: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  events: <path d="M5 4h14v16H5V4Zm3 4h8m-8 4h8m-8 4h5" />,
  followUp: <path d="M4 5h16v11H8l-4 4V5Zm4 4h8m-8 3h5" />,
  logout: <path d="M10 5H5v14h5m4-10 4 3-4 3m-7-3h11" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  owners: <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m6-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  paw: <path d="M12 14c-2.9-3-7-1.4-7 2.1 0 2.5 3.1 3.5 7 4.8 3.9-1.3 7-2.3 7-4.8 0-3.5-4.1-5.1-7-2.1ZM7.2 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm3.2-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4.2 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm2.3 2.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  plus: <path d="M12 5v14m-7-7h14" />,
  reception: <path d="M6 4h12v16H6V4Zm3-2h6v4H9V2Zm0 8h6m-6 4h6m-6 4h4" />,
  users: <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m14-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
};

export const Icon = ({ name }: Readonly<{ name: IconName }>): ReactElement => (
  <svg
    aria-hidden="true"
    className="icon"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    {paths[name]}
  </svg>
);
