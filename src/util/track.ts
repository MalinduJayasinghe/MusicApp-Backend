import { ITrack } from "../models/track.model"

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

// Validates a track object sent by the client before it is saved to MongoDB.
export const parseTrack = (body: unknown): ITrack | null => {
    if (!body || typeof body !== "object") return null

    const { videoId, title, artist, thumbnail, duration } = body as Record<
        string,
        unknown
    >

    if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) return null
    if (typeof title !== "string" || !title.trim()) return null

    return {
        videoId,
        title: title.trim().slice(0, 200),
        artist: typeof artist === "string" ? artist.trim().slice(0, 120) : "",
        thumbnail: typeof thumbnail === "string" ? thumbnail.slice(0, 500) : "",
        duration: typeof duration === "number" && duration > 0 ? Math.round(duration) : 0
    }
}
