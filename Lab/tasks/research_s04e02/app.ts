import * as path from 'path';
import * as fs from 'fs';
import { OpenAiService } from '../../services/open-ai.service';
import { AiDevsService } from '../../services/ai-devs.service';

const incorrectPath = path.join(__dirname, 'lab_data', 'verify.txt');

const readFile = (filePath: string): string[] => {
    return fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
};

const filterResults = async (toVerifyLines: string[]): Promise<string[]> => {
    let result: string[] = [];
    const aiService = new OpenAiService();

    for (const line of toVerifyLines) {
        const [id, content] = line.split('=');
        const answer = await aiService.getAnswer('Classify score', [content], 'ft:gpt-4o-mini-2024-07-18:personal:aidevs-04-02:AbtneT2O')??'0';
        const answerValue: number = Number(answer);
        if (answerValue === 1) {
            result.push(id);
        }
    }

    return result;
};

const answer = await filterResults(readFile(incorrectPath));
console.log(answer);
const aiDevs = new AiDevsService();
aiDevs.sendAnswer('research', answer);