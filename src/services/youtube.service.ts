import { ITrack } from "../models/track.model"

const YT_BASE = "https://www.googleapis.com/youtube/v3"
const MUSIC_CATEGORY_ID = "10"
const MIN_DURATION_SECONDS = 45
const MAX_DURATION_SECONDS = 15 * 60

const CANDIDATES_PER_PAGE = 50
const MIN_RESULTS = 12
const MAX_SEARCH_PAGES = 3 // quota guard: each page costs 100 units

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


const MUSIC_TOPIC =
    /wikipedia\.org\/wiki\/(Music|Music_of_[\w%-]+|[\w%-]+_music|Jazz|Reggae|Rhythm_and_blues)$/i


const BLOCKED: RegExp[] = [
    /\b(reaction|reacts?|reacting)\b/i,
    /\b(tutorial|lessons?|how to)\b/i,
    /\b(reviews?|unboxing)\b/i,
    /\b(interview|podcast|documentary|behind the scenes|making of)\b/i,
    /\b(trailer|teaser|gameplay|walkthrough|vlog|prank)\b/i,
    /\b(compilation|megamix|non-?stop|full album)\b/i,
    /\b(live ?stream(ing)?|24\/7)\b/i,
    /\b(ringtone|whatsapp status|status video)\b/i
]

/* eslint-disable @typescript-eslint/no-explicit-any */
export const isMusicContent = (item: any, query = ""): boolean => {
    const snippet = item?.snippet
    if (!item?.id || !snippet) return false

    if (item.status?.embeddable === false) return false
    if (item.status?.privacyStatus && item.status.privacyStatus !== "public") return false
    if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none") return false

    const duration = parseDuration(item.contentDetails?.duration)
    if (duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) return false

    const topics: string[] = item.topicDetails?.topicCategories ?? []
    const isMusic =
        snippet.categoryId === MUSIC_CATEGORY_ID || topics.some((t) => MUSIC_TOPIC.test(t))
    if (!isMusic) return false

    if (/#shorts?\b/i.test(snippet.description ?? "")) return false

    const text = `${snippet.title ?? ""} ${snippet.channelTitle ?? ""}`
    return !BLOCKED.some((re) => re.test(text) && !re.test(query))
}

export const toTrack = (item: any, query = ""): ITrack | null => {
    if (!isMusicContent(item, query)) return null

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
        duration: parseDuration(item.contentDetails?.duration)
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

const VIDEO_PARTS = "snippet,contentDetails,status,topicDetails"

const getTracksByIds = async (ids: string[], query: string): Promise<ITrack[]> => {
    const body = await callYouTube("videos", {
        part: VIDEO_PARTS,
        id: ids.join(",")
    })
    return (body.items as any[])
        .map((item) => toTrack(item, query))
        .filter((t): t is ITrack => !!t)
}

// search.list costs 100 quota units, videos.list costs 1 (free quota: 10,000/day)
export const searchTracks = async (
    query: string,
    pageToken?: string
): Promise<SearchResult> => {
    const cacheKey = `search:${query.toLowerCase()}:${pageToken || ""}`
    const cached = getCached<SearchResult>(cacheKey)
    if (cached) return cached

    const tracks: ITrack[] = []
    const seen = new Set<string>()
    let token = pageToken
    let nextPageToken: string | null = null

    for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
        const search = await callYouTube("search", {
            part: "snippet",
            type: "video",
            videoCategoryId: MUSIC_CATEGORY_ID,
            videoEmbeddable: "true",
            videoSyndicated: "true",
            maxResults: String(CANDIDATES_PER_PAGE),
            q: query,
            ...(token ? { pageToken: token } : {})
        })

        const ids: string[] = (search.items as any[])
            .map((item) => item.id?.videoId)
            .filter(Boolean)

        const found = ids.length ? await getTracksByIds(ids, query) : []
        for (const track of found) {
            if (!seen.has(track.videoId)) {
                seen.add(track.videoId)
                tracks.push(track)
            }
        }

        nextPageToken = search.nextPageToken || null
        if (tracks.length >= MIN_RESULTS || !nextPageToken) break
        token = nextPageToken
    }

    const result: SearchResult = { tracks, nextPageToken }
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
        .map((item) => toTrack(item))
        .filter((t): t is ITrack => !!t)

    setCached(cacheKey, tracks, 60 * 60 * 1000)
    return tracks
}