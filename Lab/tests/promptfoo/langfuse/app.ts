import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';
import { LangfuseService } from "../../../services/langfuse.service";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";


const openAi = new OpenAI();
const langfuse = new LangfuseService();

let messagesForChat : any[] = [];
const model = 'gpt-4o';

messagesForChat.push({role: "system", content: "Answer the question."});
messagesForChat.push({role: "user", content: "What is the highest mountain in the world?"});

const id = uuidv4();
const name = "test";
const sessionId = uuidv4();

const trace = langfuse.createTrace({ 
    id: uuidv4(), 
    name: "Chat", 
    sessionId: sessionId 
  });

const mainSpan = langfuse.createSpan(trace, "Main Completion", messagesForChat);
const chatCompletion = await openAi.chat.completions.create({
    messages: messagesForChat,
    model,
});

const mainMessage = chatCompletion.choices[0].message;
const generatedMessages: ChatCompletionMessageParam[] = [mainMessage];

langfuse.finalizeSpan(mainSpan, "Main Completion", messagesForChat, chatCompletion);
await langfuse.finalizeTrace(trace, messagesForChat, generatedMessages );
console.log(chatCompletion.choices[0].message.content);