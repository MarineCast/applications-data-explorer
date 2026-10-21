import { createContext } from 'react';

export const MapWarningsContext = createContext<{
  host: HTMLDivElement | null;
  setHost: (host: HTMLDivElement | null) => void;
} | undefined>(undefined);
