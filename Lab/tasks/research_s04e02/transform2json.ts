import * as path from 'path';
import * as fs from 'fs';

interface Message {
    role: string;
    content: string;
}

interface Messages {
    messages: Message[];
}

const correctPath = path.join(__dirname, 'lab_data', 'correct.txt');
const incorrectPath = path.join(__dirname, 'lab_data', 'incorrect.txt');

const readFile = (filePath: string): string[] => {
    return fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
};

const mapMessages = (lines: string[], isCorrect: boolean): Messages[] => {
    return lines.map(line => ({
        messages: [
            { role: 'system', content: 'Classify score' },
            { role: 'user', content: line },
            { role: 'assistant', content: isCorrect ? '1' : '0' }
        ]
    }));
};

const correctLines = readFile(correctPath);
const incorrectLines = readFile(incorrectPath);

const correctMessages = mapMessages(correctLines, true);
const incorrectMessages = mapMessages(incorrectLines, false);

const outputFilePath = path.join(__dirname, 'tests.jsonl');
const writeStream = fs.createWriteStream(outputFilePath, { flags: 'a' });

[...correctMessages, ...incorrectMessages].forEach(message => {
    writeStream.write(JSON.stringify(message) + '\n');
});

writeStream.end();