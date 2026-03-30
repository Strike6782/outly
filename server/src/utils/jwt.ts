import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES;
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets are not defined");
}

if (!ACCESS_TOKEN_EXPIRES) {
  throw new Error("ACCESS_TOKEN_EXPIRES is not defined — tokens would never expire");
}

if (!REFRESH_TOKEN_EXPIRES) {
  throw new Error("REFRESH_TOKEN_EXPIRES is not defined — tokens would never expire");
}


export function signAccessToken(payload: object) {
    const options: SignOptions = {
    expiresIn: ACCESS_TOKEN_EXPIRES as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, ACCESS_SECRET, options);
}

export function signRefreshToken(payload: object) {
  const options: SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRES as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}
