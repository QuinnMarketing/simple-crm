import { prisma } from './prisma'

export type PublishResult = { platformPostId?: string; error?: string }

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  content: string,
  mediaUrls: string[],
  link?: string | null,
): Promise<PublishResult> {
  const body: Record<string, string> = { message: content, access_token: accessToken }
  if (link) body.link = link

  // If there are images, use the photos endpoint for the first image
  if (mediaUrls.length > 0) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrls[0], caption: content, access_token: accessToken }),
    })
    const data = await res.json()
    if (!res.ok || data.error) return { error: data.error?.message ?? `Facebook API error ${res.status}` }
    return { platformPostId: data.post_id ?? data.id }
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) return { error: data.error?.message ?? `Facebook API error ${res.status}` }
  return { platformPostId: data.id }
}

async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  content: string,
  mediaUrls: string[],
): Promise<PublishResult> {
  // Instagram requires at least one image
  const imageUrl = mediaUrls[0]
  if (!imageUrl) return { error: 'Instagram requires an image URL' }

  // Step 1: create media container
  const containerRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: accessToken }),
  })
  const container = await containerRes.json()
  if (!containerRes.ok || container.error) return { error: container.error?.message ?? 'Instagram container creation failed' }

  // Step 2: publish
  const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  })
  const pub = await publishRes.json()
  if (!publishRes.ok || pub.error) return { error: pub.error?.message ?? 'Instagram publish failed' }
  return { platformPostId: pub.id }
}

async function refreshLinkedInToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) return null
  return (await res.json()).access_token ?? null
}

async function publishToLinkedIn(
  authorUrn: string,
  accessToken: string,
  content: string,
  mediaUrls: string[],
  link?: string | null,
): Promise<PublishResult> {
  type PostBody = {
    author: string
    commentary: string
    visibility: string
    distribution: { feedDistribution: string; targetEntities: []; thirdPartyDistributionChannels: [] }
    lifecycleState: string
    isReshareDisabledByAuthor: boolean
    content?: { article: { source: string; title?: string } }
  }

  const body: PostBody = {
    author: authorUrn,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  if (link) {
    body.content = { article: { source: link } }
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 201) {
    const postId = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id') ?? undefined
    return { platformPostId: postId }
  }

  const data = await res.json().catch(() => ({}))
  return { error: data.message ?? data.errorDetails ?? `LinkedIn API error ${res.status}` }
}

async function publishToGoogleBusiness(
  locationName: string,
  accessToken: string,
  content: string,
  mediaUrls: string[],
  link?: string | null,
): Promise<PublishResult> {
  type LocalPost = {
    languageCode: string
    summary: string
    topicType: string
    media?: { mediaFormat: string; sourceUrl: string }[]
    callToAction?: { actionType: string; url: string }
  }
  const post: LocalPost = {
    languageCode: 'en',
    summary: content,
    topicType: 'STANDARD',
  }
  if (mediaUrls.length > 0) {
    post.media = [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrls[0] }]
  }
  if (link) {
    post.callToAction = { actionType: 'LEARN_MORE', url: link }
  }

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(post),
    }
  )
  const data = await res.json()
  if (!res.ok || data.error) return { error: data.error?.message ?? `Google Business API error ${res.status}` }
  return { platformPostId: data.name }
}

/** Publish a SocialPost to all its pending targets. Returns true if all succeeded. */
export async function publishPost(postId: string): Promise<boolean> {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      targets: {
        where: { status: 'pending' },
        include: { socialAccount: true },
      },
    },
  })
  if (!post) return false

  const mediaUrls: string[] = JSON.parse(post.mediaUrls || '[]')
  let anyFailed = false
  let anyPublished = false

  for (const target of post.targets) {
    const acct = target.socialAccount
    let result: PublishResult

    try {
      if (acct.platform === 'facebook') {
        result = await publishToFacebook(acct.platformId, acct.accessToken, post.content, mediaUrls, post.link)
      } else if (acct.platform === 'instagram') {
        result = await publishToInstagram(acct.platformId, acct.accessToken, post.content, mediaUrls)
      } else if (acct.platform === 'linkedin') {
        let token = acct.accessToken
        // Refresh if expired
        if (acct.expiresAt && acct.expiresAt < new Date() && acct.refreshToken) {
          const fresh = await refreshLinkedInToken(acct.refreshToken)
          if (fresh) {
            token = fresh
            await prisma.socialAccount.update({ where: { id: acct.id }, data: { accessToken: fresh } })
          }
        }
        result = await publishToLinkedIn(acct.platformId, token, post.content, mediaUrls, post.link)
      } else if (acct.platform === 'google_business') {
        result = await publishToGoogleBusiness(acct.platformId, acct.accessToken, post.content, mediaUrls, post.link)
      } else {
        result = { error: `Platform ${acct.platform} not supported` }
      }
    } catch (e) {
      result = { error: e instanceof Error ? e.message : 'Unknown error' }
    }

    if (result.error) {
      anyFailed = true
      await prisma.socialPostTarget.update({
        where: { id: target.id },
        data: { status: 'failed', error: result.error },
      })
    } else {
      anyPublished = true
      await prisma.socialPostTarget.update({
        where: { id: target.id },
        data: { status: 'published', platformPostId: result.platformPostId, publishedAt: new Date() },
      })
    }
  }

  const finalStatus = anyFailed && anyPublished ? 'partial' : anyFailed ? 'failed' : 'published'
  await prisma.socialPost.update({ where: { id: postId }, data: { status: finalStatus } })
  return !anyFailed
}
