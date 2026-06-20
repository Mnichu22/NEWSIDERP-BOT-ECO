import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js'; // Zakładam, że tu trzymasz handlery błędów

export default {
    data: new SlashCommandBuilder()
        .setName('goodbye')
        .setDescription('Skonfiguruj system wiadomości pożegnalnych')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Skonfiguruj wiadomość pożegnalną')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Kanał, na który będą wysyłane pożegnania')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Wiadomość. Zmienne: {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL obrazu dołączanego do pożegnania')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Czy oznaczać użytkownika w wiadomości pożegnalnej')
                        .setRequired(false))),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Goodbye interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'goodbye'
            });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Potrzebujesz uprawnienia **Zarządzanie serwerem**, aby użyć `/goodbye`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const message = options.getString('message');
            const image = options.getString('image');
            const ping = options.getBoolean('ping') ?? false;

            const existingConfig = await getWelcomeConfig(client, guild.id);
            if (existingConfig?.goodbyeChannelId) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `System pożegnań jest już skonfigurowany na kanale <#${existingConfig.goodbyeChannelId}>. Użyj **/goodbye config**, aby zmienić ustawienia.` 
                });
            }

            if (!message || message.trim().length === 0) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Wiadomość pożegnalna nie może być pusta.' });
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
                    goodbyeEnabled: true,
                    goodbyeChannelId: channel.id,
                    leaveMessage: message,
                    goodbyePing: ping,
                    leaveEmbed: {
                        title: "Żegnaj {user.tag}",
                        description: message,
                        color: getColor('error'),
                        footer: `Do zobaczenia na ${guild.name}!`,
                        ...(image && { image: { url: image } })
                    }
                });

                logger.info(`[Goodbye] Skonfigurowano przez ${interaction.user.tag} na serwerze ${guild.name} (${guild.id})`);

                const previewMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                const embed = new EmbedBuilder()
                    .setColor(getColor('success'))
                    .setTitle('System pożegnań skonfigurowany')
                    .setDescription(`Wiadomości pożegnalne będą wysyłane na kanał ${channel}`)
                    .addFields(
                        { name: 'Podgląd wiadomości', value: previewMessage },
                        { name: 'Oznaczanie użytkownika', value: ping ? 'Tak' : 'Nie' },
                        { name: 'Status', value: 'Włączony' }
                    )
                    .setFooter({ text: 'Wskazówka: Użyj /goodbye config, aby dostosować ustawienia pożegnań' });

                if (image) {
                    embed.setImage(image);
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                logger.error(`[Goodbye] Błąd konfiguracji systemu pożegnań dla serwera ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas konfigurowania systemu pożegnań. Spróbuj ponownie.' });
            }
        }
    },
};
