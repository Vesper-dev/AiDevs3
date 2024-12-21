import axios from "axios";
import { AiDevsService } from "../../services/ai-devs.service"
import { QdrantClient } from '@qdrant/js-client-rest';
import type { ChatCompletionMessageParam } from "openai/src/resources/chat/completions.js";
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

async function createJinaEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v3',
          task: 'text-matching',
          dimensions: 1024,
          late_chunking: false,
          embedding_type: 'float',
          input: [text]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error("Error creating Jina embedding:", error);
      throw error;
    }
  }

async function performSearch(query: string, filter: Record<string, any> = {}, limit: number = 19) {
    const queryEmbedding = await createJinaEmbedding(query);
    return qdrantClient.search(collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      filter
    });
  }

async function answerQuestion(question: string, knowledge: string): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: `${systemPrompt} ${knowledge}` },
        {
            role: "user",
            content: [
              {
                type: "text",
                text: question,
              }
            ],
          },
    ];

    const openAi = new OpenAI();
    const completion = await openAi.chat.completions.create({
        model: "gpt-4o",
        messages
    });

    return completion.choices[0].message.content as string;
}

const aiDevs = new AiDevsService();
const collectionName = 'Rafal_notes';
const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
const systemPrompt: string = `Jesteś detektywem. Odpowiedż na pytanie, korzystając z dodanej poniżej wiedzy. Część informacji możesz wydedukować.
Odpowiedzi muszą być zwięzłe i logiczne. Nie dostarczaj powodu dla któego wybrałeś daną odpowiedź. Odpowiedź nie musi być jednoznaczna.
Odpowiedzią może być też twoje przypuszczenie. W razie co użytkownik da Ci znać czy odpowiedź jest poprawna i wtedy sprubujesz jeszcze raz.
Jeżeli dostaniesz informacje że odpowiedź jest niepoprawna, spróbuj jeszcze raz ale nie dawaj tej samej odpowiedzi. Na podstawie tego że jakaś jest błędna postaraj się wywnioskować nową odpowiedź.
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

const openAi = new OpenAI();

for (let i = 1; i <= 19; i++) {
    const questions = questionsResponse.data;
    const answers: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(questions)) {
        console.log(`${key} : ${value}`);

        messages.push({
            role: "user",
            content: [
              {
                type: "text",
                text: value as string,
              }
            ],
          });
          const completion = await openAi.chat.completions.create({
            model: "gpt-4o",
            messages
        });
        

        const answer = completion.choices[0].message.content as string;
        answers[key] = answer;
        console.log(`Answer: ${answer}`);
    }

    const aidevsAnswer = await aiDevs.sendAnswer('notes', answers);
    const message = aidevsAnswer.message;


    messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: message,
          }
        ],
      });
}