import axios from 'axios';
import fs from 'fs';
import { OpenAiService } from '../../services/open-ai.service';
import { AiDevsService } from '../../services/ai-devs.service';

const url = 'https://centrala.ag3nts.org/data/1331d14c-2db6-4895-ad7c-fa1e68437741/cenzura.txt';

const fetchFileContent = async (url: string): Promise<string> => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching the file:', error);
        throw error;
    }
};

let forCensoring: string = '';

fetchFileContent(url).then(async content => {
    forCensoring = content;
    console.log('File content fetched successfully');

    console.log(forCensoring);
    /*const aiService = new OpenAiService();
    const censoredFile: string = await aiService.getAnswer(`Youre only job is to censore personal information. User will send to you
        data with personal information like name surname or age or different. You have to replace personal information with word CENZURA.
        You can not chage the structure of texxt that user sended to you. You can not sent to user other info than censored text.`, [forCensoring])??'';*/
    const aiService = new AiDevsService();
    const censoredFile: string = await aiService.getAnswerFromLocalAI(`Youre only job is to censore personal information in polish. User will send to you
        data with personal information like name, surname, age or location. 
        - You have to replace personal information with word CENZURA.
        - You can not chage the structure of text that user sended to you. 
        - You can not sent to user other info than censored text.
        - You can not change form of the word CENZURA
        - Location with it number change to one word CENZURA
        
        Example: Bartosz Paprocki zamieszkały w Ząbkowicach Śląskich ul. Dworcowa 7. Lat 36.
        Result: CENZURA CENZURA zamieszkały w CENZURA ul. CENZURA. Lat CENZURA.
        
        Example: Osoba podejrzana to Robert Średniak. Adres: Bydgoszcz, ul. Średnia 3. Wiek: 32 lat.
        Result: Osoba podejrzana to CENZURA. Adres: CENZURA, ul. CENZURA. Wiek: CENZURA lat.

        Example: Adres: Bydgoszcz, ul. Średnia 2.
        Result: Adres: CENZURA, ul. CENZURA.
        `, forCensoring);
    
    console.log(censoredFile);

        const answer = {
            task: "CENZURA",
            answer: censoredFile,
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
        } catch (postErr) {
            console.error('Error posting data:', postErr);
        }

}).catch(error => {
    console.error('Failed to fetch file content:', error);
});

