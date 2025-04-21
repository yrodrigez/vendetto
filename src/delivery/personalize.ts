import {type Message, type TargetMapping} from "./";
import Mustache from "mustache";

export function personalize({
                                memberData,
                                targetData,
                                message,
                                targetMapping,
                            }: {
    memberData: Record<string, any>,
    targetData: Record<string, any> | Array<Record<string, any>>,
    message: Message,
    targetMapping: TargetMapping
}): Message {
    // Input validation
    if (!memberData || typeof memberData !== 'object') {
        throw new Error("Invalid member data");
    }

    if (!targetData || typeof targetData !== 'object') {
        throw new Error("Invalid target data");
    }

    if (!targetMapping || typeof targetMapping !== 'object' || !targetMapping?.targetName || typeof targetMapping?.targetName !== 'string') {
        throw new Error("Invalid target mapping");
    }

    if (!message?.content || typeof message?.content !== 'string') {
        throw new Error('Invalid message content');
    }

    if (message.targetMapping.targetName !== targetMapping.targetName) {
        throw new Error('Target mapping mismatch');
    }

    // Prepare data for template rendering
    const combinedData = {
        targetData: (Array.isArray(targetData) && targetMapping.identifier) ? targetData.find(x => x[targetMapping.identifier ?? 'discordId'] === memberData.id) : targetData,
        [targetMapping.targetName]: memberData
    };

    try {
        // Use Mustache to render the template
        const processedContent = Mustache.render(message.content, combinedData);

        // Check Discord character limit
        if (processedContent.length > 2000) {
            throw new Error("Message content exceeds Discord's maximum character limit of 2000 characters.");
        }

        return {
            ...message,
            content: processedContent,
            targetMapping: {
                ...message.targetMapping,
                ...targetMapping
            }
        };
    } catch (error) {
        // Handle Mustache rendering errors
        throw new Error(`Template rendering failed: ${(error as Error).message}`);
    }
}