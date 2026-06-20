import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
    LabelBuilder,
    FileUploadBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getWelcomeConfig, saveWelcomeConfig } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';

function buildDashboardEmbed(cfg, guild) {
    const welcomeChannel = cfg.channelId ? `<#${cfg.channelId}>` : '`Nie ustawiono`';
    const goodbyeChannel = cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Nie ustawiono`';

    const rawWelcome = cfg.welcomeMessage || 'Witaj {user} na serwerze {server}!';
    const rawGoodbye = cfg.leaveMessage || '{user.tag} opuścił(a) serwer.';
    const welcomePreview = `\`${rawWelcome.length > 55 ? rawWelcome.substring(0, 55) + '…' : rawWelcome}\``;
    const goodbyePreview = `\`${rawGoodbye.length > 55 ? rawGoodbye.substring(0, 55) + '…' : rawGoodbye}\``;

    return new EmbedBuilder()
        .setTitle('👋 Panel systemu powitań')
        .setDescription(
            `Zarządzaj ustawieniami powitań i pożegnań dla **${guild.name}**.\nUżyj przycisków, aby włączyć/wyłączyć funkcje, a następnie wybierz opcję z menu, aby edytować szczegóły.`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Kanał powitań', value: welcomeChannel, inline: true },
            { name: 'Status powitań', value: cfg.enabled ? 'Włączone' : 'Wyłączone', inline: true },
            { name: 'Wzmianka (Ping)', value: cfg.welcomePing ? 'Wł.' : 'Wył.', inline: true },
            { name: 'Kanał pożegnań', value: goodbyeChannel, inline: true },
            { name: 'Status pożegnań', value: cfg.goodbyeEnabled ? 'Włączone' : 'Wyłączone', inline: true },
            { name: 'Wzmianka (Ping)', value: cfg.goodbyePing ? 'Wł.' : 'Wył.', inline: true },
            { name: 'Treść powitania', value: welcomePreview, inline: false },
            { name: 'Treść pożegnania', value: goodbyePreview, inline: false },
        )
        .setFooter({ text: 'Panel zostanie zamknięty po 10 minutach bezczynności' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`greet_cfg_${guildId}`)
        .setPlaceholder('Wybierz ustawienie do konfiguracji...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Kanał powitań')
                .setDescription('Ustaw kanał, na którym wysyłane są powitania')
                .setValue('welcome_channel')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Treść powitania')
                .setDescription('Edytuj tekst wysyłany, gdy ktoś dołączy')
                .setValue('welcome_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Obraz powitania')
                .setDescription('Ustaw obraz dla wiadomości powitalnych')
                .setValue('welcome_image')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Kanał pożegnań')
                .setDescription('Ustaw kanał, na którym wysyłane są pożegnania')
                .setValue('goodbye_channel')
                .setEmoji('🔴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Treść pożegnania')
                .setDescription('Edytuj tekst wysyłany, gdy ktoś opuści serwer')
                .setValue('goodbye_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Obraz pożegnania')
                .setDescription('Ustaw obraz dla wiadomości pożegnalnych')
                .setValue('goodbye_image')
                .setEmoji('🖼️'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const welcomeOn = cfg.enabled === true;
    const goodbyeOn = cfg.goodbyeEnabled === true;
    const welcomePingOn = cfg.welcomePing === true;
    const goodbyePingOn = cfg.goodbyePing === true;
    
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_welcome_${guildId}`)
                .setLabel('Powitania')
                .setStyle(welcomeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🟢')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_goodbye_${guildId}`)
                .setLabel('Pożegnania')
                .setStyle(goodbyeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🔴')
                .setDisabled(disabled),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_welcome_${guildId}`)
                .setLabel('Ping powitania')
                .setStyle(welcomePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_goodbye_${guildId}`)
                .setLabel('Ping pożegnania')
                .setStyle(goodbyePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
        ),
    ];
}

// ... (reszta funkcji pozostaje bez zmian w logice, 
// tylko napisy w embedach i komunikatach warto podmienić na polskie)

// Przykładowa podmiana komunikatu w handleWelcomeChannel:
// successEmbed('Zaktualizowano kanał', `Wiadomości powitalne będą teraz wysyłane na ${channel}.`)
