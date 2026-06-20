import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { updateTicketPriority } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("priority")
        .setDescription("Ustawia poziom priorytetu dla bieżącego zgłoszenia.")
        .addStringOption((option) =>
            option
                .setName("poziom")
                .setDescription("Poziom priorytetu zgłoszenia.")
                .setRequired(true)
                .addChoices(
                    { name: "Pilny", value: "urgent" },
                    { name: "Wysoki", value: "high" },
                    { name: "Średni", value: "medium" },
                    { name: "Niski", value: "low" },
                    { name: "Brak", value: "none" },
                ),
        )
        .setDMPermission(false),
    category: "Ticket",

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
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Potrzebujesz uprawnienia `Zarządzanie kanałami` lub skonfigurowanej `Roli obsługi`, aby zmieniać priorytet zgłoszenia.' });
            }

            const priorityLevel = interaction.options.getString("poziom");
            const result = await updateTicketPriority(interaction.channel, priorityLevel, interaction.user);
            
            if (!result.success) {
                logger.warn('Aktualizacja priorytetu nie powiodła się - nieprawidłowy kanał', {
                    userId: interaction.user.id,
                    channelId: interaction.channel.id,
                    guildId: interaction.guildId,
                    error: result.error
                });
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: result.error || 'Ta komenda może być użyta tylko na kanale zgłoszenia.' });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Priorytet zaktualizowany",
                        `Priorytet zgłoszenia ustawiono na **${priorityLevel.toUpperCase()}**.`,
                    ),
                ],
            });

            logger.info('Priorytet zgłoszenia zaktualizowany pomyślnie', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: interaction.channel.id,
                channelName: interaction.channel.name,
                guildId: interaction.guildId,
                priority: priorityLevel,
                commandName: 'priority'
            });

        } catch (error) {
            logger.error('Błąd podczas wykonywania komendy priority', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'priority'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'priority',
                source: 'ticket_priority_command'
            });
        }
    },
};
