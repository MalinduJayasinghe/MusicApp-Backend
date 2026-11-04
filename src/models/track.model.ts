import { Schema } from "mongoose"


export interface ITrack {
    videoId: string
    title: string
    artist: string
    thumbnail: string
    duration: number // seconds
}

export const trackSchema = new Schema<ITrack>(
    {
        videoId: { type: String, required: true },
        title: { type: String, required: true },
        artist: { type: String, default: "" },
        thumbnail: { type: String, default: "" },
        duration: { type: Number, default: 0 }
    },
    { _id: false }
)
