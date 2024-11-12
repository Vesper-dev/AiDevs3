import * as fs from 'fs';
import * as path from 'path';
import { OpenAiService } from '../../services/open-ai.service';
import { AiDevsService } from '../../services/ai-devs.service';

const directoryPath = `C:\\Users\\bartek\\Desktop\\AI_Devs_3\\Lab\\tasks\\interrogation\\interrogations`;
const aiService = new OpenAiService();
let interrogations: string = 'Przesłuchania';

fs.readdir(directoryPath, async (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    } 
    (async () => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join(directoryPath, file);
            interrogations += `${file}\n`;
            const transcription = await aiService.transcribeAudio(filePath);
            interrogations += `${transcription}\n`;
            interrogations += `##########\n`;
        }
        //console.log(interrogations);

        const answer = await aiService.getAnswer(`Na podstawie dostarczonych przesłuchań, 
            odpowiedz na pytanie na jakiej ulicy znajduje się uczelnia, na której wykłada Andrzej Maj. W treści załącz samą 
            nazwę ulicy. Uwaga, przesłuchnia mogą być sprzeczne. Musisz wydedukować odpowiedź. 
            Jeżeli odgadniesz uczelnie, to użyj swojej własnej wiedzy żeby podać odpowiedź na jakiej ulicy uczelnia się znajduje.\n${interrogations}`, ['Odpowiedz na pytanie'])??'';
        
        const answerService = new AiDevsService();
        
        answerService.sendAnswer('mp3', answer);
        
        console.log(interrogations);
    })();
});