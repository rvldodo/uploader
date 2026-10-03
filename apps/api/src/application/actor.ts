/** An authenticated user performing a use case. */
export interface Actor {
  userId: string
}

/** Someone viewing content: an authenticated actor, or `null` for anonymous visitors. */
export type Viewer = Actor | null
