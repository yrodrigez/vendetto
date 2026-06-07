
import { CreatePredictionMarketUseCase } from '@/application/usecases/prediction-markets/create-prediction-market.usecase';
import { FindPredictionMarketsByResetIdUseCase } from '@/application/usecases/prediction-markets/find-prediction-markets-by-reset-id.usecase';
import { GetPopularPredictionMarketsUseCase } from '@/application/usecases/prediction-markets/get-popular-prediction-markets.usecase';
import { readResourceFile } from '@/util/file-resource-helper';
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from 'ai';
import { buildCreatePredictionMarketTool, buildFindPopularPredictionMarketsTool, buildFindPredictionMarketsByResetIdTool } from '../../tools/prediction-markets.tools';

type PredictionMarketBuilderAgentDependencies = {
  model: string;
  createPredictionMarketUseCase: CreatePredictionMarketUseCase;
  findPredictionMarketsByResetIdUseCase: FindPredictionMarketsByResetIdUseCase;
  getPopularPredictionMarketsUseCase: GetPopularPredictionMarketsUseCase;
}


export class PredictionMarketBuilderAgent {
  private readonly tools;
  constructor(private dependencies: PredictionMarketBuilderAgentDependencies) {
    this.tools = {
      createPredictionMarket: buildCreatePredictionMarketTool(dependencies.createPredictionMarketUseCase),
      findPopularPredictionMarkets: buildFindPopularPredictionMarketsTool(dependencies.getPopularPredictionMarketsUseCase),
      findPredictionMarketsByResetId: buildFindPredictionMarketsByResetIdTool(dependencies.findPredictionMarketsByResetIdUseCase),
    };
  }

  private createMessagePrompt(raidResetId: string, resetName: string, resetStartTime: string, participants: { name: string; role: string }[], remainingSlots: number) {
    const participantList = participants.map(p => `- ${p.name} (${p.role})`).join('\n');
    return `Create prediction ${remainingSlots > 1 ? `${remainingSlots} markets` : '1 market'} for the upcoming raid reset <resetName>${resetName}</resetName> <resetId>${raidResetId}</resetId> starting at <time>${resetStartTime}</time> with the following participants:\n<participants>${participantList}</participants>\n\n`;
  }

  private createAnthropicModel(model: string) {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
    const anthropicModel = model;
    const anthropic = createAnthropic({ apiKey: anthropicApiKey });
    return anthropic(anthropicModel);
  }

  async run(raidResetId: string, resetName: string, resetStartDate: string, resetStartTime: string, participants: { name: string; role: string }[], remainingSlots: number) {
    const { model } = this.dependencies;
    const systemPrompt = readResourceFile(__dirname, './system.prompt.md');
    try {
      return generateText({
        model: this.createAnthropicModel(model),
        tools: this.tools,
        system: systemPrompt,
        prompt: this.createMessagePrompt(raidResetId, resetName, `${resetStartDate} ${resetStartTime}`, participants, remainingSlots),
        stopWhen: stepCountIs(6), // Stop after the agent has executed the createPredictionMarket tool
      });
    } catch (error) {
      console.error('Error in PredictionMarketBuilderAgent:', error);
      throw error;
    }
  }
}