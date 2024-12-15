import * as fs from 'fs';
import * as path from 'path';
import { OpenAiService } from '../../services/open-ai.service';
import { AiDevsService } from '../../services/ai-devs.service';

const openAi = new OpenAiService();
const answers: { [key: string]: string } = {};

const factsPath = 'C:\\Users\\bartek\\Desktop\\AI_Devs_3\\AiDevs3\\Lab\\tasks\\dokumenty\\facts';
const reportsPath = 'C:\\Users\\bartek\\Desktop\\AI_Devs_3\\AiDevs3\\Lab\\tasks\\dokumenty\\files';
let knowledge: string = '';
let reports: string = '';

await new Promise<void>((resolve, reject) => {
    fs.readdir(factsPath, async (err, files) => {
        if (err) {
            console.error('Unable to scan directory:', err);
            reject(err);
            return;
        }

        for (const file of files) {
            const filePath = path.join(factsPath, file);
            const data = await fs.promises.readFile(filePath, 'utf8');
            knowledge += data + '\n';
        }

        resolve();
    });
});

const systemPrompt = `Wygeneruj słowa kluczowe po przecinku dla treści przekazanej przez użytkownika. 
Słowa kluczowe muszą być w formie mianowników. Poniżej znajduje się dodatkowa wiedza. Jeżeli łączy się 
ona z dostarczoną treścią, to uwzględnij tą wiedzę generująć słowa kluczowe. Słowa kluczowe 
nie muszą występować w dostarczonym tekście. Wzbogać słowa kluczowe o dodatkowe informacje zgromadzone w faktach.
Dodatkowa wiedza powinna również posłużyć do wnioskowania. Jeżeli możesz się czegoś domyślić, to dodaj to do słów kluczowych. 
Jeżeli wiesz o kim mowa w tekśćie to dopisz to do słów kluczowych. Jeżeli posiadasz dodatkowe fakty na temat osoby, lub rzecz takie jak zawód,
godzina, umiejętności miejsce akcji, to dodaj to do słów kluczowych. Dodawaj również informajce dostarczone w nazwie pliku.
Słowa kluczowe posłużą do indeksowania treści raportów.
#####Wiedza######
${knowledge}`;

fs.readdir(reportsPath, async (err, files) => {
    if (err) {
        console.error('Unable to scan directory:', err);
        return;
    }

    for (const file of files) {
        const filePath = path.join(reportsPath, file);
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            const keyPhrases = await openAi.getAnswer(systemPrompt, [`Nazwa: ${file}\n Treść: ${data}`], 'gpt-4o') ?? '';
            console.log(`File: ${file} - ${keyPhrases}`);
            answers[file] = keyPhrases;
        } catch (err) {
            console.error('Unable to read file:', err);
        }
    }

    const aiDevs = new AiDevsService();
    aiDevs.sendAnswer('dokumenty', answers);
});
