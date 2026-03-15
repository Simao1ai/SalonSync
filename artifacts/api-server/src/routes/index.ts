import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import locationsRouter from "./locations";
import usersRouter from "./users";
import servicesRouter from "./services";
import appointmentsRouter from "./appointments";
import availabilityRouter from "./availability";
import reviewsRouter from "./reviews";
import analyticsRouter from "./analytics";
import giftCardsRouter from "./gift-cards";
import notificationsRouter from "./notifications";
import aiRouter from "./ai";
import anthropicRouter from "./anthropic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(locationsRouter);
router.use(usersRouter);
router.use(servicesRouter);
router.use(appointmentsRouter);
router.use(availabilityRouter);
router.use(reviewsRouter);
router.use(analyticsRouter);
router.use(giftCardsRouter);
router.use(notificationsRouter);
router.use(aiRouter);
router.use(anthropicRouter);

export default router;
