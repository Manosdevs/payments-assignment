import pino from "pino";
import { env } from "./config/env";

// Silent under Jest so test output stays readable; JSON logs everywhere else.
export const logger = pino({ level: env.NODE_ENV === "test" ? "silent" : "info" });
