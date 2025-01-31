import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useShape, preloadShape } from "@electric-sql/react"
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '../components/avatar'
import { type Poll, type PollVote } from '../types'

const API_ROOT = import.meta.env.VITE_API
const pollsShape = {
  url: `${API_ROOT}/shape/polls`
}

const pollVotesShape = {
  url: `${API_ROOT}/shape/poll_votes`
}

function VisualPollerComponent() {

  const { data: polls = [], stream } = useShape<Poll>(pollsShape)
  const { data: votes = [] } = useShape<PollVote>(pollVotesShape)
  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null
  const [newPollName, setNewPollName] = React.useState('')
  const [showNewPollForm, setShowNewPollForm] = React.useState(false)
  const [newPollPosition, setNewPollPosition] = React.useState<{ x: number, y: number } | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Wait for a specific transaction ID to appear in the stream
  const waitForTxid = React.useCallback(async (expectedTxid: number) => {
    let unsubscribe: (() => void) | undefined

    try {
      return await new Promise<void>((resolve, reject) => {
        unsubscribe = stream.subscribe((messages: any[]) => {
          for (const message of messages) {
            const txid = message.headers?.txid
            console.log(`waitForTxid`, { txid, expectedTxid })
            if (txid === expectedTxid) {
              unsubscribe?.()
              resolve()
              return
            }
          }
        })
      })
    } finally {
      unsubscribe?.()
    }
  }, [stream])

  const createPollMutation = useMutation({
    mutationKey: ['create-poll'],
    mutationFn: async ({ name, x, y }: { name: string, x: number, y: number }) => {
      // Start collecting txids
      const seenTxids = new Set<number>()
      let unsubscribe: (() => void) | undefined

      try {
        unsubscribe = stream.subscribe((messages: any[]) => {
          for (const message of messages) {
            const txid = message.headers?.txid
            if (txid) {
              seenTxids.add(txid)
            }
          }
        })

        const response = await fetch(`${API_ROOT}/polls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, x, y }),
        })

        if (!response.ok) {
          throw new Error('Failed to create poll')
        }

        const { txid, poll } = await response.json()
        console.log({ txid, seenTxids })

        // If we haven't seen this txid in the stream yet, wait for it
        if (!seenTxids.has(txid)) {
          await waitForTxid(txid)
        }

        return poll
      } finally {
        unsubscribe?.()
      }
    },
  })

  const voteMutation = useMutation({
    mutationKey: ['vote'],
    mutationFn: async (pollId: number) => {
      // Start collecting txids
      const seenTxids = new Set<number>()
      let unsubscribe: (() => void) | undefined

      try {
        unsubscribe = stream.subscribe((messages: any[]) => {
          for (const message of messages) {
            const txid = message.headers?.txid
            if (txid) {
              seenTxids.add(txid)
            }
          }
        })

        const response = await fetch(`${API_ROOT}/polls/${pollId}/votes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: user.id }),
        })

        if (!response.ok) {
          throw new Error('Failed to vote')
        }

        const { txid, vote } = await response.json()

        // If we haven't seen this txid in the stream yet, wait for it
        if (!seenTxids.has(txid)) {
          await waitForTxid(txid)
        }

        return vote
      } finally {
        unsubscribe?.()
      }
    },
    onMutate: (pollId: number) => {
      // Return optimistic vote
      const optimisticVote = {
        id: `optimistic-${Date.now()}`,
        poll_id: pollId,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PollVote

      return { optimisticVote }
    }
  })

  // Get optimistic votes
  const optimisticVotes = useMutationState({
    filters: { status: 'pending', mutationKey: ['vote'] },
    select: (mutation) => mutation.state.context?.optimisticVote as PollVote,
  })

  // Get total votes across all polls
  const totalVotes = React.useMemo(() => {
    return votes.length + optimisticVotes.length
  }, [votes, optimisticVotes])

  // Group votes by poll
  const votesByPoll = React.useMemo(() => {
    const grouped = new Map<number, PollVote[]>()
    for (const vote of votes) {
      const pollVotes = grouped.get(vote.poll_id) || []
      grouped.set(vote.poll_id, [...pollVotes, vote])
    }
    return grouped
  }, [votes])

  // Get votes for a specific poll, including optimistic votes
  const getVotesForPoll = React.useCallback((pollId: number) => {
    // Get real votes for this poll
    const realVotes = votesByPoll.get(pollId) || []
    const votesMap = new Map<string | number, PollVote>()

    // Add real votes to map
    realVotes.forEach(vote => {
      votesMap.set(vote.id, vote)
    })

    // Add optimistic votes for this poll
    optimisticVotes.forEach(vote => {
      if (vote && vote.poll_id === pollId) {
        // For optimistic votes, check if there's a matching "real" vote
        const existingVote = Array.from(votesMap.values()).find(v =>
          // Match on poll_id and user_id
          v.poll_id === vote.poll_id &&
          v.user_id === vote.user_id &&
          // Only match votes created within the last second
          new Date(v.created_at).getTime() > Date.now() - 1000
        )

        if (existingVote) {
          // If we found a match, update it with optimistic data
          votesMap.set(existingVote.id, { ...existingVote, ...vote })
        } else {
          // If no match, add the optimistic vote
          votesMap.set(vote.id, vote)
        }
      }
    })

    return Array.from(votesMap.values())
  }, [votesByPoll, optimisticVotes])


  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks directly on the background
    if (e.target === e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setNewPollPosition({ x, y })
      setShowNewPollForm(true)
    }
  }

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPollPosition) return

    try {
      await createPollMutation.mutateAsync({
        name: newPollName,
        x: newPollPosition.x,
        y: newPollPosition.y,
      })
      setShowNewPollForm(false)
      setNewPollPosition(null)
      setNewPollName('')
    } catch (error) {
      console.error('Failed to create poll:', error)
    }
  }

  // If no user is set, redirect to home
  if (!user) {
    return (
      <div className="max-w-2xl p-6">
        <h3 className="text-xl mb-4">Please set your name first</h3>
        <a href="/" className="text-blue-500 hover:text-blue-600">Go to home page</a>
      </div>
    )
  }

  const PollComponent = ({ poll, votes, onVote }: { poll: Poll, votes: PollVote[], onVote: () => void }) => {
    const [showVotes, setShowVotes] = React.useState(false)
    
    // Count votes per user
    const votesByUser = React.useMemo(() => {
      const counts = new Map<string, number>()
      votes.forEach(vote => {
        counts.set(vote.user_id, (counts.get(vote.user_id) || 0) + 1)
      })
      return counts
    }, [votes])

    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-2 cursor-pointer border-1"
        style={{
          left: `${poll.x}px`,
          top: `${poll.y}px`,
        }}
        onClick={onVote}
        onMouseEnter={() => setShowVotes(true)}
        onMouseLeave={() => setShowVotes(false)}
      >
        <div className="text-sm font-semibold mb-1">{poll.name}</div>
        <div className="flex items-center space-x-1">
          <div className="text-xs text-gray-600">Votes: {votes.length}</div>
        </div>
        
        {/* Vote details on hover */}
        {showVotes && votesByUser.size > 0 && (
          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 bg-white border border-gray-200 rounded-md p-2 shadow-sm z-10">
            <div className="text-xs font-medium mb-1">Votes by user:</div>
            <div className="space-y-1">
              {Array.from(votesByUser.entries()).map(([userId, count]) => (
                <div key={userId} className="flex items-center gap-1.5 text-xs">
                  <Avatar userId={userId} size="xs" />
                  <span className="text-gray-600">{count} vote{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  console.log({ polls })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Visual Poller</h1>
          <p className="text-gray-600">Click anywhere to create a new poll. Click on polls to vote!</p>
        </div>
        <div className="text-xl font-semibold">
          Total Votes: {totalVotes}
        </div>
      </div>

      <div
        className="relative bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg"
        style={{ height: '600px', position: 'relative' }}
        onClick={handleBackgroundClick}
      >
        {/* Existing Polls */}
        {polls.map(poll => (
          <PollComponent
            key={poll.id}
            poll={poll}
            votes={getVotesForPoll(poll.id)}
            onVote={() => voteMutation.mutate(poll.id)}
          />
        ))}

        {/* New Poll Form */}
        {showNewPollForm && newPollPosition && (
          <form
            ref={formRef}
            onSubmit={handleCreatePoll}
            className="absolute bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-20"
            style={{
              left: `${newPollPosition.x}px`,
              top: `${newPollPosition.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-2">
              <label htmlFor="pollName" className="block text-sm font-medium text-gray-700">
                Poll Name
              </label>
              <input
                id="pollName"
                type="text"
                value={newPollName}
                onChange={(e) => setNewPollName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter poll name"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewPollForm(false)
                  setNewPollPosition(null)
                  setNewPollName('')
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPollMutation.isPending || !newPollName.trim()}
                className={`inline-flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${createPollMutation.isPending || !newPollName.trim()
                  ? 'bg-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                {createPollMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Poll'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/visual-poller')({
  component: VisualPollerComponent,
  loader: async () => {
    await preloadShape(pollsShape)
    await preloadShape(pollVotesShape)
    return null
  }
})
