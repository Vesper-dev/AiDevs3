import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import { AiDevsService } from '../../services/ai-devs.service';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import OpenAI from 'openai';

const app = new FirecrawlApp({ apiKey: process.env.FIRE_CRAWL_API_KEY });

const neo4jUrl = 'bolt://192.168.1.22:7687';

const driver = neo4j.driver(neo4jUrl, neo4j.auth.basic('neo4j', 'neo4jneo4j'));
const session = driver.session();

interface Node {
    label?: string;
    markdown: string;
    links?: string[];
    metadata: Metadata;
}

interface Metadata {
    title?: string;
    description?: string;
    sourceURL?: string;
    url: string;
}

const createDatabase = async () => {
    const query = `
        CREATE CONSTRAINT IF NOT EXISTS FOR (s:Softo) REQUIRE s.sourceUrl IS UNIQUE
    `;

    try {
        await session.run(query);
        console.log('Database setup completed.');
    } catch (error) {
        throw new Error(`Failed to create database: ${error}`);
    }
};



const scrapeUrl = async (url: string): Promise<any> => {
    const response = await app.scrapeUrl(url, {
        formats: ['markdown', 'links'],
        onlyMainContent: false,
    })

    if (!response.success) {
        throw new Error(`Failed to crawl: ${response.error}`)
    }

    return response;
}

const extractSubpage = (url: string): string => {
    const urlObj = new URL(url);
    return urlObj.pathname === '/' ? urlObj.hostname.split('.')[1] : urlObj.pathname;
};

const updateGraph = async (child: Node, parent: Node) => {
    const query = `
        MERGE (c:Softo {sourceUrl: $childUrl})
        ON CREATE SET 
            c.markdown = $childMarkdown,
            c.description = $childDescription,
            c.title = $childTitle,
            c.url = $childUrl,
            c.label = $childLabel
        MERGE (p:Softo {sourceUrl: $parentUrl})
        ON CREATE SET 
            p.markdown = $parentMarkdown,
            p.description = $parentDescription,
            p.title = $parentTitle,
            p.url = $parentUrl,
            p.label = $parentLabel
        MERGE (c)-[:CHILD_OF]->(p)
    `;

    try {
        await session.run(query, {
            childUrl: child.metadata?.sourceURL,
            childMarkdown: child.markdown,
            childDescription: child.metadata?.description,
            childTitle: child.metadata?.title,
            childLabel: extractSubpage(child.metadata?.sourceURL ?? ''),
            parentUrl: parent.metadata?.sourceURL,
            parentMarkdown: parent.markdown,
            parentDescription: parent.metadata?.description,
            parentTitle: parent.metadata?.title,
            parentLabel: extractSubpage(parent.metadata?.sourceURL ?? ''),
        });
    } catch (error) {
        throw new Error(`Failed to update graph: ${error}`);
    }
};

const isChildConnected = async (parentUrl: string, childUrl: string): Promise<boolean> => {
    const query = `
        MATCH (p:Softo {sourceUrl: $parentUrl})-[:CHILD_OF]->(c:Softo {sourceUrl: $childUrl})
        RETURN p, c
    `;

    try {
        const result = await session.run(query, { parentUrl, childUrl });
        return result.records.length > 0;
    } catch (error) {
        throw new Error(`Failed to check connection: ${error}`);
    }
};

const nodeExists = async (url: string): Promise<boolean> => {
    const query = `
        MATCH (n:Softo {sourceUrl: $url})
        RETURN n
    `;

    try {
        const result = await session.run(query, { url });
        return result.records.length > 0;
    } catch (error) {
        throw new Error(`Failed to check if node exists: ${error}`);
    }
};

const getNode = async (url: string): Promise<Node | null> => {
    const query = `
        MATCH (n:Softo {sourceUrl: $url})
        RETURN n
    `;

    try {
        const result = await session.run(query, { url });
        if (result.records.length > 0) {
            const record = result.records[0];
            const node = record.get('n').properties;
            return {
                label: node.label,
                markdown: node.markdown,
                links: [], // Assuming links are not stored in the node
                metadata: {
                    title: node.title,
                    description: node.description,
                    sourceURL: node.sourceUrl,
                    url: node.url,
                },
            };
        } else {
            return null;
        }
    } catch (error) {
        throw new Error(`Failed to get node: ${error}`);
    }
};


