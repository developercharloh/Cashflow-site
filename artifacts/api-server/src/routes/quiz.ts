import { Router, type Request, type Response } from "express";

const router = Router();

const comingSoon = (_req: Request, res: Response) => {
  res.status(503).json({
    error: "Simple Quiz is coming soon.",
    code: "FEATURE_COMING_SOON",
  });
};

router.get("/quiz/questions", comingSoon);
router.post("/quiz/submit", comingSoon);

export default router;
