const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    EmbedBuilder,
    Events,
    SlashCommandBuilder
} = require('discord.js');
const express = require('express');
require('dotenv').config();

// ==========================================
// 1. SERVEUR HTTP (Pour le maintien 24/7 sur Render)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send({
        status: 'online',
        uptime: process.uptime(),
        bot: client.user ? client.user.tag : 'Connecting...',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`[Web Server] Serveur HTTP actif sur le port ${PORT} (compatible Render 24/7)`);
});

// ==========================================
// 2. CLIENT DISCORD & CACHES
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Salons vocaux temporaires (Auto-Voice)
const temporaryChannels = new Set();

// Cache pour la détection Anti-Spam rapide
const userMessageHistory = new Map();

// Helper : Envoi dans le salon de logs d'audit
async function sendLog(guild, embed) {
    try {
        const logChannel = guild.channels.cache.find(c => 
            ['logs', 'audit-logs', 'mod-logs', 'bot-logs'].includes(c.name.toLowerCase()) &&
            c.type === ChannelType.GuildText
        );
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[Audit Log Error]', err);
    }
}

// ==========================================
// 3. ENREGISTREMENT DES SLASH COMMANDS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`===============================================`);
    console.log(`✅ Bot connecté avec succès : ${client.user.tag}`);
    console.log(`🛡️ Modules actifs : Sécurité, Anti-Spam, Auto-Voice, Tickets, Modération, Auto-Rôle`);
    console.log(`===============================================`);
    
    client.user.setActivity('protéger le serveur | /help', { type: 3 }); // 3 = WATCHING

    const commands = [
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Afficher la latence du bot et de l\'API Discord'),

        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher la liste des fonctionnalités et commandes du bot'),

        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Purger un nombre de messages dans le salon (Modération)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption(opt =>
                opt.setName('nombre')
                    .setDescription('Nombre de messages à supprimer (1 à 100)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            ),

        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Déployer le panneau de support interactif avec bouton')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Expulser un membre du serveur')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(opt => opt.setName('membre').setDescription('Membre à expulser').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison de l\'expulsion')),

        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Bannir définitivement un membre du serveur')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(opt => opt.setName('membre').setDescription('Membre à bannir').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du bannissement')),

        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Exclure temporairement un membre (mute/slowdown)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(opt => opt.setName('membre').setDescription('Membre à sanctionner').setRequired(true))
            .addIntegerOption(opt => 
                opt.setName('minutes')
                    .setDescription('Durée de l\'exclusion en minutes (ex: 5, 60)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(40320)
            )
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du timeout'))
    ];

    try {
        await client.application.commands.set(commands);
        console.log('⚡ [Slash Commands] Commandes globales enregistrées : /ping, /help, /clear, /ticket, /kick, /ban, /timeout');
    } catch (err) {
        console.error('[Slash Commands Error]', err);
    }
});

// ==========================================
// 4. MODULE BIENVENUE & AUTO-RÔLE
// ==========================================
client.on(Events.GuildMemberAdd, async (member) => {
    const guild = member.guild;

    // 1. Auto-Rôle (attribue le rôle 'Membre' ou 'Member' si configuré)
    try {
        const autoRole = guild.roles.cache.find(r => ['membre', 'member', 'nouveau'].includes(r.name.toLowerCase()));
        if (autoRole && guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await member.roles.add(autoRole);
        }
    } catch (err) {
        console.error('[Auto-Role Error]', err);
    }

    // 2. Message de Bienvenue
    const welcomeChannel = guild.channels.cache.find(c => 
        ['bienvenue', 'welcome', 'arrivées'].includes(c.name.toLowerCase()) &&
        c.type === ChannelType.GuildText
    ) || guild.systemChannel;

    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`👋 Bienvenue sur le serveur, ${member.displayName} !`)
            .setColor(0x00FF88)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Ravi de t'accueillir parmi nous ! Prends connaissance des règles et installe-toi confortablement.\n\n👥 Nous sommes désormais **${guild.memberCount}** membres.`)
            .setTimestamp();

        welcomeChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
    }

    // 3. Log d'audit
    const logEmbed = new EmbedBuilder()
        .setTitle('📥 Nouveau membre')
        .setColor(0x00FF88)
        .setDescription(`<@${member.id}> (${member.user.tag}) a rejoint le serveur.`)
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
    sendLog(guild, logEmbed);
});

