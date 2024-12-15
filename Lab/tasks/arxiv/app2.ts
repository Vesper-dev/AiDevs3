import axios from "axios";
import { OpenAiService } from "../../services/open-ai.service";
import { AiDevsService } from "../../services/ai-devs.service";

const fs = require('fs');
const path = require('path');



const report = fs.readFileSync(path.join(__dirname, 'report.txt'), 'utf8');
const systemPrompt: string = `Na podstawie informacji zawartych poniżej, odpowiedz na zadane przez użytkownika pytanie.
############
${report}
############`

const questionUtl = `https://centrala.ag3nts.org/data/${process.env.AIDEVS_KEY}/arxiv.txt`;

const response = await axios.get(questionUtl);

const questions = response.data.split('\n').reduce((map: { [key: string]: string }, line: string) => {
  const [id, question] = line.split('=');
  if (id && question) {
    map[id] = question;
  }
  return map;
}, {});

const openAI = new OpenAiService();
const answers: { [key: string]: string } = {};

for (const id in questions) {
  if (questions.hasOwnProperty(id)) {
    answers[id] = await openAI.getAnswer(systemPrompt, [questions[id]], 'gpt-4o') ?? '';
  }
}

const aiDevs = new AiDevsService();
await aiDevs.sendAnswer('arxiv', answers);