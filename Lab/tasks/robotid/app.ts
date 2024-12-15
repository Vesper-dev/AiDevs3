import axios from 'axios';
import { AiDevsService } from '../../services/ai-devs.service';
import { OpenAiService } from '../../services/open-ai.service';

const descriptionUrl = `https://centrala.ag3nts.org/data/${process.env.AIDEVS_KEY}/robotid.json`;

try {
    const response = await axios.get(descriptionUrl);
    const description = response.data.description;
    console.log(description);

    const openAiService = new OpenAiService();

    const robotImageUrl = await openAiService.generateImage(description);

    if (robotImageUrl) {
        const aiDevsService = new AiDevsService();
        aiDevsService.sendAnswer('robotid', robotImageUrl);
    }
    else{
        console.error('Generation image failed');
    }
    
    console.log('Robot image generated:', robotImageUrl);

} catch (error) {
    console.error('Error fetching the description:', error);
}

