import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { router } from "./routes";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
