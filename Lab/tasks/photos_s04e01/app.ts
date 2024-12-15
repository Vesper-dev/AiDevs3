import OpenAI from "openai";
import { AiDevsService } from "../../services/ai-devs.service";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";

interface Image {
    url: string;
    name: string;
}

interface ImagesResponse {
    images: Image[];
}

interface Operation {
    operation: number;
    answer: string;
}

async function getImages(msg: string): Promise<ImagesResponse> {
    const openAi = new OpenAI();
    const prompt = `You're  data analizer.
    You're job is to extract images from the message that user will send you. You have to return images as a url links to each of theme.
    There is a possibility there will be no direct url in the message and you will be needed to create it by you own using information 
    that are inside the message. 
    
    If you will get image in the message as originall photo then dont return it. Use it as a reference to create new image url.

    You have to return data as a Json object that will be contain an array of image object with url field and name field.
    Example: for url: https://example_url.com/image_1.jpg you will return {"images": [{"url": "https://example_url.com/image_1.jpg","name": "image_1.jpg"}]}
    
    If you do not have any images to return you should return empty array
    Example: {"images": []}`;

    const messages: ChatCompletionMessageParam[] = [{ role: "system", content: prompt }, { role: "user", content: msg }];

    for (let i = 0; i < 3; i++) {
        try {
            const completion = await openAi.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                response_format: { type: "json_object" }
            });
            let responseStr = completion.choices[0].message.content as string;
            responseStr = responseStr.replace(/\s+/g, '');
            const response = JSON.parse(responseStr);
            if (response && Array.isArray(response.images) && response.images.every((img: any) => typeof img.url === 'string' && typeof img.name === 'string')) {
                return response;
            } else {
                console.log("Invalid response structure");
                messages.push({ role: "user", content: `The response structure is invalid. Correct response is {"images": [{"url": "https://example_url.com/image_1.jpg","name": "image_1.jpg"}]}. Try again.` });
            }
        }
        catch (e) {
            console.log(e);
            messages.push({ role: "user", content: `There was an error processing the response. Please try again. For you're knowledge the error is ${e}` });
        }
    }

    return { images: [] };
}

async function apiRequest(command: string): Promise<string> {
    console.log(`Automat: ${command}`);
    const aiDevsService = new AiDevsService();
    const photosToCheckMsg: { message: string } = await aiDevsService.sendAnswer('photos', command);
    return photosToCheckMsg.message;
}


const images = await getImages(await apiRequest('START'));

const mainPrompt = `Jesteś policyjnym  rysownikiem. Twoim zadaniem jest zwrócić rysopis osoby na zdjęciu. Rysopis sporządź dość dokładny, aby był w stanie pomóc w identyfikacji osoby.
Nie interesuje nas co osoba robi ale jak wygląda. Chodzi o takie kwestie jak kolor oczu, włosów, długość nosa, itp. Jeżeli na zdjęciu nie widać rysy twarzy osoby to takie zdjęcie można odrzucić 
i uznać że nie ma na nim osoby. Skup się na znakach szczególnych.

Zdjęcie może być uszkodzone, za ciemnę lub za jasne. Przekaż instrukcje, jakie operacje należy wykonać na zdjęciu abyś był w stanie Utworzyć rysopis.
Jeżeli jesteś w stanie zwrócić rysopis bez żadnych operacji, zrób to.
Zdjęcie jest uszkodzone jeżeli nie ma na nim żadnych osób ani krajobrazów. Zdjęcie jest za jasne gdy światło zasłania rysy twarzy. Zdjęcie jest za ciemne, gdy mrok/ciemność zasłania postać.

Nie wolno Ci wykonywać dwa razy tej samej operacji. Jeżeli raz usuniesz uszkodzenia to kolejne próby nie dadzą już poprawy.
Zamiast ponownie wykonywać tą samą operacje, użyj innej, której jeszcze nie użyłeś. Jeżeli użyłeś wszystkie to po prostu zwróć operację -1.

Dane powinieneś zwrócić w postaci obiektu json, który będzie zawierał pole operation z numerem operacji do wykonania oraz pole answer z rysopisem postaci.
Przykłąd: {"operation": 1,"answer": ""}
lub {"operation": 0,"answer": "Tutaj umieść rysopis"}

Dostępne operacje to:
- -1 - Na zdjęciu nie ma osoby
- 0 - Zdjęcie poprawne, zwracasz gdy nie ma potrzeby wykonywania żadnych dodatkowych operacji
- 1 - Zdjęcie jest zbyt ciemne
- 2 - Zdjęcie jest zbyt jasne
- 3 - Zdjęcie jest uszkodzone
`;

