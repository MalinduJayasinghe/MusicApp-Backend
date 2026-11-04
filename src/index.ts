import "dotenv/config"
import express, {Request, Response} from "express"
import mongoose from "mongoose"
import cors from "cors"

const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_LOCAL_URL || ""
const PORT = process.env.PORT || 5000

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/v1/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" })
})

if (!MONGO_URL) {
    console.error("MONGO_URL is not set. Copy .example.env to .env and add your MongoDB connection string.")
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
