import axios from 'axios';
import { JSDOM } from 'jsdom';
import { OpenAiService } from '../../services/open-ai.service';
const fs = require('fs');
const path = require('path');

const url = 'https://centrala.ag3nts.org/dane/';
const articleUrl = `${url}arxiv-draft.html`;

async function downloadMP3(url: string, outputPath: string) {
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
    });

    if (response.status !== 200) {
        throw new Error(`Nie udało się pobrać ${url}: ${response.statusText}`);
    }

    const writer = fs.createWriteStream(outputPath);

    return new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function fetchData() {
    try {
        const response = await axios.get(articleUrl);
        const dom = new JSDOM(response.data);
        const bodyContent = dom.window.document.body;
        const images = bodyContent.querySelectorAll('img');

        const openAi = new OpenAiService();

        for (const img of images) {
            const src = `${url}${img.src}`;
            const systemPrompt = 'Opisz co znajduje się na fotografii zaczynając od słów: Dołączony jest obraz, na którym znajduje się... . Nie dołączaj do odpowiedzi niczego poza opisem zdjęcia.';
            const imageDescription = await openAi.answerAboutPhoto(src, systemPrompt, '') ?? '';
            img.replaceWith(imageDescription);
            img.replaceWith(src);
        }

        const audios = bodyContent.querySelectorAll('audio');

        for (const audio of audios) {
            audio.remove();
        }

        const links = bodyContent.querySelectorAll('a');

        for (const link of links) {

            if (link) {
                const href = `${url}${link.href}`;
                const audioDir = path.join(__dirname);
                const audioFilePath = path.join(audioDir, path.basename(href));
                await downloadMP3(href, audioFilePath);
                const transcription = await openAi.transcribeAudio(audioFilePath) ?? '';
                link.replaceWith(`Zawartość pliku audio: ${transcription}`);
            }
        }

        fs.writeFileSync('report.txt', bodyContent.innerHTML);
    } catch (error) {
        console.error('Error fetching the URL:', error);
    }
}

fetchData();
