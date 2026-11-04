import { Document, model, Schema } from "mongoose"
import { ITrack, trackSchema } from "./track.model"

export interface IUser extends Document {
    name: string
    email: string
    password: string
    likedSongs: ITrack[]
    recentlyPlayed: ITrack[]
}

const userSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        likedSongs: { type: [trackSchema], default: [] },
        recentlyPlayed: { type: [trackSchema], default: [] }
    },
    { timestamps: true }
)

export const UserModel = model<IUser>("system_users", userSchema)
