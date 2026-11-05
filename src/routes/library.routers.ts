import { Router } from "express"
import {
    addRecentlyPlayed,
    getLikedSongs,
    getRecentlyPlayed,
    likeSong,
    unlikeSong
} from "../controllers/library.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

router.get("/liked", getLikedSongs)
router.post("/liked", likeSong)
router.delete("/liked/:videoId", unlikeSong)

router.get("/recent", getRecentlyPlayed)
router.post("/recent", addRecentlyPlayed)

export default router
