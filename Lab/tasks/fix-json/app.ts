import * as fs from 'fs';
import * as path from 'path';
import type { MegaJsonModel } from './mega-json-model';
import { OpenAiService } from '../../services/open-ai.service';
const axios = require('axios');

const filePath = path.join(__dirname, 'mega.json');
const aiService = new OpenAiService();
let megaJson: MegaJsonModel

(async () => {
    fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
        console.error('Error reading the file:', err);
        return;
    }

    try {
        megaJson = JSON.parse(data);

        for (let index = 0; index < megaJson['test-data'].length; index++) {
            const testData = megaJson['test-data'][index];
            const [num1, num2] = testData.question.split(' + ').map(Number);
            const sum = num1 + num2;
            if (sum !== testData.answer) {
            megaJson['test-data'][index].answer = sum;
            }

            if (typeof testData.test !== 'undefined' && testData.test !== null) {
            const response = await aiService.getAnswer(`Odpowiedz na pytanie użytkownika. 
                W odpowiedzi ogarnicz się tylko do niej. Nie dodawaj żadnych dodatkowych informacji po za samą czystą odpowiedzą.`, [testData.test.q]);
            megaJson['test-data'][index].test.a = response || '';
            }
        }

        megaJson.apikey = process.env.AIDEVS_KEY??'';

        const answer = {
            task: "JSON",
            answer: megaJson,
            apikey: process.env.AIDEVS_KEY
        }
        const answer_url = 'https://centrala.ag3nts.org/report';
        try {
            const response = await axios.post(answer_url, answer, {
            headers: {
                'Content-Type': 'application/json'
            }
            });

            console.log('Response from server:', response.data);
        } catch (postErr) {
            console.error('Error posting data:', postErr);
        }
    } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
    }
    });
})();