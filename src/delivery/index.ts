import {Client, User} from "discord.js";
import {deduplicateTarget} from "./deduplicateTarget";
import {personalize} from "./personalize";
import {optimizeTextContent} from "./optimizeTextContent";
import {saveBroadlog} from "./saveBroadlog";
import RateLimitedThreadPool from "../util/thread-pool";

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
    client: Client
    target: { discordId: string }[]
    targetData: any
    message: Message
    targetMapping: TargetMapping,
}

async function getDiscordUserById(client: Client, discordId: string) {
    try {
        return await client.users.fetch(discordId)
    } catch (e) {
        console.error('Error fetching user: ', e)
        return null
    }
}

export async function createDelivery({
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
    console.log('Personalization started')
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

            return {
                user: user,
                message: personalized
            }
        })))).filter((message) => message !== null)
    const personalizationEnd = Date.now()
    console.log('Personalization finished on: ', personalizationEnd - start, 'ms', personalizedMessages[0], 'total: ', personalizedMessages.length)

    async function send({removeDelay}: { removeDelay?: boolean } = {}) {
        const results = {
            successful: [] as string[],
            failed: [] as string[]
        };

        if (!personalizedMessages.length) {
            console.log('No personalized messages to send')
            return results
        }
        console.log('SENDING MESSAGES IN 5 SECONDS')
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
                        message: {content: `You are part of a seed list:\n${randomMessage.message.content}`}
                    })
                }
            }))
        }
        await Promise.all(personalizedMessages.map(async ({user, message}: {
            user: User,
            message: Message
        }) => threadPool.submit(async () => {
            const {content, embeds} = message
            try {
                await user.send({
                    content,
                    embeds: embeds?.length ? embeds : undefined
                })
                results.successful.push(user.id)
            } catch (e) {
                console.error('Error sending message: ', e)
                results.failed.push(user.id)
            }
        })))
        const sendEnd = Date.now()
        console.log('Sending finished on: ', sendEnd - start, 'ms')


        await saveBroadlog([
            ...results.successful.map((userId => {
                const personalized = personalizedMessages.find((message) => message.user.id === userId)

                return {
                    text: personalized?.message?.content ?? '',
                    to: userId,
                    last_event: 'success' as 'success',
                    channel: 'discord' as 'discord',
                    communication_code: personalized?.message?.communicationCode ?? '',
                }
            })),
            ...results.failed.map((userId => {
                const personalized = personalizedMessages.find((message) => message.user.id === userId)

                return {
                    text: personalized?.message?.content ?? '',
                    to: userId,
                    last_event: 'error' as 'error',
                    channel: 'discord' as 'discord'
                }
            }))
        ])

        return results
    }

    return {
        send
    }
}