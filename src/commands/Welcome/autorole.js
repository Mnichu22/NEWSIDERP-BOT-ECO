import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js'; // Dodano brakujący import

function createAutoroleInfoEmbed(description) {
    return new EmbedBuilder()
        .setColor(getColor('primary'))
        .setDescription(description)
        .setFooter({ text: new Date().toLocaleString() });
}

export default {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Zarządzaj rolami przypisywanymi automatycznie nowym członkom')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Dodaj rolę do automatycznego przypisywania')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Rola, którą chcesz dodać')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Usuń rolę z automatycznego przypisywania')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Rola, którą chcesz usunąć')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Wyświetl listę automatycznie przypisywanych ról')),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Autorole interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'autorole'
            });
            return;
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Musisz posiadać uprawnienie **Zarządzanie serwerem**, aby użyć `/autorole`.' });
        }

        const { options, guild, client } = interaction;
        const subcommand = options.getSubcommand();

        if (subcommand === 'add') {
            const role = options.getRole('role');

            const guildConfig = await getGuildConfig(client, guild.id);
            const verificationEnabled = Boolean(guildConfig.verification?.enabled);
            const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);

            if (verificationEnabled || autoVerifyEnabled) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie możesz dodać AutoRole, gdy system weryfikacji lub AutoVerify jest aktywny. Wyłącz je najpierw.' });
            }
            
            if (role.position >= guild.members.me.roles.highest.position) {
                logger.warn(`[Autorole] Użytkownik ${interaction.user.tag} próbował dodać rolę ${role.name} (${role.id}), która jest wyższa niż najwyższa rola bota na ${guild.name}`);
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie mogę przypisywać ról, które są wyżej w hierarchii niż moja najwyższa rola.' });
            }

            try {
                const config = await getWelcomeConfig(client, guild.id);
                const existingRoles = config.roleIds || [];
                const currentRoleId = existingRoles[0] || null;

                if (currentRoleId === role.id) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Rola ${role} jest już ustawiona jako automatycznie przypisywana.` });
                }

                await updateWelcomeConfig(client, guild.id, { roleIds: [role.id] });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createAutoroleInfoEmbed(
                        currentRoleId
                            ? `✅ Zaktualizowano auto-rolę na ${role}. Dozwolona jest tylko jedna rola.`
                            : `✅ Ustawiono auto-rolę na ${role}.`
                    )],
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                logger.error(`[Autorole] Błąd dodawania roli dla serwera ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas dodawania roli. Spróbuj ponownie.' });
            }
        } 
        
        else if (subcommand === 'remove') {
            const role = options.getRole('role');

            try {
                const config = await getWelcomeConfig(client, guild.id);
                const existingRoles = config.roleIds || [];
                
                if (!existingRoles.includes(role.id)) {
                    return await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `Rola ${role} nie jest ustawiona do automatycznego przypisywania.` });
                }

                await updateWelcomeConfig(client, guild.id, { roleIds: [] });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createAutoroleInfoEmbed(`✅ Usunięto ${role} z automatycznie przypisywanych ról.`)],
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                logger.error(`[Autorole] Błąd usuwania roli dla serwera ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas usuwania roli. Spróbuj ponownie.' });
            }
        }
        
        else if (subcommand === 'list') {
            try {
                const guildConfig = await getGuildConfig(client, guild.id);
                const verificationEnabled = Boolean(guildConfig.verification?.enabled);
                const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);
                const conflictSummary = [
                    verificationEnabled ? 'System weryfikacji jest włączony' : null,
                    autoVerifyEnabled ? 'AutoVerify jest włączony' : null
                ].filter(Boolean).join('\n');

                const config = await getWelcomeConfig(client, guild.id);
                const autoRoles = Array.isArray(config.roleIds) ? config.roleIds : [];

                if (autoRoles.length === 0) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [createAutoroleInfoEmbed(`ℹ️ Brak ustawionej auto-roli.${conflictSummary ?`\n\n⚠️ Blokady konfiguracji:\n${conflictSummary}`: ''}`)],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const role = await guild.roles.fetch(autoRoles[0]);

                if (!role) {
                    await updateWelcomeConfig(client, guild.id, { roleIds: [] });
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [createAutoroleInfoEmbed(`ℹ️ Nie znaleziono poprawnej auto-roli. Nieistniejąca rola została usunięta.${conflictSummary ?`\n\n⚠️ Blokady konfiguracji:\n${conflictSummary}`: ''}`)],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(getColor('info'))
                    .setTitle('Automatycznie przypisywana rola')
                    .setDescription(`${role}${conflictSummary ?`\n\n⚠️ Blokady konfiguracji:\n${conflictSummary}`: ''}`)
                    .setFooter({ text: 'Można skonfigurować tylko jedną auto-rolę.' });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });

            } catch (error) {
                logger.error(`[Autorole] Błąd wyświetlania listy dla serwera ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas pobierania listy ról. Spróbuj ponownie.' });
            }
        }
    },
};
