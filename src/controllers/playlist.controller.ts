import { Response } from "express"
import mongoose from "mongoose"
import { Playlist } from "../models/playlist.model"
import { AuthRequest } from "../middleware/auth"
import { parseTrack } from "../util/track"

// Finds a playlist by id that belongs to the logged-in user
const findOwned = (req: AuthRequest) => {
    const id = String(req.params.id)
    if (!mongoose.isValidObjectId(id)) return null
    return Playlist.findOne({ _id: id, owner: req.user?.sub })
}

export const createPlaylist = async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body.name || "").trim()
        const description = String(req.body.description || "").trim()

        if (!name)
            return res.status(400).json({ message: "Playlist name is required" })
        if (name.length > 100) {
            return res.status(400).json({ message: "Playlist name is too long" })
        }

        const playlist = await Playlist.create({
            name,
            description: description.slice(0, 300),
            owner: req.user?.sub
        })

        res.status(201).json(playlist)
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const getMyPlaylists = async (req: AuthRequest, res: Response) => {
    try {
        const playlists = await Playlist.find({ owner: req.user?.sub }).sort({
            updatedAt: -1
        })
        res.status(200).json({ data: playlists })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const getPlaylistById = async (req: AuthRequest, res: Response) => {
    try {
        const playlist = await findOwned(req)
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" })

        res.status(200).json(playlist)
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const updatePlaylist = async (req: AuthRequest, res: Response) => {
    try {
        const playlist = await findOwned(req)
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" })

        const { name, description } = req.body
        if (typeof name === "string") {
            if (!name.trim()) {
                return res.status(400).json({ message: "Playlist name is required" })
            }
            playlist.name = name.trim().slice(0, 100)
        }
        if (typeof description === "string") {
            playlist.description = description.trim().slice(0, 300)
        }

        await playlist.save()
        res.status(200).json(playlist)
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const deletePlaylist = async (req: AuthRequest, res: Response) => {
    try {
        const playlist = await findOwned(req)
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" })

        await playlist.deleteOne()
        res.status(200).json({ message: "Playlist deleted" })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const addTrackToPlaylist = async (req: AuthRequest, res: Response) => {
    try {
        const track = parseTrack(req.body)
        if (!track) return res.status(400).json({ message: "Invalid track" })

        const playlist = await findOwned(req)
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" })

        if (playlist.tracks.some((t) => t.videoId === track.videoId)) {
            return res
                .status(409)
                .json({ message: "Song is already in this playlist" })
        }

        playlist.tracks.push(track)
        await playlist.save()

        res.status(201).json(playlist)
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const removeTrackFromPlaylist = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const id = String(req.params.id)
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid playlist ID" })
        }

        const playlist = await Playlist.findOneAndUpdate(
            { _id: id, owner: req.user?.sub },
            { $pull: { tracks: { videoId: String(req.params.videoId) } } },
            { new: true }
        )
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" })

        res.status(200).json(playlist)
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }
}
