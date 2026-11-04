import { Response } from "express"
import { UserModel } from "../models/user.model"
import { AuthRequest } from "../middleware/auth"
import { parseTrack } from "../util/track"

const MAX_RECENT = 20

export const getLikedSongs = async (req: AuthRequest, res: Response) => {
    try {
        const user = await UserModel.findById(req.user?.sub).select("likedSongs")
        if (!user) return res.status(404).json({ message: "User not found" })

        res.status(200).json({ data: user.likedSongs })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const likeSong = async (req: AuthRequest, res: Response) => {
    try {
        const track = parseTrack(req.body)
        if (!track) return res.status(400).json({ message: "Invalid track" })

        await UserModel.updateOne(
            { _id: req.user?.sub, "likedSongs.videoId": { $ne: track.videoId } },
            { $push: { likedSongs: { $each: [track], $position: 0 } } }
        )

        res.status(201).json({ message: "Song liked" })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const unlikeSong = async (req: AuthRequest, res: Response) => {
    try {
        const videoId = String(req.params.videoId)
        await UserModel.updateOne(
            { _id: req.user?.sub },
            { $pull: { likedSongs: { videoId } } }
        )

        res.status(200).json({ message: "Song removed from liked songs" })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

/* ---------------- recently played ---------------- */

export const getRecentlyPlayed = async (req: AuthRequest, res: Response) => {
    try {
        const user = await UserModel.findById(req.user?.sub).select("recentlyPlayed")
        if (!user) return res.status(404).json({ message: "User not found" })

        res.status(200).json({ data: user.recentlyPlayed })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const addRecentlyPlayed = async (req: AuthRequest, res: Response) => {
    try {
        const track = parseTrack(req.body)
        if (!track) return res.status(400).json({ message: "Invalid track" })

        // 1) remove an older entry of the same song, 2) put it at the front
        await UserModel.updateOne(
            { _id: req.user?.sub },
            { $pull: { recentlyPlayed: { videoId: track.videoId } } }
        )
        await UserModel.updateOne(
            { _id: req.user?.sub },
            {
                $push: {
                    recentlyPlayed: { $each: [track], $position: 0, $slice: MAX_RECENT }
                }
            }
        )

        res.status(201).json({ message: "Saved" })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}
