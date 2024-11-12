export interface MegaJsonModel {
    apikey: string;
    description: string;
    copyright: string;
    "test-data": testData[];
}

export interface testData{
    question: string;
    answer: number;
    test: test
}

export interface test{
    q: string;
    a: string;
}