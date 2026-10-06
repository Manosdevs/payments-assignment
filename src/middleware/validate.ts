import type { RequestHandler } from "express";
import type { z } from "zod";

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

/**
 * Validates request parts against zod schemas. Parsed values are stored on
 * `res.locals.validated` (Express 5 makes `req.query` read-only).
 * Validation failures throw a ZodError, handled by the central error handler.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    res.locals.validated = {
      body: schemas.body?.parse(req.body),
      query: schemas.query?.parse(req.query),
      params: schemas.params?.parse(req.params),
    };
    next();
  };
