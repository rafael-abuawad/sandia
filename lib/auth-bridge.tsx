"use client";

import { createContext, useContext } from "react";

export type AuthBridgeValue = {
  ready: boolean;
  authenticated: boolean;
  email?: string;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthBridgeContext = createContext<AuthBridgeValue | null>(null);

export function AuthBridgeProvider({
  value,
  children,
}: {
  value: AuthBridgeValue;
  children: React.ReactNode;
}) {
  return <AuthBridgeContext.Provider value={value}>{children}</AuthBridgeContext.Provider>;
}

export function useAppAuth(): AuthBridgeValue {
  const value = useContext(AuthBridgeContext);
  if (!value) {
    throw new Error("Auth bridge is missing");
  }
  return value;
}
