import { Router } from "express"
import {
    addTrackToPlaylist,
    createPlaylist,
    deletePlaylist,
    getMyPlaylists,
    getPlaylistById,
    removeTrackFromPlaylist,
    updatePlaylist
} from "../controllers/playlist.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

router.get("/", getMyPlaylists)
router.post("/", createPlaylist)
router.get("/:id", getPlaylistById)
router.patch("/:id", updatePlaylist)
router.delete("/:id", deletePlaylist)

router.post("/:id/tracks", addTrackToPlaylist)
router.delete("/:id/tracks/:videoId", removeTrackFromPlaylist)

export default router
