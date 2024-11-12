import puppeteer from 'puppeteer';
import { OpenAiService } from '../../services/open-ai.service';


const openAiService = new OpenAiService();
const url = 'https://xyz.ag3nts.org/';
const username = "tester";
const password = "574e112a";

(async () => {
    // Uruchomienie nowej instancji przeglądarki
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Przejście do strony logowania
    await page.goto(url);

    // Wypełnienie pól formularza logowania
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);

    // Pobranie pytania weryfikacyjnego
    const questionText = await page.$eval('#human-question', el => (el as any).innerText);

    const question = questionText.replace('\nQuestion:', '');
    console.log(question);

    const answer = await openAiService.getAnswer(`Odpowiedz na pytanie zadane przez użytkownika. W odpowiedzi umieść tylko i wyłącznie samą odpowiedź.
        np.
        User: Kiedy była bitwa pod Grunwaldem?
        Chat: 1410`
    ,[question])


    // Wprowadzenie odpowiedzi do pola
    await page.type('input[name="answer"]', answer??'');

    // Kliknięcie przycisku logowania
    await page.click('#submit');

    // Oczekiwanie na nawigację po zalogowaniu
    await page.waitForNavigation();

    // Pobranie i otworzenie strony po zalogowaniu
    const content = await page.content();
    console.log('Zawartość strony po zalogowaniu:', content);

    // Możesz również otworzyć stronę w domyślnej przeglądarce
    // import * as open from 'open';
    // await open(page.url());

    // Zamknięcie przeglądarki
    // await browser.close();
})();
