import axios from "axios";
import { AiDevsService } from "../../services/ai-devs.service"
import type { ChatCompletionMessageParam } from "openai/src/resources/chat/completions.js";
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

const aiDevs = new AiDevsService();
const systemPrompt: string = `Jesteś detektywem. Musisz znaleźć odpowiedź na zadane przez użytkownika pytanie. Odpowiedź ma być maksymalnie zwięzła i precyzyjna.

W pierwszej fazie dodawaj kolejne pola conclusion_01 (02, 03 itd. tak dużo jak potrzebujesz). Są to twoje wnioski i dedukcje, które przeprowadzisz i wypiszez na podstawie dotychczas błędnych odpowiedzi oraz posiadanych informacji. Nie ograniczaj się do jednego wniosku.
Postaraj się dokładnie zbadać sprawę. 

To bardzo ważne aby dodać pola conclusions, ponieważ na podstawie nich będziesz mógł wywnioskować poprawną odpowiedź.

w drugiej fazie dodasz do pola answer odpowiedź, która wedługi Ciebie jest najbliższa prawdzie. Musisz podać odpowiedź bez względu czy jesteś do niej przekonany. Wybierz tą odpowiedź, któa nie została uznana za błędną
oraz tą którą uznasz najbliżej prawdy.

Odpowiedź musi zawierać samą informację, bez zbędnych wtrąceń.
Odpowiedź w tej lub innej formie na pewno znajduje się w dostarczonych notatkach. Jeżeli nie masz pojęcia to coś strzel co zgadza się z danymi.

Na podstawie odpowiedzi, dostaniesz inforamcje która odpowiedź była niepoprawna. Nie powtarzaj jej. Spróbuj wywnioskować nową odpowiedź na podstawie tego co wiesz.
Użyj wskazówek dostarczonych przez użytkownika. Jeżeli odpowiedź nie została oznaczona jako niepoprawna to nie dodawaj pól conclusions tylko przepisz tą samą odpowiedź

Całość zwróć w obiekcie json.
Przykład formatu odpowiedzi:
{
    "wrongAnswer_01": "Ola mieszka w Warszawie",
    "conclusion_01": "Jeżeli Ola mieszka w Warszawie to nie może mieć 16 lat",
    "conclusion_02": "Ola ma 17 lat",
    "answer": "Ola mieszka w Opolu"
}
### WIEDZA ###\n
\n
`;
const questionsResponse = await axios.get(`https://centrala.ag3nts.org/data/${process.env.AIDEVS_KEY}/notes.json`);

if (!questionsResponse.data) {
    throw new Error('Failed to fetch questions');
}

const knowledgeFilePath = path.join(__dirname, 'conclusions.txt');
const knowledge = fs.readFileSync(knowledgeFilePath, 'utf-8');
const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: `${systemPrompt} ${knowledge}` },
];
const answers: { [key: string]: string } = {};
const openAi = new OpenAI();

for (let i = 1; i <= 19; i++) {
    const questions = questionsResponse.data;

    for (const [key, value] of Object.entries(questions)) {

        if (answers[key] && (answers[key] as string) !== "") {
            continue;
        }

        console.log(`${key} : ${value}`);

        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: `${key}: ${value}`,
                }
            ],
        });
        const completion = await openAi.chat.completions.create({
            model: "gpt-4o",
            messages,
            response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content as string);
        const answer = response.answer;

        answers[key] = answer;
        console.log(`Deduction: ${completion.choices[0].message.content as string}`);
        console.log(`Answer: ${answer}`);
    }

    const aidevsAnswer = await aiDevs.sendAnswer('notes', answers);

    if (aidevsAnswer.code && aidevsAnswer.code === 200) {
        break;
    }


    const message = `Niepoprawna odpowiedź: ${aidevsAnswer.debug}\nPodpowiedź: ${aidevsAnswer.hint}`;


    messages.push({
        role: "user",
        content: [
            {
                type: "text",
                text: message,
            }
        ],
    });

    const completion2 = await openAi.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system", content: `Based on user message return number of the question and only that without changing it's formating.
                Do not add any additional information other than number of the message
                For example:
                User: Answer for question 02 is incorrect
                Assistant: 02`
            },
            {
                role: "user", content: aidevsAnswer.message
            }
        ]
    });

    const newKey = completion2.choices[0].message.content as string;
    if (answers.hasOwnProperty(newKey)) {
        answers[newKey] = "";
    }
}