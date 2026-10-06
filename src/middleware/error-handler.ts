import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { AppError, NotFoundError } from "../errors/app-error";
import { logger } from "../logger";

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};

// Express 5 forwards rejected promises from async handlers here automatically.
// A database error inside a transaction lands here after the rollback, so a
// 500 means nothing was committed (design.md › Failure handling).
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { status, body } = toResponse(err);
  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled error");
  }
  res.status(status).json(body);
};

function toResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: err.issues.map(({ path, message, code }) => ({ path, message, code })),
        },
      },
    };
  }

  // Malformed JSON body from express.json()
  if (isBodyParserError(err)) {
    return {
      status: err.status,
      body: { error: { code: "INVALID_BODY", message: err.message } },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          env.NODE_ENV === "production"
            ? "Internal server error"
            : err instanceof Error
              ? err.message
              : String(err),
      },
    },
  };
}

function isBodyParserError(err: unknown): err is { status: number; type: string; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  );
}
