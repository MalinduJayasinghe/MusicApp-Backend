import "dotenv/config"
import express, { type Request, type Response } from "express"
import mongoose from "mongoose"
import cors from "cors"
import AuthRouter from "./routes/auth.routers"
import MusicRouter from "./routes/music.routers"
import LibraryRouter from "./routes/library.routers"
import PlaylistRouter from "./routes/playlist.routers"

const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_LOCAL_URL || ""
const PORT = process.env.PORT || 5000

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(express.json())

app.get("/api/v1/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" })
})

app.use("/api/v1/auth", AuthRouter)
app.use("/api/v1/music", MusicRouter)
app.use("/api/v1/library", LibraryRouter)
app.use("/api/v1/playlists", PlaylistRouter)

if (!MONGO_URL) {
    console.error("MONGO_URL is not set. Add your MongoDB connection string to .env")
    process.exit(1)
}

mongoose
    .connect(MONGO_URL)
    .then(() => {
        console.log("DB connected..!")

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`)
        })
    })
    .catch((err) => console.error("Fail to connect DB..!", err.message))