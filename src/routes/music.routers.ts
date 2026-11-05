import { Router } from "express"
import { getTrending, searchMusic } from "../controllers/music.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

router.get("/search", searchMusic)
router.get("/trending", getTrending)

export default router
