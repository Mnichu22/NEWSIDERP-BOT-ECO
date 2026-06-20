import { SlashCommandBuilder, version, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Wyświetla statystyki bota"),

  async execute(interaction) {
    try {
      await InteractionHelper.safeDefer(interaction);
      
      const totalGuilds = interaction.client.guilds.cache.size;
      const totalMembers = interaction.client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0,
      );
      const nodeVersion = process.version;

      const embed = createEmbed({ 
          title: "Statystyki systemu", 
          description: "Wydajność bota w czasie rzeczywistym." 
      }).addFields(
        { name: "Serwery", value: `${totalGuilds}`, inline: true },
        { name: "Użytkownicy", value: `${totalMembers}`, inline: true },
        { name: "Wersja Node.js", value: `${nodeVersion}`, inline: true },
        { name: "Wersja Discord.js", value: `v${version}`, inline: true },
        {
          name: "Zużycie pamięci",
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          inline: true,
        },
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Błąd komendy stats:', error);
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({ 
            title: 'Błąd systemu', 
            description: 'Nie udało się pobrać statystyk systemu.', 
            color: 'error' 
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
