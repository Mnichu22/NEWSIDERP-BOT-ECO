import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import greetDashboard from './modules/greet_dashboard.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('greet')
        .setDescription('Zarządzaj ustawieniami powitań i pożegnań')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Otwórz panel konfiguracji powitań i pożegnań'),
        ),

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.PERMISSION, 
                    message: 'Potrzebujesz uprawnienia **Zarządzanie serwerem**, aby użyć `/greet`.' 
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'dashboard':
                    return await greetDashboard.execute(interaction, config, client);
                default:
                    logger.warn(`Nieznana podkomenda /greet: ${subcommand}`);
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.CONFIGURATION, 
                    message: error.userMessage || 'Wystąpił błąd podczas konfiguracji.' 
                });
            }
            await handleInteractionError(interaction, error, { command: 'greet' });
        }
    },
};
