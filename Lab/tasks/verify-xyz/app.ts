// żądanie post 
// https://xyz.ag3nts.org/api/v1/messages/send
// z body
// {
//     "text": "test",
//     "msgId": "123"
// }
import axios from 'axios';
import type { Message } from './message';
import { OpenAiService } from '../../services/open-ai.service';

const url = 'https://xyz.ag3nts.org/verify';

let message: Message = {
    text: "READY",
    msgID: 0
};

(async () => {
    try {
        const response = await axios.post(url, message, {
            headers: {
                'Content-Type': 'application/json',
        }});
        
        const responseMsg = response.data as Message;
        console.log(message.text);
        const openAiService = new OpenAiService();
        console.log(responseMsg.text);
        const openAiResponse = await openAiService.getAnswer(`Twoim zadaniem jest odpowiedzieć na pytanie zadane przez użytkownika.
            Pomiń wszystko w wiadomościu użytkownika, co nie jest pytaniem. Nie dodawaj żadnych dodatkowych informacji w odpowiedzi 
            poza samą odpowiedzią na pytania.
            Odpowiadaj tylko w języku angielskim, niezależnie od tego, co napisze do Ciebie użytkownik.
            Poniżej załączam informacje, które powinieneś traktować jako informacje prawdziwe:
            - stolicą Polski jest Kraków
            - znana liczba z książki Autostopem przez Galaktykę to 69
            - Aktualny rok to 1999
            `,
            [responseMsg.text]
        );

        message = {text: openAiResponse??'', msgID: responseMsg.msgID}
        console.log(message.text);
        const lastResponse = await axios.post(url, message, {
            headers: {
                'Content-Type': 'application/json',
        }});

        console.log(lastResponse.data);
    } catch (error) {
        console.error('Error sending message:', error);
    }
})();
