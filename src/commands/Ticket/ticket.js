import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Zarządza systemem zgłoszeń na serwerze.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Konfiguruje panel tworzenia zgłoszeń na wybranym kanale.")
                .addChannelOption((option) =>
                    option
                        .setName("kanał_panelu")
                        .setDescription("Kanał, na którym zostanie wysłany panel zgłoszeń.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("treść_panelu")
                        .setDescription("Główna wiadomość/opis panelu zgłoszeń.")
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("etykieta_przycisku")
                        .setDescription("Etykieta przycisku tworzenia zgłoszenia (domyślnie: Utwórz zgłoszenie).")
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("kategoria")
                        .setDescription("Kategoria, w której będą tworzone nowe zgłoszenia (opcjonalnie).")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("zamknięta_kategoria")
                        .setDescription("Kategoria, do której będą przenoszone zamknięte zgłoszenia (opcjonalnie).")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName("rola_obsługi")
                        .setDescription("Rola, która może zarządzać zgłoszeniami (opcjonalnie).")
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_zgłoszeń_użytkownika")
                        .setDescription("Maksymalna liczba zgłoszeń, które użytkownik może utworzyć (domyślnie: 3)")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_przy_zamknięciu")
                        .setDescription("Wyślij wiadomość DM do użytkownika po zamknięciu zgłoszenia (domyślnie: true)")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Otwórz interaktywny pulpit zarządzania systemem zgłoszeń."),
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        try {
            
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) {
                return;
            }

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels,
                )
            ) {
                logger.warn('Odmowa uprawnień do komendy ticket', {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket'
                });
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Musisz posiadać uprawnienie `Zarządzanie kanałami`, aby wykonać tę akcję.' });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === "dashboard") {
                return ticketConfig.execute(interaction, config, client);
            }

            if (subcommand === "setup") {
                const existingConfig = await getGuildConfig(client, interaction.guildId);
                if (existingConfig?.ticketPanelChannelId) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Ten serwer ma już skonfigurowany system zgłoszeń (panel w <#${existingConfig.ticketPanelChannelId}>).\n\nObsługiwany jest tylko jeden system zgłoszeń na serwer. Użyj \`/ticket dashboard\`, aby edytować istniejącą konfigurację lub wybierz **Usuń system** w pulpicie, aby zacząć od nowa.` });
                }

                const panelChannel = interaction.options.getChannel("kanał_panelu");
                const categoryChannel = interaction.options.getChannel("kategoria");
                const closedCategoryChannel = interaction.options.getChannel("zamknięta_kategoria");
                const staffRole = interaction.options.getRole("rola_obsługi");
                const panelMessage = interaction.options.getString("treść_panelu") || "Kliknij poniższy przycisk, aby utworzyć zgłoszenie.";
                const buttonLabel = interaction.options.getString("etykieta_przycisku") || "Utwórz zgłoszenie";
                const maxTicketsPerUser = interaction.options.getInteger("max_zgłoszeń_użytkownika") || 3;
                const dmOnClose = interaction.options.getBoolean("dm_przy_zamknięciu") !== false;

                const setupEmbed = createEmbed({ 
                    title: "Wsparcie techniczne", 
                    description: panelMessage,
                    color: getColor('info')
                });

                const ticketButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("create_ticket")
                        .setLabel(buttonLabel)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("📩"),
                );

                try {
                    const sentPanel = await panelChannel.send({
                        embeds: [setupEmbed],
                        components: [ticketButton],
                    });

                    if (client.db && interaction.guildId) {
                        const currentConfig = existingConfig || {};
                        currentConfig.ticketCategoryId = categoryChannel ? categoryChannel.id : null;
                        currentConfig.ticketClosedCategoryId = closedCategoryChannel ? closedCategoryChannel.id : null;
                        currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
                        currentConfig.ticketPanelChannelId = panelChannel.id;
                        currentConfig.ticketPanelMessageId = sentPanel?.id || null;
                        currentConfig.ticketPanelMessage = panelMessage;
                        currentConfig.ticketButtonLabel = buttonLabel;
                        currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                        currentConfig.dmOnClose = dmOnClose;

                        const { getGuildConfigKey } = await import('../../utils/database.js');
                        const configKey = getGuildConfigKey(interaction.guildId);
                        await client.db.set(configKey, currentConfig);
                        logger.info('Konfiguracja zgłoszeń zapisana', { guildId: interaction.guildId });
                    }

                    let successMessage = `Panel tworzenia zgłoszeń został wysłany na kanał ${panelChannel}.`;
                    
                    if (categoryChannel) {
                        successMessage += `\nNowe zgłoszenia będą tworzone w kategorii **${categoryChannel.name}**.`;
                    } else {
                        successMessage += '\nNowe zgłoszenia będą tworzone w nowej kategorii "Zgłoszenia".';
                    }
                    
                    if (closedCategoryChannel) {
                        successMessage += `\nZamknięte zgłoszenia będą przenoszone do **${closedCategoryChannel.name}**.`;
                    }
                    
                    if (staffRole) {
                        successMessage += `\nRola **${staffRole.name}** będzie miała dostęp do zgłoszeń.`;
                    }
                    
                    successMessage += `\n\n**Max zgłoszeń na użytkownika:** ${maxTicketsPerUser}\n**DM przy zamknięciu:** ${dmOnClose ? 'Włączone' : 'Wyłączone'}`;

                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Konfiguracja panelu zakończona",
                                successMessage,
                            ),
                        ],
                    });

                } catch (error) {
                    logger.error('Błąd konfiguracji zgłoszeń', { error: error.message });
                    await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie udało się wysłać panelu lub zapisać konfiguracji. Sprawdź uprawnienia bota.' });
                }
            }
        } catch (error) {
            logger.error('Błąd podczas wykonywania komendy ticket', { error: error.message });
            await handleInteractionError(interaction, error, {
                commandName: 'ticket',
                source: 'ticket_command_main'
            });
        }
    }
};
