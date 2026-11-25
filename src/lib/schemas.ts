// Request validation shared by every mutation route.
//
// Rules:
//   * never trust a client-supplied user_id or ownership field
//   * clamp every enum so a bad value can never reach Postgres
//   * cap every string so a payload cannot grow unbounded

import { z } from 'zod'
import { isGarmentFit, isGarmentType } from './garment'

export const uuidSchema = z.string().uuid()
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
export const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'expected #RRGGBB')

export const categorySchema = z.enum(['top', 'bottom', 'shoes', 'outerwear'])
export const formalitySchema = z.enum(['casual', 'smart_casual', 'formal'])
export const warmthSchema = z.enum(['hot', 'mild', 'cold'])
export const statusSchema = z.enum(['clean', 'dirty'])
export const garmentTypeSchema = z.enum(['tee', 'hoodie', 'sweater', 'pants', 'wide', 'shoe', 'jacket'])
export const garmentFitSchema = z.enum(['tight', 'slim', 'regular', 'relaxed', 'baggy'])

export const itemCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    category: categorySchema,
    primary_color: z.string().trim().min(1).max(40),
    secondary_color: z.string().trim().min(1).max(40).nullable().optional(),
    formality: formalitySchema,
    warmth: warmthSchema,
    price: z.number().min(0).max(100_000).nullable().optional(),
    image_path: z
      .string()
      .trim()
      .min(1)
      .max(320)
      .regex(/^[^/]+\/[A-Za-z0-9._-]+$/, 'expected <user>/<file>')
      .nullable()
      .optional(),
    garment_type: garmentTypeSchema.nullable().optional(),
    color_hex: colorHexSchema.nullable().optional(),
    fit: garmentFitSchema.nullable().optional(),
    status: statusSchema.optional(),
  })
  .strict()

export const itemUpdateSchema = itemCreateSchema
  .omit({ image_path: true })
  .partial()
  .extend({ status: statusSchema.optional() })
  .strict()
  .refine(value => Object.keys(value).length > 0, { message: 'no fields to update' })

export const outfitCreateSchema = z
  .object({
    date: dateSchema,
    occasion: z.string().trim().min(1).max(40),
    weather_temp: z.number().int().min(-60).max(70).nullable().optional(),
    item_ids: z.array(uuidSchema).min(3).max(4),
    explanation_text: z.string().trim().max(500).optional(),
    generated_by: z.enum(['ai', 'rules']).optional(),
    was_worn: z.boolean().optional(),
  })
  .strict()

export const outfitUpdateSchema = z
  .object({
    is_favorite: z.boolean().optional(),
    was_worn: z.boolean().optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, { message: 'no fields to update' })

export const profileUpdateSchema = z
  .object({
    size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']).nullable().optional(),
    silhouette: z.enum(['tailored', 'relaxed', 'oversized']).nullable().optional(),
    city: z.string().trim().min(1).max(80).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).nullable().optional(),
    send_hour: z.number().int().min(0).max(23).nullable().optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, { message: 'no fields to update' })

export const stylistRequestSchema = z
  .object({
    occasion: z.string().trim().min(1).max(40).optional(),
    temp: z.number().min(-60).max(70).nullable().optional(),
    note: z.string().trim().max(280).optional(),
  })
  .strict()

export const weatherRequestSchema = z
  .object({
    city: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    item_ids: z.array(uuidSchema).max(4).optional(),
    temp: z.number().min(-60).max(70).nullable().optional(),
    occasion: z.string().trim().min(1).max(40).optional(),
  })
  .strict()

export function isGarmentTypeValue(value: unknown): boolean {
  return isGarmentType(value)
}

export function isGarmentFitValue(value: unknown): boolean {
  return isGarmentFit(value)
}
