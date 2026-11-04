import { ITrack } from "../models/track.model"

const YT_BASE = "https://www.googleapis.com/youtube/v3"
const MUSIC_CATEGORY_ID = "10" // YouTube's "Music" category
const MAX_DURATION_SECONDS = 15 * 60 // hide long mixes / live streams

export class YouTubeError extends Error {
    status: number

    constructor(message: string, status = 500) {
        super(message)
        this.status = status
    }
}

export interface SearchResult {
    tracks: ITrack[]
    nextPageToken: string | null
}

/* ---------------- tiny in-memory cache (saves API quota) ---------------- */
const cache = new Map<string, { value: unknown; expires: number }>()

const getCached = <T>(key: string): T | null => {
    const hit = cache.get(key)
    if (!hit) return null
    if (hit.expires < Date.now()) {
        cache.delete(key)
        return null
    }
    return hit.value as T
}

const setCached = (key: string, value: unknown, ttlMs: number) => {
    cache.set(key, { value, expires: Date.now() + ttlMs })
}


export const parseDuration = (iso?: string): number => {
    const match = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "")
    if (!match) return 0
    const [, h, m, s] = match
    return Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0)
}

const NOISE =
    /\s*[([{][^)\]}]*(official|lyric|video|audio|visuali[sz]er|hd|hq|4k|remaster|\bmv\b|clip)[^)\]}]*[)\]}]/gi

export const splitTitle = (rawTitle: string, channelTitle: string) => {
    const cleaned = rawTitle.replace(NOISE, "").replace(/\s+/g, " ").trim()
    const channel = channelTitle
        .replace(/\s*-\s*Topic$/i, "")
        .replace(/VEVO$/i, "")
        .trim()

    const separator = cleaned.indexOf(" - ")
    if (separator > 0) {
        return {
            artist: cleaned.slice(0, separator).trim(),
            title: cleaned.slice(separator + 3).trim() || cleaned
        }
    }

    return { artist: channel || channelTitle, title: cleaned || rawTitle }
}

export const toTrack = (item: any): ITrack | null => {
    if (!item?.id || item.status?.embeddable === false) return null

    const duration = parseDuration(item.contentDetails?.duration)
    if (!duration || duration > MAX_DURATION_SECONDS) return null

    const { artist, title } = splitTitle(
        item.snippet?.title ?? "",
        item.snippet?.channelTitle ?? ""
    )
    const thumbs = item.snippet?.thumbnails ?? {}

    return {
        videoId: item.id,
        title,
        artist,
        thumbnail:
            thumbs.medium?.url ||
            thumbs.high?.url ||
            thumbs.default?.url ||
            `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
        duration
    }
}


const callYouTube = async (path: string, params: Record<string, string>) => {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) {
        throw new YouTubeError("YOUTUBE_API_KEY is not configured on the server", 500)
    }

    const url = new URL(`${YT_BASE}/${path}`)
    Object.entries({ ...params, key }).forEach(([k, v]) =>
        url.searchParams.set(k, v)
    )

    const res = await fetch(url)
    const body: any = await res.json()

    if (!res.ok) {
        const reason = body?.error?.errors?.[0]?.reason
        if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
            throw new YouTubeError(
                "YouTube API daily quota reached. Please try again later.",
                429
            )
        }
        throw new YouTubeError(body?.error?.message || "YouTube request failed", 502)
    }

    return body
}

const VIDEO_PARTS = "snippet,contentDetails,status"

const getTracksByIds = async (ids: string[]): Promise<ITrack[]> => {
    const body = await callYouTube("videos", {
        part: VIDEO_PARTS,
        id: ids.join(",")
    })
    return (body.items as any[]).map(toTrack).filter((t): t is ITrack => !!t)
}

export const searchTracks = async (
    query: string,
    pageToken?: string
): Promise<SearchResult> => {
    const cacheKey = `search:${query.toLowerCase()}:${pageToken || ""}`
    const cached = getCached<SearchResult>(cacheKey)
    if (cached) return cached

    const search = await callYouTube("search", {
        part: "snippet",
        type: "video",
        videoCategoryId: MUSIC_CATEGORY_ID,
        videoEmbeddable: "true",
        videoSyndicated: "true",
        maxResults: "20",
        q: query,
        ...(pageToken ? { pageToken } : {})
    })

    const ids: string[] = (search.items as any[])
        .map((item) => item.id?.videoId)
        .filter(Boolean)

    const result: SearchResult = {
        tracks: ids.length ? await getTracksByIds(ids) : [],
        nextPageToken: search.nextPageToken || null
    }

    setCached(cacheKey, result, 10 * 60 * 1000)
    return result
}

export const getTrendingTracks = async (): Promise<ITrack[]> => {
    const cacheKey = "trending"
    const cached = getCached<ITrack[]>(cacheKey)
    if (cached) return cached

    const body = await callYouTube("videos", {
        part: VIDEO_PARTS,
        chart: "mostPopular",
        videoCategoryId: MUSIC_CATEGORY_ID,
        regionCode: process.env.YOUTUBE_REGION || "US",
        maxResults: "24"
    })

    const tracks = (body.items as any[])
        .map(toTrack)
        .filter((t): t is ITrack => !!t)

    setCached(cacheKey, tracks, 60 * 60 * 1000)
    return tracks
}
