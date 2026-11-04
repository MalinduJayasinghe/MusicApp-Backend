import { Request, Response } from "express"
import {
    getTrendingTracks,
    searchTracks,
    YouTubeError
} from "../services/youtube.service"

const handleError = (err: unknown, res: Response) => {
    if (err instanceof YouTubeError) {
        return res.status(err.status).json({ message: err.message })
    }
    console.error(err)
    res.status(500).json({ message: "Internal Server Error" })
}

export const searchMusic = async (req: Request, res: Response) => {
    const q = String(req.query.q || "").trim()
    if (!q) return res.status(400).json({ message: "Search query is required" })

    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined

    try {
        const result = await searchTracks(q, pageToken)
        res.status(200).json({
            data: result.tracks,
            meta: { nextPageToken: result.nextPageToken }
        })
    } catch (err) {
        handleError(err, res)
    }
}

export const getTrending = async (_req: Request, res: Response) => {
    try {
        const tracks = await getTrendingTracks()
        res.status(200).json({ data: tracks })
    } catch (err) {
        handleError(err, res)
    }
}
