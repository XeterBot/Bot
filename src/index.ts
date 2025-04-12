import 'dotenv/config';
import { Client, Intents, MessageAttachment } from 'discord.js';
import { v4 as uuid } from 'uuid';
import tmp from 'tmp';
import Axios from 'axios';
import fs from 'fs';
import logger from './logger';
import obfuscate from './obfuscate';

const token = process.env.DISCORD_TOKEN;
const MAX_SIZE = 4000000;

logger.log('Bot is starting ...');

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
    ],
    partials: ['CHANNEL'],
});

client.login(token);

client.once('ready', () => {
    logger.log(`Logged in as ${(client.user?.tag || 'Unknown')}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const fileUrl = message.attachments.first()?.url;

    if (!fileUrl) return;

    let preset: string | null = null;

    if (content.includes('!weak')) preset = 'Weak';
    else if (content.includes('!medium')) preset = 'Medium';
    else if (content.includes('!strong')) preset = 'Strong';

    if (!preset) return;

    try {
        const response = await Axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream',
        });

        if (response.headers['content-length'] && Number.parseInt(response.headers['content-length'], 10) > MAX_SIZE) {
            await message.reply('File quá lớn! Vui lòng sử dụng file nhỏ hơn 4MB.');
            return;
        }

        const tmpFile = tmp.fileSync({ postfix: '.lua' });
        const writeStream = fs.createWriteStream(tmpFile.name);
        response.data.pipe(writeStream);

        await new Promise<void>((resolve, reject) => {
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });

        let outFile;
        try {
            outFile = await obfuscate(tmpFile.name, preset);
        } catch (e) {
            await message.reply(`Mã hoá thất bại:\n${e}`);
            tmpFile.removeCallback();
            return;
        }

		const randomName = `${uuid()}.lua`;
		const attachment = new MessageAttachment(outFile.name, randomName);
        await message.reply({ files: [attachment] });

        outFile.removeCallback();
        tmpFile.removeCallback();
    } catch (error) {
        await message.reply('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    }
});
