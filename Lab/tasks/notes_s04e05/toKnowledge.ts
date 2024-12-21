import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions.js';

const pagesPath = `${__dirname}\\resources\\pages\\`;

const systemPrompt: string = `Jesteś policyjnym śledczym. Będziesz analizował kolejne strony z notatnika. Musisz słowo w słowo odwzorować, co 
znajduje się w notatce. Jeżeli jest tam zdjęcie to je też opisz w miarę możliwości dokładnie. Opis tego co jest w notatce umieść w polu description.
W dalszej części opisz co wynika z informacji przez Ciebie zgromadzonych w postaci krutkich zdań np.
- "Ola mieszka w Opolu"
- Przemek ma 16 lat
itp.
Te informacje umieść w polu conclusions. Jeżeli jesteś w stanie rozbudować poprzedniozdobyte informacje o nowe, zrób to dopisując rozbudowane wnioski o nowe konkluzje.
Wszystkie odpowiedzi wykonaj w języku polskim.
Odpowiedz zwracając obiekt json`;

let knowledge = '';

async function processImage(filePath: string, pageNumber: number) {

    const openAi = new OpenAI();

    const imageData = fs.readFileSync(filePath, { encoding: 'base64' });

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: `${systemPrompt}\n${knowledge}` },
        {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  "url": `data:image/jpeg;base64,${imageData}`,
                },
              }
            ],
          },
    ];

    const completion = await openAi.chat.completions.create({
        model: "gpt-4o",
        messages,
        response_format: { type: "json_object" }
    });

    const response = JSON.parse(completion.choices[0].message.content as string);

    knowledge = `${knowledge}\nStrona ${pageNumber}:\n${response.description}\nWnioski:\n${response.conclusions}`;
}

fs.readdir(pagesPath, async (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    let pageNumber = 1;
    for (const file of files) {
        if (path.extname(file).toLowerCase() === '.jpg') {
            await processImage(path.join(pagesPath, file), pageNumber);
            pageNumber++;
        }
    }

    fs.writeFile(`${__dirname}\\conclusions.txt`, knowledge, (err) => {
        if (err) {
            console.error('Error writing conclusions to file:', err);
        } else {
            console.log('Conclusions saved to conclusions.txt');
        }
    });
});