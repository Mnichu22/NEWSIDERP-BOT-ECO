import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { infoEmbed, successEmbed } from '../../utils/embeds.js';
import { withErrorHandling, ErrorTypes } from '../../utils/errorHandler.js'; // Dodano import ErrorTypes, aby uniknąć błędu
import { verifyUser } from '../../services/verificationService.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Zweryfikuj się i uzyskaj dostęp do serwera'),

    async execute(interaction, config, client) {
        const wrappedExecute = withErrorHandling(async () => {
            const guild = interaction.guild;

            const result = await verifyUser(client, guild.id, interaction.user.id, {
                source: 'command_self',
                moderatorId: null
            });

            if (!result.success) {
                if (result.alreadyVerified) {
                    return await InteractionHelper.safeReply(interaction, {
                        embeds: [infoEmbed('Już zweryfikowano', "Jesteś już zweryfikowany.")],
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Zakładam, że w Twoim kodzie istnieje funkcja replyUserError, jeśli nie, użyj InteractionHelper.safeReply
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [infoEmbed('Błąd', 'Podczas weryfikacji wystąpił błąd. Spróbuj ponownie lub skontaktuj się z administracją.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            await InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed(
                    "Weryfikacja zakończona",
                    `Zostałeś zweryfikowany i otrzymałeś rolę **${result.roleName}**! Witamy na serwerze! 🎉`
                )],
                flags: MessageFlags.Ephemeral
            });
        }, { command: 'verify' });

        return await wrappedExecute(interaction, config, client);
    }
};
