import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AiDevsService } from '../../services/ai-devs.service';

const mainFolder = `${path.resolve(__dirname)}\\catalog`;

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

async function readDirectory() {
    try {
        const files = await fs.promises.readdir(mainFolder);
        const result = [];

        for (const file of files) {
            const filePath = path.join(mainFolder, file);
            const stat = await fs.promises.stat(filePath);

            if (stat.isFile()) {
                const data = await fs.promises.readFile(filePath, 'utf-8');
                result.push({ name: file, data });
                //console.log('File:', filePath);
            } else if (stat.isDirectory()) {
                console.log('Directory:', filePath);
            }
        }

        return result;
    } catch (err) {
        console.error('Error reading the directory.', err);
        process.exit(1);
    }
}

async function performSearch(collectionName: string, query: string, filter: Record<string, any> = {}, limit: number = 5) {
    const queryEmbedding = await createJinaEmbedding(query);
    return qdrantClient.search(collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      filter
    });
  }

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

const weapons_tests_arch = await readDirectory();

const COLLECTION_NAME = "weapons_tests_arch";

const collections = await qdrantClient.getCollections();

if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
    await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: 1024, distance: "Cosine" }
    });

    const pointsToUpsert = await Promise.all(weapons_tests_arch.map(async point => {
        const embedding = await createJinaEmbedding(point.data);
  
        return {
            id: uuidv4(),
            vector: embedding,
            payload: {
            text: point.data,
            name: point.name
            }
        };
    }));

    await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: pointsToUpsert
    });
}
const query: string = 'W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?';
const result = await performSearch(COLLECTION_NAME, query);

if (result[0].payload) {
    const resultTitle = (result[0].payload.name) as string;
    const date = resultTitle.replace(/_/g, '-').replace('.txt', '');
    console.log(`Date: ${date}`);

    const aiDevs = new AiDevsService();
    aiDevs.sendAnswer('wektory', date);
}