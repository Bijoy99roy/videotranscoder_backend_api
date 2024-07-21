import { z } from 'zod';

export const updateDetailsSchema = z.object({
  videoId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string(),
});

export const generateSignedUrlSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "Content type is required"),
  type: z.enum(["video", "image"]),
});

export const queueTranscodingSchema = z.object({
  videoId: z.string().uuid().min(1, "Video id is required"),
  url: z.string().url().min(1, "Url is required"),
});

export const publishVideo = z.object({
  videoId: z.string().uuid().min(1, "Video id is required"),
});