// ==========================================
// 5. GESTION DES INTERACTIONS (Commandes & Boutons)
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    // A. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /ping
        if (commandName === 'ping') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply({
                content: `🏓 **Pong !** Latence bot : \`${ping}ms\` | Latence API Discord : \`${Math.round(client.ws.ping)}ms\``,
                ephemeral: true
            });
        }

        // /help
        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🛡️ Sentinel Bot - Liste des Fonctionnalités')
                .setColor(0x5865F2)
                .setDescription('Bot complet intégrant protection, support, modération et salons dynamiques 24/7.')
                .addFields(
                    { name: '🛡️ Sécurité & Anti-Scam', value: 'Détection et suppression immédiate des faux liens Nitro/Steam.' },
                    { name: '🛑 Anti-Raid & Anti-Spam', value: 'Blocage des mentions massives et modération automatique du spam.' },
                    { name: '🔊 Auto-Voice', value: 'Rejoignez un salon nommé *"Créer"* pour ouvrir un salon privé éphémère.' },
                    { name: '🎫 Support (`/ticket`)', value: 'Génère un panneau interactif pour ouvrir des tickets privés.' },
                    { name: '🧹 Modération (`/clear [nombre]`)', value: 'Purge rapide des messages récents.' },
                    { name: '⚖️ Sanctions (`/kick`, `/ban`, `/timeout`)', value: 'Outils de gestion d\'équipe avec journalisation.' },
                    { name: '📜 Logs d\'audit', value: 'Créez un salon nommé `logs` pour enregistrer automatiquement toutes les actions.' }
                )
                .setFooter({ text: 'Sentinel Bot • Cloud Ready 24/7' });

            await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        // /clear
        if (commandName === 'clear') {
            const amount = interaction.options.getInteger('nombre');
            try {
                const deleted = await interaction.channel.bulkDelete(amount, true);
                await interaction.reply({
                    content: `🧹 **${deleted.size}** message(s) supprimé(s) avec succès !`,
                    ephemeral: true
                });

                const logEmbed = new EmbedBuilder()
                    .setTitle('🧹 Nettoyage de salon')
                    .setColor(0xFFA500)
                    .setDescription(`<@${interaction.user.id}> a supprimé **${deleted.size}** messages dans <#${interaction.channel.id}>.`)
                    .setTimestamp();
                sendLog(interaction.guild, logEmbed);
            } catch (err) {
                await interaction.reply({
                    content: '❌ Impossible de supprimer ces messages (ils datent peut-être de plus de 14 jours).',
                    ephemeral: true
                });
            }
        }

        // /ticket
        if (commandName === 'ticket') {
            const ticketEmbed = new EmbedBuilder()
                .setTitle('📩 Centre d\'Assistance & Support')
                .setColor(0x00FF88)
                .setDescription('Besoin d\'aide, d\'un renseignement ou d\'un signalement ?\nCliquez sur le bouton ci-dessous pour ouvrir un salon privé avec l\'équipe du serveur.')
                .setFooter({ text: 'Support rapide et sécurisé' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Ouvrir un ticket')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [ticketEmbed], components: [row] });
        }

        // /kick
        if (commandName === 'kick') {
            const target = interaction.options.getUser('membre');
            const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
            const member = interaction.guild.members.cache.get(target.id);

            if (!member || !member.kickable) {
                return interaction.reply({ content: '❌ Impossible d\'expulser ce membre (rôle supérieur ou introuvable).', ephemeral: true });
            }

            await member.kick(reason);
            await interaction.reply({ content: `✅ **${target.tag}** a été expulsé. (Raison : ${reason})` });

            const logEmbed = new EmbedBuilder()
                .setTitle('👢 Membre expulsé')
                .setColor(0xFF4500)
                .setDescription(`**Membre :** <@${target.id}> (${target.tag})\n**Modérateur :** <@${interaction.user.id}>\n**Raison :** ${reason}`)
                .setTimestamp();
            sendLog(interaction.guild, logEmbed);
        }

        // /ban
        if (commandName === 'ban') {
            const target = interaction.options.getUser('membre');
            const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

            try {
                await interaction.guild.members.ban(target.id, { reason });
                await interaction.reply({ content: `⛔ **${target.tag}** a été banni définitivement. (Raison : ${reason})` });

                const logEmbed = new EmbedBuilder()
                    .setTitle('⛔ Membre banni')
                    .setColor(0xFF0000)
                    .setDescription(`**Membre :** <@${target.id}> (${target.tag})\n**Modérateur :** <@${interaction.user.id}>\n**Raison :** ${reason}`)
                    .setTimestamp();
                sendLog(interaction.guild, logEmbed);
            } catch (err) {
                await interaction.reply({ content: '❌ Impossible de bannir ce membre.', ephemeral: true });
            }
        }

        // /timeout
        if (commandName === 'timeout') {
            const target = interaction.options.getUser('membre');
            const minutes = interaction.options.getInteger('minutes');
            const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
            const member = interaction.guild.members.cache.get(target.id);

            if (!member || !member.moderatable) {
                return interaction.reply({ content: '❌ Impossible de sanctionner ce membre.', ephemeral: true });
            }

            await member.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ content: `⏳ **${target.tag}** a été exclu temporairement pour **${minutes} minute(s)**. (Raison : ${reason})` });

            const logEmbed = new EmbedBuilder()
                .setTitle('⏳ Membre mis en sourdine (Timeout)')
                .setColor(0xFFA500)
                .setDescription(`**Membre :** <@${target.id}> (${target.tag})\n**Durée :** ${minutes} min\n**Modérateur :** <@${interaction.user.id}>\n**Raison :** ${reason}`)
                .setTimestamp();
            sendLog(interaction.guild, logEmbed);
        }
    }

    // B. BOUTONS (Tickets)
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const user = interaction.user;
            const guild = interaction.guild;
            const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const existing = guild.channels.cache.find(c => c.name === channelName);
            if (existing) {
                return interaction.reply({ content: `⚠️ Vous avez déjà un ticket ouvert ici : <#${existing.id}>`, ephemeral: true });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`🎫 Ticket de ${user.displayName}`)
                    .setColor(0x5865F2)
                    .setDescription(`Bonjour <@${user.id}> !\nExpliquez précisément votre demande ici. Un membre de l'équipe va vous répondre.\n\nPour clôturer cette demande, cliquez sur **Fermer le ticket**.`)
                    .setTimestamp();

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Fermer le ticket')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeRow] });
                await interaction.reply({ content: `✅ Ticket créé : <#${ticketChannel.id}>`, ephemeral: true });

                const logEmbed = new EmbedBuilder()
                    .setTitle('🎫 Nouveau ticket ouvert')
                    .setColor(0x5865F2)
                    .setDescription(`<@${user.id}> a ouvert le salon <#${ticketChannel.id}>.`)
                    .setTimestamp();
                sendLog(guild, logEmbed);
            } catch (err) {
                await interaction.reply({ content: '❌ Erreur de création du ticket.', ephemeral: true });
            }
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 **Clôture du ticket** : Ce salon sera supprimé dans 5 secondes...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Ticket résolu.');
                } catch (err) {}
            }, 5000);
        }
    }
});

