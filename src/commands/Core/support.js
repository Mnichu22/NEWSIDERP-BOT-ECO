import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SUPPORT_SERVER_URL = "https://discord.gg/QnWNz2dKCE";

export default {
    data: new SlashCommandBuilder()
    .setName("support")
    .setDescription("Uzyskaj link do serwera wsparcia"),

  async execute(interaction) {
    try {
      const supportButton = new ButtonBuilder()
        .setLabel("Dołącz do serwera wsparcia")
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL);

      const actionRow = new ActionRowBuilder().addComponents(supportButton);

      await InteractionHelper.safeReply(interaction, {
        embeds: [
          createEmbed({ 
            title: "Potrzebujesz pomocy?", 
            description: "Dołącz do naszego oficjalnego serwera wsparcia, aby uzyskać pomoc, zgłosić błędy lub zasugerować nowe funkcje. Jeśli dostosowujesz tego bota, pamiętaj o zmianie linku w kodzie!" 
          }),
        ],
        components: [actionRow],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Błąd komendy support:', error);
      
      try {
        return await InteractionHelper.safeReply(interaction, {
          embeds: [createEmbed({ title: 'Błąd systemu', description: 'Nie udało się wyświetlić informacji o wsparciu.', color: 'error' })],
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        logger.error('Nie udało się wysłać odpowiedzi o błędzie:', replyError);
      }
    }
  },
};
