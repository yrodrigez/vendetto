import {type Message} from "./";

export function findUrls(message: Message): string[] {
    const urlRegex = /(https?:\/\/[^\s,"'()<>]+(?:\([^\s,"'()<>]*\)|[^\s,"'()<>]*)*)/g;
    const urls = message.content.match(urlRegex);

    return urls?.map(x => x) ?? [];
}
