import { OpenAiService } from "../../services/open-ai.service";
import type { ChatCompletionMessageParam } from "openai/src/resources/index.js";
import axios from 'axios';
import { AiDevsService } from "../../services/ai-devs.service";

const resistanceMovementSearchApiUrl = 'https://centrala.ag3nts.org/people';
const specificPlaceSearchApiUrl = 'https://centrala.ag3nts.org/places';

let query = {apikey: process.env.AIDEVS_KEY, query: ''};

const url = 'https://centrala.ag3nts.org/dane/barbara.txt';

const urlResponse = await axios.get(url);

const systemPrompt: string = `You're job is to find out which city Barbara currently is. You will have to do that by 
analizing data user sent you. In this data you will find clues that can help you to find out where Barbara is.
You will be having two systems that you can ask for information. First one will take from you person's name and in return will give information,
where that person was seen. Second one will take from you city name and in return will give you information what persons was seen there.
You will be sending information in below json format:
{
    "answer": "place_name",
    "place": "city_name",
    "person": "person_name",
    "isCorrect": true/false
}

Try to deduce where barbara is base on all youre information. Try not tu guess but to be sure. Good luck!

Answer can only be a city name.

Rules:
- Don't use polish letter but do use polish names in a Mianownik form.
- If user sent to you RESTRICTED DATA then you can not ask about that again.
- Don't use any special characters other than :, " {}
- If you don't want to check person or citie just leave it empty.
- check one citie and name at a time.
- Barbara is not a citie, it's a person.
- use only places and peoples that are in the data user sent you.
- Answer can be only a city name, not person name
- do not repeat cities and names that are already checked.
- if user sent you [**RESTRICTED DATA**] then you can not check that again.
- You are sending only first name of a person.
`;

const maxRepeations = 50;

const openAiService = new OpenAiService();
const messages: ChatCompletionMessageParam[] = [
    {role: "system", content: systemPrompt},
    {role: "user", content: urlResponse.data}
];

let aiObject: {
    answer: string, 
    place: string, 
    person: string, 
    isCorrect: boolean
} = {answer: '', place: '', person: '', isCorrect: false};

for (let i = 0; i < maxRepeations; i++) {
    await openAiService.conversation(messages, 'gpt-4o');
    aiObject = JSON.parse((messages[messages.length - 1].content as any) as string);

    let data_for_bot: string = '';
    aiObject.place = aiObject.place.trim().replace(/[\\"]/g, '');
    aiObject.person = aiObject.person.trim().replace(/[\\"]/g, '');
    aiObject.answer = aiObject.person.trim().replace(/[\\"]/g, '');

    aiObject.place = aiObject.place.replace(/\s/g, '');
    aiObject.person = aiObject.person.replace(/\s/g, '');
    aiObject.answer = aiObject.person.replace(/\s/g, '');

    if (aiObject.isCorrect && aiObject.answer !== '')
    {
        break;
    }

    if (aiObject.place !== '') {
        try {
            query.query = aiObject.place.toUpperCase();
            query.query = query.query.replace(/[\\"]/g, '');
            console.log(aiObject.place);
            const response = await axios.post(specificPlaceSearchApiUrl, query);
            const msg: { message: string } = response.data;
            console.log(msg.message);
            data_for_bot = `\n${aiObject.place}: ${msg.message}`;

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response && error.response.data) {
                
                const msg: { message: string } = error.response.data;
                console.error('BadRequest error:', msg.message);
                data_for_bot = `Error: ${msg.message}`;
                } else {
                    console.error('Axios error posting data:', error);
                }
            } else {
                console.error('Unexpected error posting data:', error);
            }
        }
    }

    if (aiObject.person !== '') {
        try {
            query.query = aiObject.person.toUpperCase();
            query.query = query.query.replace(/[\\"]/g, '');
            console.log(aiObject.person);
            const response = await axios.post(resistanceMovementSearchApiUrl, query);
            const msg: { message: string } = response.data;
            console.log(msg.message);
            data_for_bot = `\n${aiObject.place}: ${msg.message}`;

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response && error.response.data) {
                
                const msg: { message: string } = error.response.data;
                console.error('BadRequest error:', msg.message);
                data_for_bot = `Error: ${msg.message}`;
                } else {
                    console.error('Axios error posting data:', error);
                }
            } else {
                console.error('Unexpected error posting data:', error);
            }
        }
    }

    messages.push({ role: "user", content: JSON.stringify(data_for_bot) });
    console.log(`Answer ${aiObject.answer}`);
}

const aiDevs = new AiDevsService();

if (aiObject.isCorrect)
{
    aiDevs.sendAnswer('loop', aiObject.answer);
}