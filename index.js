const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    EmbedBuilder
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
// 3. ÉVÉNEMENT READY
// ==========================================
client.once('ready', () => {
    console.log(`===============================================`);
    console.log(`✅ Bot connecté avec succès : ${client.user.tag}`);
    console.log(`🛡️ Modules actifs : Sécurité, Auto-Voice, Tickets, Web Keep-Alive`);
    console.log(`===============================================`);
    
    // Définir le statut du bot
    client.user.setActivity('protéger le serveur | /help', { type: 3 }); // 3 = WATCHING
});

// ==========================================
// 4. MODULE AUTO-VOICE (Salons vocaux éphémères)
// ==========================================
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Cas 1 : L'utilisateur rejoint un salon "Créer un vocal"
    if (newState.channel && newState.channel.name.toLowerCase().includes('créer')) {
        const guild = newState.guild;
        const member = newState.member;
        
        try {
            // Créer le salon temporaire
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
            
            // Enregistrer l'ID du salon temporaire
            temporaryChannels.add(tempChannel.id);
            
            // Déplacer l'utilisateur dans son nouveau salon
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
// 5. MODULE SÉCURITÉ (Anti-Phishing basique & liens malveillants)
// ==========================================
const suspiciousPatterns = [
    /discord[-.]?(gift|nitro|app[-.]gift)/i,
    /steamcomm[nu]n?ity/i,
    /free[-]?nitro/i,
    /discrod/i
];

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // Test simple de détection de lien de phishing
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
    
    // Commande basique !ping
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏓 **Pong !** Latence : \`${ping}ms\` | API : \`${Math.round(client.ws.ping)}ms\``);
    }
});

// ==========================================
// 6. CONNEXION DU BOT
// ==========================================
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('[Discord Login Error] Impossible de connecter le bot :', err.message);
    });
} else {
    console.warn('⚠️ Aucun DISCORD_TOKEN spécifié dans le fichier .env.');
}
