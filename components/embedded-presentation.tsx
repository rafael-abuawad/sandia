"use client";

import { createContext, useContext } from "react";

/**
 * True inside a dialog or drawer. Page forms pin their action bar above the mobile tab bar;
 * inside a sheet there is no tab bar, so they render the bar in normal flow instead.
 */
const EmbeddedPresentationContext = createContext(false);

export const EmbeddedPresentation = EmbeddedPresentationContext.Provider;

export function useEmbeddedPresentation(): boolean {
  return useContext(EmbeddedPresentationContext);
}
