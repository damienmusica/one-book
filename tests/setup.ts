import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL auto-cleanup needs a global afterEach; vitest runs without globals here,
// so register it explicitly or DOM accumulates across tests.
afterEach(cleanup);
