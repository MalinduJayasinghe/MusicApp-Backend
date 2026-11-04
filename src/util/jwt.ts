import { IUser } from "../models/user.model"
import jwt, { JwtPayload } from "jsonwebtoken"

const getSecret = (): string => {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error("JWT_SECRET is not set")
    return secret
}

const getRefreshSecret = (): string =>
    process.env.JWT_REFRESH_SECRET || getSecret()

export interface AuthPayload extends JwtPayload {
    sub: string
}

export const signAccessToken = (user: IUser): string => {
    return jwt.sign({ sub: user._id.toString() }, getSecret(), {
        expiresIn: "30m"
    })
}

export const signRefreshToken = (user: IUser): string => {
    return jwt.sign({ sub: user._id.toString() }, getRefreshSecret(), {
        expiresIn: "7d"
    })
}

export const verifyAccessToken = (token: string): AuthPayload => {
    return jwt.verify(token, getSecret()) as AuthPayload
}

export const verifyRefreshToken = (token: string): AuthPayload => {
    return jwt.verify(token, getRefreshSecret()) as AuthPayload
}
