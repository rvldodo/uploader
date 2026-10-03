import { z } from 'zod'

/** Shared so the sign-up form and the API enforce the same rules. */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const emailSchema = z.email().trim().toLowerCase().max(254)
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
export const displayNameSchema = z.string().trim().min(1, 'Name is required').max(80)

export const userIdSchema = z.uuid()

/** The signed-in user, as they see themselves. */
export const userDtoSchema = z.object({
  id: userIdSchema,
  email: z.string(),
  name: z.string(),
})
export type UserDto = z.infer<typeof userDtoSchema>

/** A user as seen by others (e.g. a file's owner). Never includes the email. */
export const publicUserDtoSchema = z.object({
  id: userIdSchema,
  name: z.string(),
})
export type PublicUserDto = z.infer<typeof publicUserDtoSchema>

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const loginRequestSchema = z.object({
  email: emailSchema,
  // No length rules on login: never reveal the policy for existing passwords.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const authSessionResponseSchema = z.object({
  user: userDtoSchema,
  /** Opaque bearer token. Store it server-side (httpOnly cookie), never in JS-readable storage. */
  token: z.string(),
  expiresAt: z.iso.datetime(),
})
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
