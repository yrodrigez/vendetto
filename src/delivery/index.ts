import {Client, User} from "discord.js";
import {deduplicateTarget} from "./deduplicateTarget";
import {personalize} from "./personalize";
import {optimizeTextContent} from "./optimizeTextContent";
import {saveBroadlog} from "./saveBroadlog";
import RateLimitedThreadPool from "../util/thread-pool";
import {findUrls} from "./findUrls";
import {registerUrls} from "./registerUrls";
import {registerBroadlogIdInUrl} from "./registerBroadlogIdInUrl";

const threadPool = new RateLimitedThreadPool(5, 5000);

export type Message = {
    content: string
    seedList?: User[] | string[]
    embeds?: any[]
    targetMapping: TargetMapping,
    communicationCode?: string
}

export type TargetMapping = {
    targetName: string
    identifier?: string
}

export type DeliveryParams = {
    id: number
    client: Client
    target: { discordId: string }[]
    targetData: any
    message: Message
    targetMapping: TargetMapping,
}
const userCache = new Map<string, User>();

async function getDiscordUserById(client: Client, discordId: string) {
    if (userCache.has(discordId)) {
        return userCache.get(discordId);
    }

    try {
        const user = await client.users.fetch(discordId);
        userCache.set(discordId, user);
        return user;
    } catch (e) {
        console.error('Error fetching user: ', e);
        return null;
    }
}


export async function createDelivery({
                                         id,
                                         client,
                                         target,
                                         targetData = {},
                                         message,
                                         targetMapping
                                     }: DeliveryParams) {
    if (!client) {
        throw new Error('Client is required')
    }

    if (!target) {
        throw new Error('Target is required')
    }

    if (!message?.content) {
        throw new Error('Message is required')
    }

    const optimizedMessage = optimizeTextContent(message)

    const start = Date.now()
    console.log('Personalization started', optimizedMessage.communicationCode)
    const personalizedMessages = (await Promise.all(deduplicateTarget(target)
        .map(async ({discordId}) => threadPool.submit(async () => {
            const user = await getDiscordUserById(client, discordId);

            if (!user) {
                return null
            }

            const personalized = personalize({
                message: optimizedMessage,
                targetData: (targetData as Record<string, any>),
                memberData: user,
                targetMapping
            })

            const urls = findUrls(personalized)
            const registeredUrls = await registerUrls(id, urls)
            registeredUrls.forEach(({url, id}) => {
                personalized.content = personalized.content.replaceAll(url, `https://t.everlastingvendetta.com/r/${id}`)
            })

            return {
                user: user,
                message: personalized,
                urls: registeredUrls,
            }
        })))).filter((message) => message !== null)
    const personalizationEnd = Date.now()
    console.log(personalizedMessages[0].message,`Personalization finished on: ${personalizationEnd - start}ms`, 'total: ', personalizedMessages.length,
        'will notify: ', personalizedMessages.map((message) => message.user.globalName || message.user.username || message.user.id).join(', ')
    )

    async function send({removeDelay}: { removeDelay?: boolean } = {}) {
        const results = {
            successful: [] as string[],
            failed: [] as string[]
        };

        if (!personalizedMessages.length) {
            console.log('No personalized messages to send')
            return results
        }
        console.log('SENDING MESSAGES IN 5 SECONDS', personalizedMessages)
        if (!removeDelay) {
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
        const start = Date.now()
        console.log('Sending started')
        if (message.seedList?.length) {
            await Promise.all(message.seedList.map(async seed => {
                let user = null
                if (typeof seed === 'string') {
                    user = await getDiscordUserById(client, seed)
                } else {
                    user = seed
                }
                if (!user) {
                    return null
                }
                const randomMessage = personalizedMessages[Math.floor(Math.random() * personalizedMessages.length)]
                if (randomMessage) {
                    personalizedMessages.push({
                        user,
                        message: {
                            ...randomMessage.message,
                            content: `You are part of a seed list:\n${randomMessage.message.content}`
                        },
                        urls: randomMessage.urls
                    })
                }
            }))
        }
        await Promise.all(personalizedMessages.map(async ({user, message, urls}: {
            user: User,
            message: Message
            urls: { url: string, id: string }[]
        }) => threadPool.submit(async () => {
            const {content, embeds, communicationCode} = message
            try {
                await user.send({
                    content,
                    embeds: embeds?.length ? embeds : undefined
                })
                results.successful.push(user.id)
                const {broadlogIds} = await saveBroadlog(id, [{
                    text: content,
                    to: user.id,
                    last_event: 'success' as 'success',
                    channel: 'discord' as 'discord',
                    communication_code: communicationCode ?? '',
                }])

                if (!broadlogIds?.length) return
                console.log(urls)
                await Promise.all((urls ?? []).map(async ({id: urlId}) => {
                    const broadlogId = broadlogIds[0]?.id
                    await registerBroadlogIdInUrl(broadlogId, urlId)
                }))
            } catch (e) {
                console.error('Error sending message to: ', user.username || user.id)
                results.failed.push(user.id)
                const {broadlogIds} = await saveBroadlog(id, [{
                    text: content,
                    to: user.id,
                    last_event: 'error' as 'error',
                    channel: 'discord' as 'discord',
                    communication_code: communicationCode ?? '',
                }])
                if (!broadlogIds?.length) return
                await Promise.all((urls ?? [])?.map(async ({id: urlId}) => {
                    const broadlogId = broadlogIds[0]?.id
                    await registerBroadlogIdInUrl(broadlogId, urlId)
                }))
            }
        })))
        const sendEnd = Date.now()
        console.log('Sending finished on: ', sendEnd - start, 'ms')

        return results
    }

    return {
        send
    }
}