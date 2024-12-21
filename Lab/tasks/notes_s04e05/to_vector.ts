import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions.js';

const pagesPath = `${__dirname}\\resources\\pages\\`;

const systemPrompt: string = `Jesteś policyjnym śledczym.
muszisz opisać co znajduje się na dostarczonym przez użytkownika zdjęciu. Jeżeli użytkownik przesyła tekst to
zwróć tylko i wyłącznie treść tekstu bez swoich własnych wtrąceń. Jeżeli jakieś słowo jest ale jesteś w stanie je wydedukować to 
zrób to. Jeżeli nie jesteś pewny to w miejsce brakujących liter, wstaw trzykropek. Jeżeli na zdjęciu znajduje się obrazek, to go opisz wraz
z informacją gdzie się znajduje, np. Obrazek, prawy górny róg: opis obrazka. Na koniec dodaj jeszcze swoje własne wnioski. To znaczy co wynika z tego
co znajduje się w danej notatce. Wszystko co jest w notatce jest ważne. Wszystko co jest w notatce ma znaczenie. Wnioski oddziel słowem Wnioski`;

const collectionName = 'Rafal_notes';

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

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

async function processImage(filePath: string, pageNumber: number) {

    const openAi = new OpenAI();

    const imageData = fs.readFileSync(filePath, { encoding: 'base64' });

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
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
        messages
    });

    const description = completion.choices[0].message.content as string;

    const pageData = {
        id: uuidv4(),
        pageNumber: `Page ${pageNumber}`,
        description: description.trim(),
    };

    // Ensure the collection exists
    const collections = await qdrantClient.getCollections();
    if (!collections.collections.some((col) => col.name === collectionName)) {
        await qdrantClient.createCollection(collectionName, {
            vectors: {
                size: 1024,
                distance: 'Cosine'
            }
        });
    }

    description.trim();
    await qdrantClient.upsert(collectionName, {
        wait: true,
        points: [
            {
                id: pageData.id,
                vector: await createJinaEmbedding(description.trim()),
                payload: pageData,
            },
        ],
    });
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
});