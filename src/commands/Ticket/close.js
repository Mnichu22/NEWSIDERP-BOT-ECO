import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Zamyka bieżące zgłoszenie.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("powód")
                .setDescription("Powód zamknięcia zgłoszenia.")
                .setRequired(false),
        ),

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

            if (!permissionContext.canCloseTicket) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Musisz posiadać uprawnienie `Zarządzanie kanałami`, skonfigurowaną `Rolę obsługi` lub być twórcą zgłoszenia, aby je zamknąć.' });
            }

            const channel = interaction.channel;
            const reason =
                interaction.options?.getString("powód") ||
                "Zamknięto komendą bez podania powodu.";

            const result = await closeTicket(channel, interaction.user, reason);
            
            if (!result.success) {
                logger.warn('Zamykanie zgłoszenia nie powiodło się - nieprawidłowy kanał', {
                    userId: interaction.user.id,
                    channelId: channel.id,
                    guildId: interaction.guildId,
                    error: result.error
                });
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: result.error || 'Ta komenda może być użyta tylko na kanale zgłoszenia.' });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Zgłoszenie zamknięte!",
                        "Zgłoszenie zostało pomyślnie zamknięte.",
                    ),
                ],
            });

            logger.info('Zgłoszenie zamknięte pomyślnie', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                guildId: interaction.guildId,
                reason: reason,
                commandName: 'close'
            });

        } catch (error) {
            logger.error('Błąd podczas wykonywania komendy close', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'close'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'close',
                source: 'ticket_close_command'
            });
        }
    },
};
