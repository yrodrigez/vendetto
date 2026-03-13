import { IMessageSenderPort } from "@/application/ports/delivery/IMessageSenderPort";
import { IBroadlogRepositoryPort } from "@/application/ports/delivery/IBroadlogRepositoryPort";
import { IUrlRegistrationPort } from "@/application/ports/delivery/IUrlRegistrationPort";
import { optimizeTextContent } from "@/domain/delivery/services/optimizeTextContent";
import { deduplicateTarget } from "@/domain/delivery/services/deduplicateTarget";
import { personalize } from "@/domain/delivery/services/personalize";
import { findUrls } from "@/domain/delivery/services/findUrls";
import { Message, DeliveryParams } from "@/domain/delivery/models";
import threadPool from "@/util/thread-pool";

export class ProcessDeliveryUseCase {
    constructor(
        private messageSender: IMessageSenderPort,
        private broadlogRepository: IBroadlogRepositoryPort,
        private urlRegistration: IUrlRegistrationPort
    ) { }

    async execute({
        id,
        target,
        targetData = {},
        message,
        targetMapping
    }: Omit<DeliveryParams, 'client'>, options?: { removeDelay?: boolean }) {
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
            .map(async ({ discordId }) => threadPool.submit(async () => {
                const user = await this.messageSender.getUserData(discordId);

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
                const registeredUrls = await this.urlRegistration.registerUrls(id, urls)
                registeredUrls.forEach(({ url, id }) => {
                    personalized.content = personalized.content.replaceAll(url, `https://t.everlastingvendetta.com/r/${id}`)
                })

                return {
                    user: user,
                    message: personalized,
                    urls: registeredUrls,
                }
            })))).filter((message) => message !== null) as { user: any, message: Message, urls: { url: string, id: string }[] }[]

        const personalizationEnd = Date.now()
        console.log(personalizedMessages[0]?.message, `Personalization finished on: ${personalizationEnd - start}ms`, 'total: ', personalizedMessages.length,
            'will notify: ', personalizedMessages.map((message) => message.user.globalName || message.user.username || message.user.id).join(', ')
        )

        const results = {
            successful: [] as string[],
            failed: [] as string[]
        };

        if (!personalizedMessages.length) {
            console.log('No personalized messages to send')
            return results
        }

        console.log('SENDING MESSAGES IN 5 SECONDS', personalizedMessages)
        if (!options?.removeDelay) {
            await new Promise(resolve => setTimeout(resolve, 5000))
        }

        const sendStart = Date.now()
        console.log('Sending started')
        if (message.seedList?.length) {
            await Promise.all(message.seedList.map(async seed => {
                let user = null
                if (typeof seed === 'string') {
                    user = await this.messageSender.getUserData(seed)
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

        await Promise.all(personalizedMessages.map(async ({ user, message, urls }) => threadPool.submit(async () => {
            const { content, embeds, communicationCode } = message
            try {
                await this.messageSender.send(user.id, message)
                results.successful.push(user.id)
                const { broadlogIds } = await this.broadlogRepository.saveBroadlog(id, [{
                    text: content,
                    to: user.id,
                    last_event: 'success' as 'success',
                    channel: 'discord' as 'discord',
                    communication_code: communicationCode ?? '',
                }])

                if (!broadlogIds?.length) return
                console.log(urls)
                await Promise.all((urls ?? []).map(async ({ id: urlId }) => {
                    const broadlogId = broadlogIds[0]?.id
                    if (broadlogId) {
                        await this.broadlogRepository.registerBroadlogIdInUrl(broadlogId, urlId)
                    }
                }))
            } catch (e) {
                console.error('Error sending message to: ', user.username || user.id)
                results.failed.push(user.id)
                const { broadlogIds } = await this.broadlogRepository.saveBroadlog(id, [{
                    text: content,
                    to: user.id,
                    last_event: 'error' as 'error',
                    channel: 'discord' as 'discord',
                    communication_code: communicationCode ?? '',
                }])
                if (!broadlogIds?.length) return
                await Promise.all((urls ?? [])?.map(async ({ id: urlId }) => {
                    const broadlogId = broadlogIds[0]?.id
                    if (broadlogId) {
                        await this.broadlogRepository.registerBroadlogIdInUrl(broadlogId, urlId)
                    }
                }))
            }
        })))
        const sendEnd = Date.now()
        console.log('Sending finished on: ', sendEnd - sendStart, 'ms')

        return results
    }
}
