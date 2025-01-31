export interface Poll {
  id: number
  name: string
  x: number
  y: number
  created_at?: string
  updated_at?: string
}

export interface PollVote {
  id: number
  poll_id: number
  user_id: string
  created_at?: string
  updated_at?: string
}
