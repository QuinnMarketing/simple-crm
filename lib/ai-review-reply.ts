import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateReviewReply(opts: {
  reviewerName: string
  rating: number
  reviewText: string | null
  businessName: string
  toneGuide?: string // from settings (positive/neutral/negative field)
}): Promise<string> {
  const { reviewerName, rating, reviewText, businessName, toneGuide } = opts

  const sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative'

  const systemPrompt = [
    `You are writing a public Google review reply on behalf of ${businessName}.`,
    'Write a genuine, personalised reply that sounds human — not generic or corporate.',
    'Keep it concise (2–4 sentences). Do not use hashtags or emojis.',
    'Do not repeat the reviewer\'s name more than once.',
    toneGuide ? `Tone / style guidance: ${toneGuide}` : '',
  ].filter(Boolean).join('\n')

  const userPrompt = [
    `Reviewer: ${reviewerName}`,
    `Star rating: ${rating}/5 (${sentiment})`,
    reviewText ? `Review text: "${reviewText}"` : '(No review text provided)',
    '',
    'Write a reply to this review.',
  ].join('\n')

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 300,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  if (!text) throw new Error('AI returned an empty reply')
  return text
}
