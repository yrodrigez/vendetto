export interface DeliveryRepositoryPort {
    findDeliveryByName(name: string): Promise<{ id: number, name: string } | null>;
}