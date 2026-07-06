const API_URL = 'https://api.fireflies.ai/graphql'

function getApiKey(): string | null {
  return process.env.FIREFLIES_API_KEY || null
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Fireflies is not configured (FIREFLIES_API_KEY missing)')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Fireflies API error ${res.status}`)
  }
  return json.data as T
}

/**
 * Sends the Fireflies bot into an in-progress video meeting (Zoom/Meet/Teams
 * link). Rate limited to 3 requests per 20 minutes at Fireflies' end. Only
 * returns a success boolean — no meeting/transcript id — so correlating the
 * later meeting.transcribed webhook back to this call relies on the `title`
 * we set here, not a returned id.
 */
export async function addBotToMeeting(meetingLink: string, title: string): Promise<void> {
  const query = `
    mutation AddToLiveMeeting($meetingLink: String!, $title: String!) {
      addToLiveMeeting(meeting_link: $meetingLink, title: $title) { success }
    }
  `
  const data = await graphql<{ addToLiveMeeting: { success: boolean } }>(query, { meetingLink, title })
  if (!data.addToLiveMeeting?.success) throw new Error('Fireflies declined to join the meeting')
}

export interface FirefliesTranscript {
  id: string
  title: string
  dateString: string
  duration: number // seconds
  summary?: { overview?: string; shorthand_bullet?: string[] } | null
}

export async function getTranscript(transcriptId: string): Promise<FirefliesTranscript | null> {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        dateString
        duration
        summary { overview shorthand_bullet }
      }
    }
  `
  const data = await graphql<{ transcript: FirefliesTranscript | null }>(query, { transcriptId })
  return data.transcript
}
