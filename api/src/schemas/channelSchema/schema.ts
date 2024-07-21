import { z } from "zod";

export const createChannelSchema = z.object({
  channelName: z.string().min(1, "Channel name is required"),
  userId: z.string().uuid("Invalid user ID"),
});

export const subscribeUnsubscribeSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  channelId: z.string().uuid("Invalid channel ID"),
});

export const existsChannel = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const channelIdSchema = z.object({
  channelId: z.string().uuid("Invalid channel ID"),
});

export const subscribeStatusSchema = z.object({
  userId: z.string().uuid("Invalid user ID").optional(),
});

export const subscribedChannelsSchema = z.object({
  userId: z.string().uuid("Invalid user ID").optional(),
});
