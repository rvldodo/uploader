import {
  authSessionResponseSchema,
  type LoginRequest,
  type RegisterRequest,
  userDtoSchema,
} from '@media-upload/contracts'
import { api } from '@/lib/api'

export const authApi = {
  login: (body: LoginRequest) =>
    api.request('/v1/auth/login', authSessionResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  register: (body: RegisterRequest) =>
    api.request('/v1/auth/register', authSessionResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => api.request('/v1/auth/me', userDtoSchema),
  logout: () => api.requestVoid('/v1/auth/logout', { method: 'POST' }),
}
