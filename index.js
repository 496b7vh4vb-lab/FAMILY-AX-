require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

const twentyFourSeven = new Map();

client.once('ready', async () => {
  console.log(`Bot online sebagai ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Bot masuk ke voice channel kamu'),
    new SlashCommandBuilder()
      .setName('247')
      .setDescription('Bot stay 24 jam di voice channel ini'),
    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Bot keluar dari voice channel')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash commands berjaya di-register!');
  } catch (error) {
    console.error(error);
  }
});

function joinChannel(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      const savedChannelId = twentyFourSeven.get(channel.guild.id);
      if (savedChannelId) {
        const ch = channel.guild.channels.cache.get(savedChannelId);
        if (ch) {
          setTimeout(() => joinChannel(ch), 3000);
        }
      } else {
        connection.destroy();
      }
    }
  });

  return connection;
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild } = interaction;

  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Kamu harus masuk voice channel dulu!', ephemeral: true });
    }
    joinChannel(voiceChannel);
    await interaction.reply(`✅ Bot masuk ke **${voiceChannel.name}**`);
  }

  if (commandName === '247') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Kamu harus masuk voice channel dulu!', ephemeral: true });
    }
    twentyFourSeven.set(guild.id, voiceChannel.id);
    joinChannel(voiceChannel);
    await interaction.reply(`✅ Mode **24/7** aktif di **${voiceChannel.name}**`);
  }

  if (commandName === 'leave') {
    const connection = getVoiceConnection(guild.id);
    if (connection) {
      connection.destroy();
      twentyFourSeven.delete(guild.id);
      await interaction.reply('👋 Bot keluar dari voice channel.');
    } else {
      await interaction.reply('❌ Bot sedang tidak di voice channel manapun.');
    }
  }
});

client.on('ready', () => {
  setTimeout(() => {
    twentyFourSeven.forEach((channelId, guildId) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) joinChannel(channel);
      }
    });
  }, 3000);
});

client.login(process.env.TOKEN);
