import * as fs from 'fs';
import * as path from 'path';
import { OpenAiService } from '../../services/open-ai.service';
import { AiDevsService } from '../../services/ai-devs.service';

const directoryPath = `C:\\Users\\bartek\\Desktop\\AI_Devs_3\\AiDevs3\\Lab\\tasks\\kategorie\\unpacked`;
const aiService = new OpenAiService();
let people: string[] = [];
let hardware: string[] = [];

fs.readdir(directoryPath, async (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    } 

    (async () => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join(directoryPath, file);

            const fileExtension = path.extname(file).toLowerCase();
            console.log(file);
            switch (fileExtension) {
                case '.txt':
                    // Handle text file
                    const txtFileContent = fs.readFileSync(filePath, 'utf-8');
                    await categorizeContent(txtFileContent, file);
                    break;
                case '.mp3':
                    const mp3FileContent = await aiService.transcribeAudio(filePath)??'';
                    await categorizeContent(mp3FileContent, file);
                    break;
                case '.png':
                    const pngFileContent = await aiService.ocrTextFromFile(filePath)??'';
                    await categorizeContent(pngFileContent, file);
                    break;
                default:
                    console.log(`Unsupported file type: ${fileExtension}`);
            }
        }

        const aiDevsService = new AiDevsService();
        //await aiDevsService.sendCustomAnswer('kategorie', { people, hardware });
        await aiDevsService.sendAnswer('kategorie', { people, hardware });
    })();
});

async function categorizeContent(content: string, fileName: string) {
    const systemPrompt = `Na podstawie dostarczonych infromacji zdecyduj, czy informacja w nich zawarta jest o ludziach, maszynach czy czymś innym.  Klasyfikuj tylko te informacje, które mówią o schwytanych ludziach lub o śladach ich obecności oraz o naprawionych usterkach hadwerowych. Pomijaj te związane z softwerem.  Odpowiedź ogranicz do jednego słowa: "people", "hardware" lub "none".`;

    const response = await aiService.getAnswer(systemPrompt, [content], 'gpt-4o')??'';
    const category = response.toLowerCase();

    if (category === 'people') {
        people.push(fileName);
    } else if (category === 'hardware') {
        hardware.push(fileName);
    } else {
        console.log('Content does not match any category');
    }
}