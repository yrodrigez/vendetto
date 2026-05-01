export const getMessage = (resetName: string, resetId: string) => {
    const messages = [
        `*Blub... blub...* 🐙

        Hey @here,
        Looks like the Raid Leader forgot to close the reservations for **${resetName}**. Again.

        No worries — I stepped in before chaos became a feature. Reservations are now closed.

        Don’t thank the Raid Leader… thank me. I’m basically doing maintenance at this point.

        In case your memory needs a little refresh:
        [click here](<https://www.everlastingvendetta.com/raid/${resetId}/soft-reserv>)

        If you think I messed up (unlikely, but cute), go tell the Raid Leader.

        Yours truly,
        Vendetto.`,
        `*Blub... blub...* 🐙

        Hey @here,
        The reservations for **${resetName}** were still open. I assume that was… intentional. Sure.

        Anyway, I closed them. No more last-minute hero entries.

        Don’t thank the Raid Leader… thank me. Someone has to press the obvious buttons.

        For those already confused about your reservations:
        [here they are](<https://www.everlastingvendetta.com/raid/${resetId}/soft-reserv>)

        If I somehow messed up, feel free to escalate it. I enjoy the drama.

        Yours truly,
        Vendetto.`,
        `*Blub... blub...* 🐙

        Hey @here,
        Looks like the reservations for **${resetName}** were left open. Bold strategy.

        I’ve closed them now before things got… creatively unfair.

        Don’t thank the Raid Leader… thank me. I prefer results over intentions.

        If you’re wondering what you signed up for (as usual):
        [here they are](<https://www.everlastingvendetta.com/raid/${resetId}/soft-reserv>)

        If you think I’m wrong, you can let the Raid Leader know. I’m sure they’ll appreciate it.

        Yours truly,
        Vendetto.`,
        `*Blub... blub...* 🐙

        Hey @here,
        Reservations for **${resetName}** were still open. That was not going to end well.

        So I closed them. Problem solved.

        Don’t thank the Raid Leader… thank me. I intervene before things spiral.

        If you’ve already forgotten your choices:
        [here they are](<https://www.everlastingvendetta.com/raid/${resetId}/soft-reserv>)

        If there’s an issue, report it. I’ll pretend to be surprised.

        Yours truly,
        Vendetto.`,
        `*Blub... blub...* 🐙

        Hey @here,
        The reservations for **${resetName}** were still open. I’ll let you guess how that usually ends.

        I’ve closed them now. You’re welcome.

        Don’t thank the Raid Leader… thank me. I’m the safety net you didn’t ask for.

        If you need to double-check your “carefully planned” picks:
        [here they are](<https://www.everlastingvendetta.com/raid/${resetId}/soft-reserv>)

        If you think something’s off, go ahead and raise it. Confidence is admirable.

        Yours truly,
        Vendetto.`
    ]

    const message = messages[Math.floor(Math.random() * messages.length)];
    return message.split('\n').map(line => line.trim()).join('\n');
}