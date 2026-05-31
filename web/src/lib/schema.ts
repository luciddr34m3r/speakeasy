import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const DrinkSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  ingredients: z.array(z.string()).default([]),
  photoPath: z.string().optional(),
  available: z.boolean().default(true),
  category: z.string().default('Cocktails'),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});
export type Drink = z.infer<typeof DrinkSchema> & { id: string };

export const OrderStatusValues = ['received', 'viewed', 'making', 'ready', 'delivered'] as const;
export type OrderStatus = typeof OrderStatusValues[number];

export const OrderSchema = z.object({
  drinkId: z.string(),
  drinkName: z.string(),
  guestUid: z.string(),
  guestName: z.string(),
  status: z.enum(OrderStatusValues).default('received'),
  partyMode: z.boolean().default(false),
  createdAt: z.instanceof(Timestamp).optional(),
  viewedAt: z.instanceof(Timestamp).optional(),
  readyAt: z.instanceof(Timestamp).optional(),
  deliveredAt: z.instanceof(Timestamp).optional(),
});
export type Order = z.infer<typeof OrderSchema> & { id: string };

export const UserProfileSchema = z.object({
  displayName: z.string(),
  isGoogleLinked: z.boolean().default(false),
  ratings: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).default({}),
  lastOrderAt: z.instanceof(Timestamp).optional(),
  fcmTokens: z.array(z.string()).default([]),
});
export type UserProfile = z.infer<typeof UserProfileSchema> & { id: string };

export const AppConfigSchema = z.object({
  partyMode: z.boolean().default(false),
  adminUid: z.string(),
  adminFcmTokens: z.array(z.string()).default([]),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
