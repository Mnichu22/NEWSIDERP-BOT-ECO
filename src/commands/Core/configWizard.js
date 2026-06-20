import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    LabelBuilder,
    ChannelType,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildConfig, setConfigValue } from '../../services/guildConfig.js';
import ConfigService from '../../services/configService.js';
import { logger } from '../../utils/logger.js';
import { botConfig } from '../../config/bot.js';

const DASHBOARD_CUSTOM_ID = 'config_select';
const WIZARD_BUTTON_ID = 'config_wizard';
const activeWizardSessions = new Set();

const DM_DISABLED_HELP = [
    '1. Kliknij prawym przyciskiem myszy na nazwę serwera.',
    '2. Otwórz **Ustawienia prywatności**.',
    '3. Włącz opcję **Zezwalaj na prywatne wiadomości od członków serwera**.',
    '4. Ponownie uruchom kreator konfiguracji.',
].join('\n');

async function notifyWizardStarted(buttonInteraction) {
    await buttonInteraction.followUp({
        embeds: [infoEmbed(
            'Uruchomiono kreator konfiguracji',
            'Sprawdź swoje wiadomości prywatne (DM) — wysłałem tam pierwsze pytanie.\n\nOdpowiadaj na pytania w DM. Napisz `skip`, aby zachować obecną wartość.',
        )],
        flags: MessageFlags.Ephemeral,
    }).catch(() => {});
}

async function notifyWizardDmBlocked(buttonInteraction) {
    await replyUserError(buttonInteraction, {
        type: ErrorTypes.USER_INPUT,
        message: `Nie mogłem wysłać Ci wiadomości prywatnej. Włącz wiadomości DM od członków serwera i spróbuj ponownie:\n\n${DM_DISABLED_HELP}`,
    }).catch(() => {});
}

function formatChannelMention(guild, channelId) {
    if (!channelId) return '`Brak`';
    const channel = guild.channels.cache.get(channelId);
    return channel ? `<#${channelId}>` : `#${channelId}`;
}

function formatRoleMention(guild, roleId) {
    if (!roleId) return '`Brak`';
    const role = guild.roles.cache.get(roleId);
    return role ? `<@&${roleId}>` : `@${roleId}`;
}

function getBotPresenceText() {
    const activity = botConfig.presence?.activities?.[0];
    if (!activity?.name) return '`Nieskonfigurowano`';

    const typeLabels = ['Gra w', 'Streamuje', 'Słucha', 'Ogląda', '', 'Rywalizuje w'];
    const typeLabel = typeLabels[activity.type];
    return typeLabel ? `${typeLabel} **${activity.name}**` : activity.name;
}

function getThemeColorLines() {
    const colors = botConfig.embeds.colors;
    return [
        `🎨 Podstawowy \`${colors.primary}\` · Sukces \`${colors.success}\``,
        `⚠️ Ostrzeżenie \`${colors.warning}\` · Błąd \`${colors.error}\``,
    ].join('\n');
}

function buildDashboardEmbed(config, guild) {
    const setupDone = config.setupWizardCompleted;
    return createEmbed({
        title: '⚙️ Konfiguracja serwera',
        description: `Główne ustawienia dla **${guild.name}**. Wybierz opcję z menu lub uruchom kreator konfiguracji.`,
        color: 'info',
        fields: [
            { name: '⌨️ Prefiks serwera', value: `\`${config.prefix || guild.client.config.bot.prefix || '!'}\``, inline: true },
            { name: '🛡️ Rola moderatora', value: formatRoleMention(guild, config.modRole), inline: true },
            { name: '📋 Kanał logów', value: formatChannelMention(guild, config.logging?.channels?.audit), inline: true },
            { name: '💚 Status bota', value: getBotPresenceText(), inline: false },
            { name: '🎨 Motyw embedów', value: `${getThemeColorLines()}\n-# Kolory są ustawione globalnie w konfiguracji bota.`, inline: false },
            { name: '⚡ Dostęp do komend', value: 'Użyj `/commands dashboard`, aby zarządzać dostępnością komend.', inline: false },
            { name: `${setupDone ? '✅' : '📝'} Kreator konfiguracji`, value: setupDone ? 'Kreator zakończony — uruchom ponownie, aby zmienić ustawienia.' : 'Uruchom kreator, aby szybko skonfigurować serwer.', inline: false },
        ],
        footer: 'Panel zostanie zamknięty po 10 minutach nieaktywności',
    });
}

function buildSettingsSelect(guildId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`${DASHBOARD_CUSTOM_ID}:${guildId}`)
            .setPlaceholder('⚙️ Wybierz ustawienie do edycji...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Prefiks serwera').setDescription('Zmień prefiks komend').setValue('prefix').setEmoji('⌨️'),
                new StringSelectMenuOptionBuilder().setLabel('Rola moderatora').setDescription('Rola używana do komend moderacyjnych').setValue('modRole').setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder().setLabel('Kanał logów').setDescription('Kanał dla logów systemowych').setValue('logChannelId').setEmoji('📋'),
            ),
    );
}

function buildButtonRow(config, guildId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${WIZARD_BUTTON_ID}:${guildId}`)
            .setLabel(config.setupWizardCompleted ? 'Uruchom ponownie kreator' : 'Uruchom kreator')
            .setEmoji('📝')
            .setStyle(config.setupWizardCompleted ? ButtonStyle.Secondary : ButtonStyle.Success),
    );
}

// ... (reszta logiki: askQuestion, runSetupWizard, modals itp. pozostaje analogiczna, 
// z komunikatami w języku polskim, np. w askQuestion: "Setup Question" -> "Pytanie konfiguracyjne")
