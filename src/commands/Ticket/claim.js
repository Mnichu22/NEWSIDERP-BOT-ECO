import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { claimTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Przejmij otwarte zgłoszenie, przypisując je do siebie.")
        .setDMPermission(false),

    async execute(interaction, guildConfig, client) {
        try {
            
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) {
                return;
            }

            const permissionContext = await getTicketPermissionContext({ client, interaction });
            if (!permissionContext.ticketData) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ta komenda może być użyta tylko na kanale zgłoszenia.' });
            }

            if (!permissionContext.canManageTicket) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Potrzebujesz uprawnienia `Zarządzanie kanałami` lub odpowiedniej `Roli obsługi`, aby przejmować zgłoszenia.' });
            }

            const channel = interaction.channel;
            const result = await claimTicket(channel, interaction.user);
            
            if (!result.success) {
                logger.warn('Przejmowanie zgłoszenia nie powiodło się - nieprawidłowy kanał', {
                    userId: interaction.user.id,
                    channelId: channel.id,
                    guildId: interaction.guildId,
                    error: result.error
                });
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: result.error || "Ta komenda może być użyta tylko na kanale zgłoszenia." });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Zgłoszenie przejęte!",
                        "Pomyślnie przejąłeś to zgłoszenie.",
                    ),
                ],
            });

            logger.info('Zgłoszenie przejęte pomyślnie', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                guildId: interaction.guildId,
                commandName: 'claim'
            });

        } catch (error) {
            logger.error('Błąd podczas wykonywania komendy claim', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'claim'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'claim',
                source: 'ticket_claim_command'
            });
        }
    },
};
