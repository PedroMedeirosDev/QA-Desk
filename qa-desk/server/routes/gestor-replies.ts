import { Router } from "express";
import { subscribeGestorRepliesSse } from "../gestor-replies-sse.js";
import { attachUser, requireAdmin } from "../middleware/auth.js";

export const gestorRepliesRouter = Router();

gestorRepliesRouter.use(attachUser);
gestorRepliesRouter.use(requireAdmin);

gestorRepliesRouter.get("/stream", (req, res) => {
  req.socket.setTimeout(0);
  res.setTimeout(0);
  subscribeGestorRepliesSse(res);
});
