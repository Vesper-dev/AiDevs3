import OpenAI from "openai";
const fs = require('fs');

export class OpenAiService {
  private readonly _openAi: OpenAI;

  private _conversation: any[] = [];

  constructor() {
    this._openAi = new OpenAI();
  }

  async getAnswer (systemPrompt: string, messages: string[], model: string = 'gpt-4o'): Promise<string | null> {
    let messagesForChat : any[] = [];

    messagesForChat.push({role: "system", content: systemPrompt});

    for(let i = 0; i < messages.length; i++) {
      messagesForChat.push({role: "user", content: messages[i]});
    }

    const chatCompletion = await this._openAi.chat.completions.create({
        messages: messagesForChat,
        model,
    });
      
    return chatCompletion.choices[0].message.content;
  }

  async transcribeAudio(filePath: string): Promise<string | null> {
    const audioData = fs.createReadStream(filePath);
    
    const transcription = await this._openAi.audio.transcriptions.create({
      file: audioData,
      model: 'whisper-1',
    });

    return transcription.text;
  }
}