const deleteGraph = async (): Promise<void> => {
    const query = `
        MATCH (n:Softo)
        DETACH DELETE n
    `;

    try {
        await session.run(query);
        console.log(`Softo graph deleted.`);
    } catch (error) {
        throw new Error(`Failed to delete Softo graph: ${error}`);
    }
};

await createDatabase();

const mainUrl = 'https://softo.ag3nts.org/';
const questionsUrl = `https://centrala.ag3nts.org/data/${process.env.AIDEVS_KEY}/softo.json`;

const result = await axios.get(questionsUrl);
const questions = result.data;

console.log(questions);

const mainPage: Node = await nodeExists(mainUrl) ? await getNode(mainUrl) : await scrapeUrl(mainUrl);

const answers: { [key: string]: string } = {};

const systemPrompt: string = `You are internet explorer. You need to answer the question user will ask you, using knowledge from the website.
The website is in markdown format. If you want to see what is inside url then return to user link to this page. It will return to you 
content of th page.

To know the answer you nedd to be able to find it inside page so you will be needed to choose which of the available subpages you need to visit.
Subpages will be visible as [Name of the subpage](/subpage) and if you need to visit Name of the subpage you return to user /subpage.
Somethimes you will be seen clue on what subpage you need to search for the answer. 

If you know the answer then return it.
Answer should be very as short as possible.

You can only return data as a json object with field answer and subpage. Life field answer empty if you don't know it yet.
Do not visit the same page twice.
Example answer:
{
    "answer": "This is the answer",
    "subpage": "/subpage"
}
#############KNOWLEDGE###############

`;

const openAi = new OpenAI();
let parentPage: Node = mainPage;

for (const key in questions) {
    parentPage = mainPage;
    if (questions.hasOwnProperty(key)) {
        const question = questions[key];
        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: `${systemPrompt}###${mainUrl}###\n${mainPage.markdown}` },
            {
                role: "user",
                content: [{
                    type: "text",
                    text: question,
                }]
            }
        ];
        let visitedPages = `- ${mainUrl}`;
        for (let j = 0; j < 10; j++) {
            try {
                const completion = await openAi.chat.completions.create({
                    model: "gpt-4o",
                    messages,
                    response_format: { type: "json_object" }
                });

                let responseStr = completion.choices[0].message.content as string;
                responseStr = responseStr.replace(/[\t\n\r]+/g, '');
                console.log(`Odpowiedź: ${responseStr}`);
                const response = JSON.parse(responseStr);

                if (response && typeof response.subpage === 'string' && typeof response.answer === 'string') {
                    if (response.answer !== '') {
                        answers[key] = response.answer;
                        break;
                    } else {
                        const subpageUrl = `${mainUrl}${response.subpage}`;
                        visitedPages += `\n- ${subpageUrl}`;
                        const subpage: Node = await nodeExists(subpageUrl) ? await getNode(subpageUrl) : await scrapeUrl(subpageUrl);
                        await updateGraph(subpage, parentPage);
                        parentPage = subpage;

                        messages.push({
                            role: "assistant", content: [
                                {
                                    type: "text",
                                    text: `###${subpageUrl}###\n${subpage.markdown}`
                                }
                            ]
                        });
                    }
                } else {
                    messages.push({
                        role: "user", content: [
                            {
                                type: "text",
                                text: `Wrong answer format.`
                            }
                        ]
                    });
                }
            } catch (error) {
                messages.push({
                    role: "user", content: [
                        {
                            type: "text",
                            text: `Error ${error}`
                        }
                    ]
                });
            }
        }
    }
}

console.log(answers);
const aiDevs = new AiDevsService();
await aiDevs.sendAnswer('softo', answers);

console.log('Answers sent to AiDevs');