import { Document, Schema, model, Types } from "mongoose"
import { ITrack, trackSchema } from "./track.model"

export interface IPlaylist extends Document {
    name: string
    description: string
    owner: Types.ObjectId
    tracks: ITrack[]
    createdAt: Date
    updatedAt: Date
}

const playlistSchema = new Schema<IPlaylist>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "system_users",
            required: true
        },
        tracks: { type: [trackSchema], default: [] }
    },
    { timestamps: true }
)

export const Playlist = model<IPlaylist>("playlists", playlistSchema)
