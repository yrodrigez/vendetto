export interface IUrlRegistrationPort {
    registerUrls(deliveryId: number, urls: string[]): Promise<{ id: string, url: string, deliveryId: number }[]>;
}
