import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js'; // Dodano brakujący import

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Skonfiguruj system powitań')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Skonfiguruj wiadomość powitalną')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Kanał, na który będą wysyłane powitania')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Wiadomość. Zmienne: {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL obrazu dołączanego do powitania')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Czy oznaczać użytkownika w wiadomości powitalnej')
                        .setRequired(false))),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) {
                logger.warn(`Nie udało się deferować interakcji welcome`, {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'welcome'
                });
                return;
            }
        } catch (deferError) {
            logger.error(`Błąd podczas deferowania welcome`, { error: deferError.message });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Potrzebujesz uprawnienia **Zarządzanie serwerem**, aby użyć `/welcome`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const message = options.getString('message');
            const image = options.getString('image');
            const ping = options.getBoolean('ping') ?? false;

            const existingConfig = await getWelcomeConfig(client, guild.id);
            if (existingConfig?.channelId) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `Powitania są już skonfigurowane na kanale <#${existingConfig.channelId}>. Użyj **/welcome config**, aby zmienić ustawienia.` 
                });
            }
            
            if (!message || message.trim().length === 0) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Wiadomość powitalna nie może być pusta.' });
            }

            if (image) {
                try {
                    new URL(image);
                } catch (e) {
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Podaj poprawny URL obrazu (musi zaczynać się od http:// lub https://).' });
                }
            }

            try {
                await updateWelcomeConfig(client, guild.id, {
                    enabled: true,
                    channelId: channel.id,
                    welcomeMessage: message,
                    welcomeImage: image || undefined,
                    welcomePing: ping
                });

                logger.info(`[Welcome] Skonfigurowano przez ${interaction.user.tag} na serwerze ${guild.name} (${guild.id})`);

                const previewMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                const embed = new EmbedBuilder()
                    .setColor(getColor('success'))
                    .setTitle('System powitań skonfigurowany')
                    .setDescription(`Wiadomości powitalne będą wysyłane na kanał ${channel}`)
                    .addFields(
                        { name: 'Podgląd wiadomości', value: previewMessage },
                        { name: 'Oznaczanie użytkownika', value: ping ? 'Tak' : 'Nie' },
                        { name: 'Status', value: 'Włączony' }
                    )
                    .setFooter({ text: 'Wskazówka: Użyj /welcome config, aby dostosować ustawienia powitań' });

                if (image) {
                    embed.setImage(image);
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                logger.error(`[Welcome] Błąd konfiguracji systemu powitań dla serwera ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas konfigurowania systemu powitań. Spróbuj ponownie.' });
            }
        }
    },
};
