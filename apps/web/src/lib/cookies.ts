"use client";

import Cookies from "js-cookie";

export const ACTIVE_CLIENT_COOKIE = "tevero-active-client-id";

// Client-side — browser only
export const cookieStorage = {
  getItem: (name: string): string | null => Cookies.get(name) ?? null,
  setItem: (name: string, value: string): void => {
    Cookies.set(name, value, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: 365,
    });
  },
  removeItem: (name: string): void => {
    Cookies.remove(name, { path: "/" });
  },
};
