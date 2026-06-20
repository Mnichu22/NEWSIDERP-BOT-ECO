import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Sprawdza opóźnienie bota oraz szybkość API"),

    async prefixExecute(interaction) {
        try {
            const startTime = Date.now();
            const pingingMessage = await interaction.reply({ content: 'Sprawdzanie opóźnienia...' });

            const latency = Date.now() - startTime;
            const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));

            const embed = createEmbed({ title: 'Pong!', description: null }).addFields(
                { name: 'Opóźnienie bota', value: `${latency}ms`, inline: true },
                { name: 'Opóźnienie API', value: `${apiLatency}ms`, inline: true },
            );

            await pingingMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            logger.error('Błąd komendy ping (prefix):', error);
            if (!interaction.replied && !interaction._replyMessage) {
                await interaction.channel.send({
                    embeds: [createEmbed({ title: 'Błąd systemu', description: 'Nie udało się ustalić opóźnienia w tym momencie.', color: 'error' })],
                }).catch(() => {});
            }
        }
    },

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Nie udało się odroczyć interakcji ping`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ping'
            });
            return;
        }

        try {
            await InteractionHelper.safeEditReply(interaction, {
                content: "Sprawdzanie opóźnienia...",
            });

            const startTime = interaction._commandStartTime || interaction.createdTimestamp;
            const latency = Math.max(0, Date.now() - startTime);
            const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));

            const embed = createEmbed({ title: "Pong!", description: null }).addFields(
                { name: "Opóźnienie bota", value: `${latency}ms`, inline: true },
                { name: "Opóźnienie API", value: `${apiLatency}ms`, inline: true },
            );

            await InteractionHelper.safeEditReply(interaction, {
                content: null,
                embeds: [embed],
            });
        } catch (error) {
            logger.error('Błąd komendy ping:', error);
            try {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [createEmbed({ title: 'Błąd systemu', description: 'Nie udało się ustalić opóźnienia w tym momencie.', color: 'error' })],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (replyError) {
                logger.error('Nie udało się wysłać odpowiedzi o błędzie:', replyError);
            }
        }
    },
};
