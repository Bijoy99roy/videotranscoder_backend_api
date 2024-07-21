import { z } from 'zod';

export const videoDetailsSchema = z.object({
  videoId: z.string().min(1, "Video id is required"),
});

export const uploadedVideosSchema = z.object({
  userId: z.string(),
});

export const deleteFolderSchema = z.object({
  videoId: z.string().min(1, "Video id is required"),
});

export const addViewSchema = z.object({
  videoId: z.string().min(1, "Video id is required"),
  userId: z.string(),
});

export const likeVideoSchema = z.object({
  userId: z.string().min(1, "User id is required"),
  videoId: z.string().min(1, "Video id is required"),
  type: z.enum(['LIKE', 'DISLIKE']),
});

export const likeStatusSchema = z.object({
  userId: z.string(),
  videoId: z.string().min(1, "Video id is required"),
});

export const likedVideoSchema = z.object({
  userId: z.string().min(1, "User id is required"),
});
