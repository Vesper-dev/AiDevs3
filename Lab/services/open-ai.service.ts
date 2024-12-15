import OpenAI from "openai";
import { Langfuse } from "langfuse"
import type { ChatCompletionMessageParam } from "openai/src/resources/index.js";
const fs = require('fs');

export class OpenAiService {
  private readonly _openAi: OpenAI;
  private readonly _langfuse: Langfuse;
  private readonly _taskName: string;

  constructor(taskName: string = '') {
    this._openAi = new OpenAI();
    this._langfuse = new Langfuse({
      secretKey: "sk-lf-4cf0deae-7785-4cde-9219-5b0c0cee7f1f",
      publicKey: "pk-lf-c18103a0-3b0d-4822-8ef4-88647a0e6d74",
      baseUrl: "https://cloud.langfuse.com"
    });
    this._taskName = taskName;
  }

  async getAnswer (systemPrompt: string, messages: string[], model: string = 'gpt-4o-mini'): Promise<string | null> {
    let messagesForChat : any[] = [];

    messagesForChat.push({role: "system", content: systemPrompt});

    for(let i = 0; i < messages.length; i++) {
      messagesForChat.push({role: "user", content: messages[i]});
    }

    if (this._taskName.length > 0) {
      const trace = this._langfuse.trace({name: this._taskName});
      const generation = trace.generation({model, input: messagesForChat});
      const chatCompletion = await this._openAi.chat.completions.create({
        messages: messagesForChat,
        model,
      });
      generation.end({output: chatCompletion});
      console.log('Generation:', generation);
      return chatCompletion.choices[0].message.content;
    } else {
      const chatCompletion = await this._openAi.chat.completions.create({
        messages: messagesForChat,
        model,
      });
      return chatCompletion.choices[0].message.content;
    }
  }

  async transcribeAudio(filePath: string): Promise<string | null> {
    const audioData = fs.createReadStream(filePath);
    
    const transcription = await this._openAi.audio.transcriptions.create({
      file: audioData,
      model: 'whisper-1',
    });

    return transcription.text;
  }

  async generateImage(prompt: string): Promise<string> {
    const response = await this._openAi.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    });

    return response.data[0].url??'';
  }

  async ocrTextFromFile(filePath: string): Promise<string | null> {
    const imageData = fs.readFileSync(filePath, { encoding: 'base64' });

    const response = await this._openAi.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            { type: "text", text: "You're OCR AI. Your job is to return text from the image that was being sent to you." },
          ],
        },
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
      ],
    });

    return response.choices[0].message.content;
  }

  async answerAboutPhoto(url: string, systemPrompt: string, msg: string): Promise<string | null> {
    const response = await this._openAi.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            { type: "text", text: systemPrompt },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url,
              },
            },
            {
              type: "text",
              text: msg
            }
          ],
        },
      ],
    });

    return response.choices[0].message.content;
  }

  async conversation (messages: ChatCompletionMessageParam[], model: string = 'gpt-4o-mini'): Promise<ChatCompletionMessageParam[] | null> {
    const chatCompletion = await this._openAi.chat.completions.create({
      messages,
      model,
    });
    messages.push(chatCompletion.choices[0].message);
    return messages;
  }
}