const openAi = new OpenAI();

for (let i = 0; i < images.images.length; i++) {
    const image = images.images[i];
    let currentImage = image;
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: mainPrompt },
        {
            role: "user",
            content: [{
                type: "image_url",
                image_url: {
                    url: currentImage.url,
                },
            }
            ]
        }
    ];

    let useBreak = false;
    let exit = false;
    let usedOperations: string = '';

    for (let j = 0; j < 10; j++) {
        if (useBreak || exit) {
            break;
        }
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
            if (response && typeof response.operation === 'number' && typeof response.answer === 'string') {
                usedOperations += `\n- ${response.operation}`;
                switch (response.operation) {
                    case -1: useBreak = true; break;
                    case 0:
                        useBreak = true;
                        await apiRequest(response.answer);
                        break;
                    case 2:
                        const darkedImage = await getImages(`Oryginall photo: ${image.url}\n ${await apiRequest(`DARKEN ${currentImage.name}`)}`);

                        if (darkedImage.images.length > 0) {
                            currentImage = darkedImage.images[0];
                            messages.push({
                                role: "user", content: [
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: currentImage.url,
                                        },
                                    },
                                    {
                                        type: "text",
                                        text: "Użyte operacje to: " + usedOperations,
                                    }
                                ]
                            });
                        } else {
                            messages.push(
                            {
                                role: "user", content: [
                                    {
                                        type: "text",
                                        text: "Operacja nie powiodła się. Sprubuj innej. Na razie użyłeś: " + usedOperations,
                                    }
                                ]
                            });
                        }
                        break;
                    case 1:
                        const brightedImage = await getImages(`Oryginall photo: ${image.url}\n ${await apiRequest(`BRIGHTEN ${currentImage.name}`)}`);

                        if (brightedImage.images.length > 0) {
                            currentImage = brightedImage.images[0];
                            messages.push({
                                role: "user", content: [
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: currentImage.url,
                                        },
                                    },
                                    {
                                        type: "text",
                                        text: "Użyte operacje to: " + usedOperations,
                                    }
                                ]
                            });
                        } else {
                            messages.push(
                            {
                                role: "user", content: [
                                    {
                                        type: "text",
                                        text: "Operacja nie powiodła się. Sprubuj innej. Na razie użyłeś: " + usedOperations,
                                    }
                                ]
                            });
                        }
                        break;
                    case 3:
                        const repairedImage = await getImages(`Oryginall photo: ${image.url}\n ${await apiRequest(`REPAIR ${currentImage.name}`)}`);

                        if (repairedImage.images.length > 0) {
                            currentImage = repairedImage.images[0];
                            messages.push({
                                role: "user", content: [
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: currentImage.url,
                                        },
                                    },
                                    {
                                        type: "text",
                                        text: "Użyte operacje to: " + usedOperations,
                                    }
                                ]
                            });
                        } else {
                            messages.push(
                            {
                                role: "user", content: [
                                    {
                                        type: "text",
                                        text: "Operacja nie powiodła się. Sprubuj innej. Na razie użyłeś: " + usedOperations,
                                    }
                                ]
                            });
                        }
                        break;
                    default:
                        messages.push({
                            role: "user", content: [
                                {
                                    type: "text",
                                    text: "Nieprawidłowa operacja",
                                }
                            ]
                        });
                        break;
                }
            } else {
                console.log("Invalid response structure");
                messages.push({ role: "user", content: `Niepoprawna struktura. Przykład poprawnej: {"operation": 1,"answer": ""}. Spróbuj ponownie.` });
            }
        }
        catch (e) {
            console.log(e);
            messages.push({ role: "user", content: `Wystąpił błąd ${e}. Spróbuj ponownie` });
        }
    }

    if (exit) {
        break;
    }
}