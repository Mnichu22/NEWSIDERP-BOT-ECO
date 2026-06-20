// ... (importy zostają bez zmian)

function buildButtonRow(guildConfig, guildId, disabled = false, panelStatus = null) {
    const dmEnabled = guildConfig.dmOnClose !== false;
    const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const buttons = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`ticket_cfg_repost_${guildId}`)
                .setLabel('Opublikuj ponownie')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌')
                .setDisabled(disabled),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
            .setLabel('DM po zamknięciu')
            .setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(dmEnabled ? '📬' : '📭')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
            .setLabel('Rola obsługi')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_delete_${guildId}`)
            .setLabel('Usuń system')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(disabled),
    );

    return new ActionRowBuilder().addComponents(buttons);
}

// ...

function buildPanelEmbed(config) {
    return new EmbedBuilder()
        .setTitle('Zgłoszenia (Support)')
        .setDescription(config.ticketPanelMessage || 'Kliknij poniższy przycisk, aby utworzyć zgłoszenie.')
        .setColor(getColor('info'));
}

function buildPanelButtonRow(config) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel(config.ticketButtonLabel || 'Utwórz zgłoszenie')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩'),
    );
}

// ...

function buildDashboardEmbed(config, guild, panelStatus = null, ticketStats = null) {
    const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : '`Nie ustawiono`';
    const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : '`Nie ustawiono`';
    const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '`Nie ustawiono`';
    const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChannelId}>` : '`Nie ustawiono`';

    const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
    const openCategory = openCategoryChannel ? openCategoryChannel.toString() : '`Nie ustawiono`';
    
    const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config.ticketClosedCategoryId) : null;
    const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString() : '`Nie ustawiono`';

    const rawMsg = config.ticketPanelMessage || 'Kliknij poniższy przycisk, aby utworzyć zgłoszenie.';
    const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
    const btnLabel = `\`${config.ticketButtonLabel || 'Utwórz zgłoszenie'}\``;

    let panelStatusValue = formatPanelStatusField(panelStatus);

    const openTickets = ticketStats ? String(ticketStats.openCount) : '`—`';
    const avgCloseTime = ticketStats ? formatCloseDuration(ticketStats.avgCloseTimeMs) : '`—`';
    const feedbackSummary = ticketStats?.feedbackCount
        ? `${ticketStats.avgRating}/5 (${ticketStats.feedbackCount} ocen${ticketStats.feedbackCount === 1 ? 'y' : 'y'})`
        : '`Brak ocen`';

    return new EmbedBuilder()
        .setTitle('🎫 Panel Systemu Zgłoszeń')
        .setDescription(`Zarządzaj ustawieniami zgłoszeń dla **${guild.name}**.\nWybierz opcję poniżej, aby zmodyfikować ustawienia.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Status panelu', value: panelStatusValue, inline: false },
            { name: 'Kanał panelu', value: panelChannel, inline: true },
            { name: 'Rola obsługi', value: staffRole, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Kategoria otwartych zgłoszeń', value: openCategory, inline: true },
            { name: 'Kategoria zamkniętych zgłoszeń', value: closedCategory, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Wiadomość panelu', value: panelMsg, inline: false },
            { name: 'Nazwa przycisku', value: btnLabel, inline: true },
            { name: 'Limit zgłoszeń/użytkownika', value: String(config.maxTicketsPerUser || 3), inline: true },
            { name: 'DM po zamknięciu', value: config.dmOnClose !== false ? 'Włączone' : 'Wyłączone', inline: true },
            { name: 'Kanał logów', value: ticketLogsChannel, inline: true },
            { name: 'Kanał transkrypcji', value: transcriptChannel, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Otwarte zgłoszenia', value: openTickets, inline: true },
            { name: 'Śr. czas zamknięcia', value: avgCloseTime, inline: true },
            { name: 'Średnia ocen', value: feedbackSummary, inline: true },
        )
        .setFooter({ text: 'Wybierz opcję poniżej • Panel zamyka się po 10 minutach bezczynności' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`ticket_config_${guildId}`)
        .setPlaceholder('Wybierz ustawienie...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Edytuj treść panelu')
                .setDescription('Zmień wiadomość wyświetlaną na panelu tworzenia zgłoszeń')
                .setValue('panel_message')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Edytuj nazwę przycisku')
                .setDescription('Zmień tekst na przycisku tworzenia zgłoszenia')
                .setValue('button_label')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Zmień kategorię otwartych')
                .setDescription('Kategoria, w której tworzone są nowe zgłoszenia')
                .setValue('open_category')
                .setEmoji('📁'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Zmień kategorię zamkniętych')
                .setDescription('Kategoria, do której przenoszone są zamknięte zgłoszenia')
                .setValue('closed_category')
                .setEmoji('📂'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Limit zgłoszeń użytkownika')
                .setDescription('Ogranicz, ile zgłoszeń może mieć użytkownik naraz')
                .setValue('max_tickets')
                .setEmoji('🔢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ustaw kanał logów')
                .setDescription('Kanał otrzymujący powiadomienia i logi zgłoszeń')
                .setValue('logs_channel')
                .setEmoji('🎫'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ustaw kanał transkrypcji')
                .setDescription('Kanał otrzymujący automatyczne transkrypcje po usunięciu')
                .setValue('transcript_channel')
                .setEmoji('📜'),
        );
}
