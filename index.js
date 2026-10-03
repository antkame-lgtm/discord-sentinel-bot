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
// 2. CLIENT DISCORD
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

// Map pour suivre les salons vocaux temporaires (Auto-Voice)
const temporaryChannels = new Set();

// ==========================================
// 3. ENREGISTREMENT DES SLASH COMMANDS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`===============================================`);
    console.log(`✅ Bot connecté avec succès : ${client.user.tag}`);
    console.log(`🛡️ Modules actifs : Sécurité, Auto-Voice, Tickets, Web Keep-Alive`);
    console.log(`===============================================`);
    
    client.user.setActivity('protéger le serveur | /help', { type: 3 }); // 3 = WATCHING

    // Déclaration des commandes slash
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
            .addIntegerOption(option =>
                option.setName('nombre')
                    .setDescription('Nombre de messages à supprimer (1 à 100)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            ),

        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Déployer le panneau de support interactif avec bouton')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    try {
        await client.application.commands.set(commands);
        console.log('⚡ [Slash Commands] Commandes globales enregistrées avec succès (/ping, /help, /clear, /ticket).');
    } catch (err) {
        console.error('[Slash Commands Error]', err);
    }
});

// ==========================================
// 4. GESTION DES INTERACTIONS (Slash Commands & Boutons)
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    // A. COMMANDES SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // Commande /ping
        if (commandName === 'ping') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply({
                content: `🏓 **Pong !** Latence bot : \`${ping}ms\` | Latence API Discord : \`${Math.round(client.ws.ping)}ms\``,
                ephemeral: true
            });
        }

        // Commande /help
        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🛡️ Sentinel Bot - Fonctionnalités & Commandes')
                .setColor(0x5865F2)
                .setDescription('Bot tout-en-un optimisé pour la sécurité, l\'automatisation vocale et le support 24/7.')
                .addFields(
                    { 
                        name: '🛡️ Sécurité & Anti-Scam (Automatique)', 
                        value: 'Détecte et supprime automatiquement les faux liens Discord Nitro et les arnaques Steam en temps réel.' 
                    },
                    { 
                        name: '🔊 Auto-Voice (Automatique)', 
                        value: 'Rejoignez un salon vocal nommé *"Créer"* pour générer automatiquement votre salon privé temporaire (supprimé dès qu\'il est vide).' 
                    },
                    { 
                        name: '🎫 Support & Tickets (`/ticket`)', 
                        value: 'Génère un panneau interactif pour permettre aux membres d\'ouvrir un salon de discussion privé avec l\'équipe.' 
                    },
                    { 
                        name: '🧹 Purge & Modération (`/clear`)', 
                        value: 'Supprime rapidement entre 1 et 100 messages du salon actuel.' 
                    },
                    { 
                        name: '🏓 Diagnostic (`/ping`)', 
                        value: 'Affiche la latence exacte du bot et de la passerelle Discord.' 
                    }
                )
                .setFooter({ text: 'Sentinel Bot • Cloud Ready 24/7' });

            await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        // Commande /clear
        if (commandName === 'clear') {
            const amount = interaction.options.getInteger('nombre');
            
            try {
                const deleted = await interaction.channel.bulkDelete(amount, true);
                await interaction.reply({
                    content: `🧹 **${deleted.size}** message(s) supprimé(s) avec succès !`,
                    ephemeral: true
                });
            } catch (err) {
                console.error('[Clear Error]', err);
                await interaction.reply({
                    content: '❌ Impossible de supprimer ces messages (ils datent peut-être de plus de 14 jours).',
                    ephemeral: true
                });
            }
        }

        // Commande /ticket
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
    }

    // B. BOUTONS INTERACTIFS (Tickets)
    if (interaction.isButton()) {
        // Bouton : Ouvrir un ticket
        if (interaction.customId === 'open_ticket') {
            const user = interaction.user;
            const guild = interaction.guild;
            const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            // Vérifier si un ticket existe déjà pour cet utilisateur
            const existing = guild.channels.cache.find(c => c.name === channelName);
            if (existing) {
                return interaction.reply({
                    content: `⚠️ Vous avez déjà un ticket ouvert ici : <#${existing.id}>`,
                    ephemeral: true
                });
            }

            try {
                // Créer le salon textuel privé
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles
                            ]
                        },
                        {
                            id: client.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels
                            ]
                        }
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

                await interaction.reply({
                    content: `✅ Votre ticket a été créé avec succès : <#${ticketChannel.id}>`,
                    ephemeral: true
                });
            } catch (err) {
                console.error('[Ticket Creation Error]', err);
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la création du ticket. Vérifiez mes permissions administratives.',
                    ephemeral: true
                });
            }
        }

        // Bouton : Fermer le ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({
                content: '🔒 **Clôture du ticket** : Ce salon sera définitivement supprimé dans 5 secondes...'
            });

            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Ticket résolu et fermé.');
                } catch (err) {
                    console.error('[Ticket Delete Error]', err);
                }
            }, 5000);
        }
    }
});

// ==========================================
// 5. MODULE AUTO-VOICE (Salons vocaux éphémères)
// ==========================================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Cas 1 : L'utilisateur rejoint un salon nommé "Créer"
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
    
    // Cas 2 : L'utilisateur quitte un salon temporaire (suppression si vide)
    if (oldState.channel && temporaryChannels.has(oldState.channel.id)) {
        if (oldState.channel.members.size === 0) {
            temporaryChannels.delete(oldState.channel.id);
            try {
                await oldState.channel.delete('Salon vocal temporaire vide.');
            } catch (err) {
                console.error('[Auto-Voice Delete Error]', err);
            }
        }
    }
});

// ==========================================
// 6. MODULE SÉCURITÉ (Anti-Phishing & Scam)
// ==========================================
const suspiciousPatterns = [
    /discord[-.]?(gift|nitro|app[-.]gift)/i,
    /steamcomm[nu]n?ity/i,
    /free[-]?nitro/i,
    /discrod/i
];

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(message.content));
    
    if (isSuspicious) {
        try {
            await message.delete();
            await message.channel.send({
                content: `⚠️ **Alerte Sécurité** : Un message contenant un lien suspect posté par <@${message.author.id}> a été supprimé automatiquement.`
            });
        } catch (err) {
            console.error('[Security Delete Error]', err);
        }
    }
    
    // Raccourci textuel classique !ping
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏓 **Pong !** Latence : \`${ping}ms\` | API : \`${Math.round(client.ws.ping)}ms\``);
    }
});

// ==========================================
// 7. CONNEXION DU BOT
// ==========================================
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('[Discord Login Error] Impossible de connecter le bot :', err.message);
    });
} else {
    console.warn('⚠️ Aucun DISCORD_TOKEN spécifié dans le fichier .env.');
}
