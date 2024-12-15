import { OpenAiService } from "../../services/open-ai.service";
import type { ChatCompletionMessageParam } from "openai/src/resources/index.js";
import axios from 'axios';

const systemPrompt: string = `You're sql query generator. You're job is to prepare sql queries for the task that user will provide.
If it's not possible to answer with one query or youre lacking knowledge form the database, you have to prepere query that
will return data that you need. User will provide you with the data returned from the query. Use youre knowledge to serv the service.
You can provide one query at the time. 
- do not return any additional data other than query.
- do not return any additional formation of the query like eol or \', "\.
- use small letters for the query.
Knowledge:
Available tables: 
- users 
- datacenters
- connections
Additional commands:
- show tables - return list of tables
- show create table TABLE_NAME - show structure of the table`;

const maxRepeations = 10;
const task = 'Twoim zadaniem jest zwrócenie numerów ID czynnych datacenter, które zarządzane są przez menadżerów, którzy aktualnie przebywają na urlopie (są nieaktywni).'

const openAiService = new OpenAiService();
const messages: ChatCompletionMessageParam[] = [
    {role: "system", content: systemPrompt},
    {role: "user", content: task}
];

const databaseUrl = 'https://centrala.ag3nts.org/apidb';

let query = {
    task: "database",
    apikey: process.env.AIDEVS_KEY,
    query: ""
}

for (let i = 0; i < maxRepeations; i++) {
    await openAiService.conversation(messages, 'gpt-4o');
    const msg = (messages[messages.length - 1].content as any) as string;
    
    query.query = msg;

    try {
        const response = await axios.post(databaseUrl, query);
        console.log(msg);
        console.log(response.data);
        messages.push({ role: "user", content: JSON.stringify(response.data) });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response && error.response.status === 400) {
              console.error('BadRequest error:', error.response.data);
              messages.push({ role: "user", content: JSON.stringify(error.response.data) });
            } else {
              console.error('Axios error posting data:', error);
            }
          } else {
            console.error('Unexpected error posting data:', error);
          }
    }
}