// ==========================================
// 6. MODULE AUTO-VOICE (Salons vocaux éphémères)
// ==========================================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.channel && newState.channel.name.toLowerCase().includes('créer')) {
        const guild = newState.guild;
        const member = newState.member;
        
        try {
            const tempChannel = await guild.channels.create({
                name: `🔊 Salon de ${member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parentId || null,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers
                        ]
                    }
                ]
            });
            
            temporaryChannels.add(tempChannel.id);
            await member.voice.setChannel(tempChannel);
        } catch (err) {
            console.error('[Auto-Voice Error]', err);
        }
    }
    
    if (oldState.channel && temporaryChannels.has(oldState.channel.id)) {
        if (oldState.channel.members.size === 0) {
            temporaryChannels.delete(oldState.channel.id);
            try {
                await oldState.channel.delete('Salon vocal temporaire vide.');
            } catch (err) {}
        }
    }
});

// ==========================================
// 7. MODULE SÉCURITÉ, ANTI-SCAM & ANTI-SPAM
// ==========================================
const suspiciousPatterns = [
    /discord[-.]?(gift|nitro|app[-.]gift)/i,
    /steamcomm[nu]n?ity/i,
    /free[-]?nitro/i,
    /discrod/i
];

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const member = message.member;

    // A. Anti-Phishing
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(message.content));
    if (isSuspicious) {
        try {
            await message.delete();
            await message.channel.send({
                content: `⚠️ **Alerte Sécurité** : Un message contenant un lien suspect posté par <@${message.author.id}> a été supprimé.`
            });

            const logEmbed = new EmbedBuilder()
                .setTitle('🚨 Alerte Phishing / Scam')
                .setColor(0xFF0000)
                .setDescription(`**Auteur :** <@${message.author.id}>\n**Salon :** <#${message.channel.id}>\n**Message supprimé :** \`\`\`${message.content}\`\`\``)
                .setTimestamp();
            sendLog(message.guild, logEmbed);
        } catch (err) {}
        return;
    }

    // B. Anti-Raid : Mentions massives (@everyone / @here sans permission)
    if ((message.content.includes('@everyone') || message.content.includes('@here')) && !member.permissions.has(PermissionFlagsBits.MentionEveryone)) {
        try {
            await message.delete();
            if (member.moderatable) {
                await member.timeout(10 * 60 * 1000, 'Tentative de mention massive (@everyone)');
            }
            await message.channel.send(`🛑 <@${message.author.id}> a été exclu 10 minutes pour mention massive interdite.`);
        } catch (err) {}
        return;
    }

    // C. Anti-Spam (limite de fréquence : 5 messages en 4 secondes)
    const now = Date.now();
    const timestamps = userMessageHistory.get(message.author.id) || [];
    const recent = timestamps.filter(time => now - time < 4000);
    recent.push(now);
    userMessageHistory.set(message.author.id, recent);

    if (recent.length >= 5) {
        try {
            if (member && member.moderatable) {
                await member.timeout(2 * 60 * 1000, 'Spam rapide détecté');
                await message.channel.send(`⏱️ <@${message.author.id}> a été mis en sourdine 2 minutes pour spam.`);
            }
        } catch (err) {}
    }

    // Raccourci !ping
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏓 **Pong !** Latence : \`${ping}ms\` | API : \`${Math.round(client.ws.ping)}ms\``);
    }
});

// ==========================================
// 8. CONNEXION DU BOT
// ==========================================
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('[Discord Login Error] Impossible de connecter le bot :', err.message);
    });
} else {
    console.warn('⚠️ Aucun DISCORD_TOKEN spécifié dans le fichier .env.');
}
