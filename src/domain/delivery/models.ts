import { User } from "discord.js";

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

export type DeliveryRecipient = {
    discordId: string
}

export type DeliveryParams = {
    id: number
    client: any
    target: DeliveryRecipient[]
    targetData: any
    message: Message
    targetMapping: TargetMapping,
}
