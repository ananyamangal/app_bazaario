import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import admin from "../config/firebase";
import User from "../models/user.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { VideoCall } from "../models/videoCall.model";
import { createAndSendNotification } from "./notification.service";

let io: Server | null = null;

// Map of userId to socket ids (a user can have multiple connections)
const userSockets: Map<string, Set<string>> = new Map();

// Map of socket id to userId
const socketUsers: Map<string, string> = new Map();

export function initializeSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware: accept Firebase ID token or backend session JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Try Firebase ID token first
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await User.findOne({ uid: decodedToken.uid });
        if (!user) return next(new Error("User not found"));
        (socket as any).userId = user._id.toString();
        (socket as any).userRole = user.role;
        (socket as any).firebaseUid = decodedToken.uid;
        return next();
      } catch {
        // Fallback: backend session JWT (when Firebase network fails on client)
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) return next(new Error("Authentication failed"));
        const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; userId?: string; role?: string };
        const user = await User.findOne(
          decoded.userId ? { _id: decoded.userId } : { uid: decoded.uid }
        );
        if (!user) return next(new Error("User not found"));
        (socket as any).userId = user._id.toString();
        (socket as any).userRole = user.role;
        (socket as any).firebaseUid = user.uid;
        next();
      }
    } catch (error) {
      console.error("[Socket Auth Error]", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    
    console.log(`[Socket] User connected: ${userId} (${userRole})`);

    // Track user's socket connection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socketUsers.set(socket.id, userId);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle joining a conversation room
    socket.on("join_conversation", async (data: { conversationId: string }) => {
      const { conversationId } = data;
      
      // Verify user is part of this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      const isParticipant =
        conversation.customerId.toString() === userId ||
        conversation.sellerId.toString() === userId;

      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized for this conversation" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] User ${userId} joined conversation ${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on("leave_conversation", (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`);
    });

    // Handle sending a message
    socket.on("send_message", async (data: {
      conversationId: string;
      content: string;
      messageType?: string;
      imageUrl?: string;
    }) => {
      try {
        const { conversationId, content, messageType = "text", imageUrl } = data;

        // Get conversation to determine sender type
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const isCustomer = conversation.customerId.toString() === userId;
        const senderType = isCustomer ? "customer" : "seller";

        // Create message
        const message = new Message({
          conversationId,
          senderId: userId,
          senderType,
          content,
          messageType,
          imageUrl,
        });
        await message.save();

        // Update conversation
        const updateData: any = {
          lastMessage: content,
          lastMessageAt: new Date(),
          lastMessageSender: senderType,
        };

        // Increment unread count for the other party
        if (isCustomer) {
          updateData.$inc = { sellerUnread: 1 };
        } else {
          updateData.$inc = { customerUnread: 1 };
        }

        await Conversation.findByIdAndUpdate(conversationId, updateData);

        // Emit to all in conversation room
        io!.to(`conversation:${conversationId}`).emit("new_message", {
          message: {
            _id: message._id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            senderType: message.senderType,
            content: message.content,
            messageType: message.messageType,
            imageUrl: message.imageUrl,
            createdAt: message.createdAt,
          },
        });

        // Also notify the other user if they're not in the room
        const otherUserId = isCustomer
          ? conversation.sellerId.toString()
          : conversation.customerId.toString();

        io!.to(`user:${otherUserId}`).emit("conversation_updated", {
          conversationId,
          lastMessage: content,
          lastMessageAt: new Date(),
          unreadIncrement: 1,
        });

        // In-app + push notification for the other party
        const preview = content.length > 50 ? content.slice(0, 50) + "…" : content;
        const fromLabel = isCustomer ? conversation.customerName || "A customer" : conversation.shopName;
        await createAndSendNotification(
          otherUserId,
          "message",
          "New message",
          `${fromLabel}: ${preview}`,
          {
            type: "message",
            conversationId,
            shopId: conversation.shopId.toString(),
          }
        );

        console.log(`[Socket] Message sent in conversation ${conversationId}`);
      } catch (error) {
        console.error("[Socket] Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
        conversationId: data.conversationId,
        userId,
        isTyping: data.isTyping,
      });
    });

    // Handle marking messages as read
    socket.on("mark_read", async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) return;

        const isCustomer = conversation.customerId.toString() === userId;

        // Update unread count
        if (isCustomer) {
          await Conversation.findByIdAndUpdate(conversationId, { customerUnread: 0 });
        } else {
          await Conversation.findByIdAndUpdate(conversationId, { sellerUnread: 0 });
        }

        // Mark messages as read
        const otherSenderType = isCustomer ? "seller" : "customer";
        await Message.updateMany(
          {
            conversationId,
            senderType: otherSenderType,
            readAt: null,
          },
          { readAt: new Date() }
        );

        socket.emit("messages_marked_read", { conversationId });
      } catch (error) {
        console.error("[Socket] Error marking messages read:", error);
      }
    });

    // Handle call events
    socket.on("call_request", async (data: { callId: string }) => {
      try {
        const call = await VideoCall.findById(data.callId).populate("shopId");
        if (!call) return;

        // Notify seller
        io!.to(`user:${call.sellerId.toString()}`).emit("call_incoming", {
          callId: call._id,
          callerId: call.customerId,
          shopId: call.shopId,
          callType: call.callType,
        });
      } catch (error) {
        console.error("[Socket] Error emitting call request:", error);
      }
    });

    socket.on("call_accepted", async (data: { callId: string }) => {
      try {
        const call = await VideoCall.findById(data.callId);
        if (!call) return;

        // Notify customer
        io!.to(`user:${call.customerId.toString()}`).emit("call_accepted", {
          callId: call._id,
        });
      } catch (error) {
        console.error("[Socket] Error emitting call accepted:", error);
      }
    });

    socket.on("call_declined", async (data: { callId: string }) => {
      try {
        const call = await VideoCall.findById(data.callId);
        if (!call) return;

        // Notify customer
        io!.to(`user:${call.customerId.toString()}`).emit("call_declined", {
          callId: call._id,
        });
      } catch (error) {
        console.error("[Socket] Error emitting call declined:", error);
      }
    });

    socket.on("call_ended", async (data: { callId: string }) => {
      try {
        const call = await VideoCall.findById(data.callId);
        if (!call) return;

        // Notify both parties
        io!.to(`user:${call.customerId.toString()}`).emit("call_ended", { callId: call._id });
        io!.to(`user:${call.sellerId.toString()}`).emit("call_ended", { callId: call._id });
      } catch (error) {
        console.error("[Socket] Error emitting call ended:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${userId}`);
      
      // Remove socket from tracking
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
      socketUsers.delete(socket.id);
    });
  });

  console.log("[Socket.io] Server initialized");
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

export function emitToUser(userId: string, event: string, data: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToConversation(conversationId: string, event: string, data: any): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}
