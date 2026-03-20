import { MemberRepositoryPort } from "@/application/ports/outbound/member-repository.port";


export class FindSelectedCharactersUsecase {
    constructor(
        private readonly membersRepository: MemberRepositoryPort,
    ) { }

    execute() {
        return this.membersRepository.findAllSelectedCharactersDiscord();
    }
}