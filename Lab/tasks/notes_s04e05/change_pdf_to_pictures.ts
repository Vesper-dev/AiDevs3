import { error } from 'console';
import * as fs from 'fs';
const pdfPoppler = require('pdf-poppler');

const pdfNotes = `${__dirname}\\resources\\pdf\\notatnik-rafala.pdf`;

if (!fs.existsSync(pdfNotes)) {
    throw error('File not found');
}

const outputDir = `${__dirname}\\resources\\pages\\`;

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const convertPdfToImages = async (pdfPath: string, outputDir: string) => {
    const options = {
        format: 'jpeg',
        out_dir: outputDir,
        out_prefix: 'page',
        page: null
    };

    try {
        await pdfPoppler.convert(pdfPath, options);
        console.log('PDF converted to images successfully');
    } catch (err) {
        console.error('Error converting PDF to images:', err);
    }
};

convertPdfToImages(pdfNotes, outputDir);