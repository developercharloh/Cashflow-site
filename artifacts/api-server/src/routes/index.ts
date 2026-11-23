import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import quizRouter from "./quiz";
import dashboardRouter from "./dashboard";
import tasksRouter from "./tasks";
import walletRouter from "./wallet";
import referralsRouter from "./referrals";
import notificationsRouter from "./notifications";
import leaderboardRouter from "./leaderboard";
import adminRouter from "./admin";
import paystackRouter from "./paystack";
import payheroRouter from "./payhero";
import binaryRouter from "./binary";
import kycRouter from "./kyc";
import workSubmissionsRouter from "./work-submissions";
import taskSourcesRouter from "./task-sources";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(quizRouter);
router.use(dashboardRouter);
router.use(tasksRouter);
router.use(walletRouter);
router.use(referralsRouter);
router.use(notificationsRouter);
router.use(leaderboardRouter);
router.use(adminRouter);
router.use(payheroRouter);
router.use(paystackRouter);
router.use(binaryRouter);
router.use(kycRouter);
router.use(workSubmissionsRouter);
router.use(taskSourcesRouter);

export default router;
