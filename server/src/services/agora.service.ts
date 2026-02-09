import { RtcTokenBuilder, RtcRole } from "agora-access-token";

const APP_ID = process.env.AGORA_APP_ID || "";
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "";

// Token expiration time in seconds (24 hours)
const TOKEN_EXPIRATION_TIME = 86400;
// Privilege expiration time (24 hours)
const PRIVILEGE_EXPIRATION_TIME = 86400;

export interface AgoraTokenResult {
  token: string;
  channelName: string;
  uid: number;
  appId: string;
  expiresAt: number;
}

/**
 * Generate an Agora RTC token for video/voice calls
 * @param channelName - The channel name for the call
 * @param uid - User ID (numeric)
 * @param role - Publisher (can send audio/video) or Subscriber (can only receive)
 */
export function generateAgoraToken(
  channelName: string,
  uid: number,
  role: "publisher" | "subscriber" = "publisher"
): AgoraTokenResult {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error("Agora credentials not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env");
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + PRIVILEGE_EXPIRATION_TIME;
  const tokenExpireTime = currentTime + TOKEN_EXPIRATION_TIME;

  const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    rtcRole,
    privilegeExpireTime
  );

  return {
    token,
    channelName,
    uid,
    appId: APP_ID,
    expiresAt: tokenExpireTime,
  };
}

/**
 * Generate a unique channel name for a call between two users.
 * Agora requires channel name length < 64 bytes. We use shortened IDs to stay under limit.
 */
export function generateChannelName(callerId: string, calleeId: string): string {
  const sortedIds = [callerId, calleeId].sort();
  // Use last 10 chars of each ObjectId (24 would exceed Agora's 64-char limit with timestamp)
  const a = sortedIds[0].slice(-10);
  const b = sortedIds[1].slice(-10);
  return `call_${a}_${b}_${Date.now()}`;
}

/**
 * Generate a numeric UID from a MongoDB ObjectId string
 * Agora requires numeric UIDs
 */
export function generateNumericUid(objectId: string): number {
  // Take last 8 characters of the ObjectId and convert to a number
  const hexPart = objectId.slice(-8);
  return parseInt(hexPart, 16) % 2147483647; // Keep it within 32-bit integer range
}

/**
 * Check if Agora is properly configured
 */
export function isAgoraConfigured(): boolean {
  return !!(APP_ID && APP_CERTIFICATE);
}

/**
 * Get Agora App ID (for client-side initialization)
 */
export function getAgoraAppId(): string {
  return APP_ID;
}
