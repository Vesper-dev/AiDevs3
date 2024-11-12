import axios from "axios";

export class AiDevsService {

  public async sendAnswer(taskName: string, answerValue: string): Promise<string> {
    const answer = {
      task: taskName,
      answer: answerValue,
      apikey: process.env.AIDEVS_KEY
    }

    const answer_url = 'https://centrala.ag3nts.org/report';
    try {
      const response = await axios.post(answer_url, answer, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response from server:', response.data);

      return response.data;
    } catch (postErr) {
      console.error('Error posting data:', postErr);
    }

    return 'ERROR';
  }

  public async getAnswerFromLocalAI(system: string, prompt: string, model: string = 'llama3.2'): Promise<string> {
    const body = { model, prompt, stream: false, system};
    const url = 'http://127.0.0.1:11434/api/generate';

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response from local AI:', response.data.response);

      return response.data.response;
    } catch (postErr) {
      console.error('Error posting data to local AI:', postErr);
    }

    return 'ERROR';
  }
}