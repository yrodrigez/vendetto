import {type Message} from "./index.js";

export function optimizeTextContent(message: Message): Message {
    // Join lines with new line

    return {
        ...message,
        content: message.content
            .trim() // Trim leading and trailing spaces
            .split('\n') // Split by new line
            .map(line => line.trim()) // Trim each line
            .join('\n')
    }
}