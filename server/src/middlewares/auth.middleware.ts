import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import admin from "../config/firebase";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    return next();
  } catch {
    // Fallback: backend-issued session JWT (when Firebase network fails on client)
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return res.status(401).json({ message: "Invalid token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        uid: string;
        userId?: string;
        role?: string;
      };
      (req as any).user = {
        uid: decoded.uid,
        userId: decoded.userId,
        role: decoded.role,
      };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
}
