// ▸ Place at: lib/notifications.ts
// Fire-and-forget notification writer, called from the routes that trigger
// each event (likes, comments, team invites/accepts). Never blocks or fails
// the caller's main action — same best-effort error handling as recordUsage()
// in lib/subscription.ts.

import { createAdminClient } from './supabase'

export type NotificationType = 'like' | 'comment' | 'reply' | 'team_invite' | 'team_accepted' | 'follow'

interface NotifyParams {
  userId:      string          // recipient
  type:        NotificationType
  actorName?:  string | null
  actorImage?: string | null
  message:     string
  link:        string
}

export async function notify({ userId, type, actorName, actorImage, message, link }: NotifyParams): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('notifications').insert({
      user_id:     userId,
      type,
      actor_name:  actorName ?? null,
      actor_image: actorImage ?? null,
      message,
      link,
    })
  } catch (err) {
    console.error('[notify]', err)
  }
}
